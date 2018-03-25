'use strict'

const EventEmitter = require('events')
const path = require('path')
const grpc = require('grpc')
const merge = require('deepmerge')
const _ = require('lodash')
const PapanServerUtils = require('../common/utils.js')
const protoLoader = require('../common/proto.js')

class LobbyClient extends EventEmitter {
  constructor () {
    super()

    const subscribedMessages = ['xxx']
    subscribedMessages.forEach(message => {
      this[message] = data => {
        const obj = {}
        obj[message] = data
        this.subscribedWrite(obj)
      }
    })

    this.lobbies = {}
  }

  close () {
    console.log('TODO')
  }

  getAuthMetadata () {
    let metadata = new grpc.Metadata()
    if (this.papanCode) {
      metadata.set('papan-code', this.papanCode)
      this.papanCode = null
    } else if (this.papanSession) {
      metadata.set('papan-session', this.papanSession)
    }
    return metadata
  }

  errorCatcher (call, retry, handler) {
    call.on('error', err => {
      if (err.code === grpc.status.UNAUTHENTICATED) {
        this.clientInterface.setLobbyConnectionStatus('AUTHENTICATING')
        this.clientInterface.getAuthorizationCode()
        .then(code => {
          this.papanCode = code
          retry()
        })
        .catch(err => {
          err.code = grpc.status.UNAUTHENTICATED
          call.emit('error', err)
        })
      } else {
        if (handler) handler(err)
      }
    })
  }

  metadataCatcher (call, handler) {
    call.on('metadata', metadata => {
      const session = metadata.get('papan-session')
      if (session.length === 1) {
        this.papanSession = session[0]
      }
      handler(metadata)
    })
  }

  subscribe () {
    let call = this.grpcClient.Subscribe()
    this.errorCatcher(call, () => this.subscribe(), console.log)
    this.metadataCatcher(call, console.log)
    call.on('status', status => {
      console.log(status)
    })
    call.on('end', () => {
      console.log('end')
    })
    call.on('data', data => {
      switch (data.update) {
        case 'subscribed':
          this.clientInterface.setLobbyConnectionStatus('CONNECTED')
          break
        default:
          this.clientInterface[data.update](data[data.update])
          break
      }
    })
    this.subscription = call
  }

  joinLobby (data) {
    let call = this.grpcClient.Lobby()
    if (!data) data = {}
    let lobbyId = data.lobbyId
    if (lobbyId) {
      this.lobbies[lobbyId] = { call: call }
    }

    this.errorCatcher(call, () => this.joinLobby({ lobbyId: lobbyId }), console.log)
    this.metadataCatcher(call, console.log)
    call.on('data', data => {
      if (!lobbyId && data.update === 'lobbyInfo') {
        lobbyId = data.lobbyInfo.lobbyId
        this.lobbies[lobbyId] = { call: call }
      }
      this.clientInterface[data.update](merge(data[data.update], { lobbyId: lobbyId }))
    })

    call.write({ joinLobby: data })
  }

  subscribedWrite (data) {
    if (this.clientInterface.getLobbyConnectionStatus() !== 'CONNECTED') {
      return
    }

    this.subscription.write(data)
  }
}

const clientDefaults = {
  connectLocal: false,
  lobbyServer: 'lobby.papan.online',
  lobbyServerPort: 5051
}

exports.CreateClient = (clientInterface, options) => {
  options = _.defaults(options, clientDefaults)
  if (options.connectLocal) {
    options.lobbyServer = 'localhost'
    options.lobbyServerPort = 5051
  }
  const serverAddress = options.lobbyServer + ':' + options.lobbyServerPort
  clientInterface.setLobbyConnectionStatus('CONNECTING')

  const work = [
    PapanServerUtils.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-ca.crt')),
    protoLoader.load('lobby.proto')
  ]

  return Promise.all(work).then(results => {
    const client = new LobbyClient()
    const lobbyProto = results[1].PapanLobby
    const sslCreds = options.connectLocal ? grpc.credentials.createSsl(results[0]) : grpc.credentials.createSsl()
    const callCreds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
      const metadata = client.getAuthMetadata()
      callback(null, metadata)
    })
    const creds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds)

    let grpcClient = new lobbyProto.PlayerLobbyService(serverAddress, creds)
    client.grpcClient = grpcClient
    client.clientInterface = clientInterface
    client.subscribe()

    return client
  })
}
