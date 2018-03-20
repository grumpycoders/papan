'use strict'

const EventEmitter = require('events')
const grpc = require('grpc')
const _ = require('lodash')
const util = require('../common/util.js')
const protoLoader = require('../common/proto.js')

class LobbyClient extends EventEmitter {
  constructor () {
    super()
    this.pendingSubscriptionActions = []
  }

  close () {

  }

  getAuthMetadata () {
    let metadata = new grpc.Metadata()
    if (this.papan_code) {
      metadata.set('papan-code', this.papan_code)
    } else if (this.papan_session) {
      metadata.set('papan-session', this.papan_session)
    }
    return metadata
  }

  subscribe () {
    let call = this.grpcClient.Subscribe()
    call.on('error', err => {
      if (err.code === grpc.status.UNAUTHENTICATED) {
        this.clientInterface.setLobbyConnectionStatus('AUTHENTICATING')
        this.clientInterface.getAuthorizationCode()
        .then(code => {
          this.papan_code = code
          this.subscribe()
        })
        .catch(err => {
          err.code = grpc.status.UNAUTHENTICATED
          call.emit('error', err)
        })
      }
      console.log(err)
    })
    call.on('status', status => {
      console.log(status)
    })
    call.on('data', data => {
      switch (data.update) {
        case 'error':
          this.clientInterface.sendError(data.error.message)
          break
        case 'subscribed':
          this.clientInterface.setLobbyConnectionStatus('CONNECTED')
          this.processSubscriptionActions()
          break
        case 'lobbyCreated':
          this.clientInterface.lobbyCreated(data.lobbyCreated)
          break
      }
    })
    call.on('end', () => {
      console.log('end')
    })
    call.on('metadata', metadata => {
      const session = metadata.get('papan-session')
      if (session.length === 1) {
        this.papan_session = session[0]
      }
    })
    this.subscription = call
  }

  processSubscriptionActions () {
    if (this.clientInterface.getLobbyConnectionStatus() !== 'CONNECTED') {
      return
    }

    this.pendingSubscriptionActions.forEach(pending =>
      this.subscription.write(pending.message)
    )
  }

  createLobby (data) {
    this.pendingSubscriptionActions.push({
      message: {
        createLobby: data
      }
    })
    this.processSubscriptionActions()
  }
}

const clientDefaults = {
  connectLocal: false,
  lobbyServer: 'lobby.papan.online',
  lobbyServerPort: 5051
}

class ClientInterface {
  constructor (channel) {
    this.channel = channel
    this.lobbyConnectionStatus = 'NOTCONNECTED'
    this.channel.on('GetLobbyConnectionStatus', data => {
      this.sendLobbyConnectionStatus()
    })
  }

  getLobbyConnectionStatus () {
    return this.lobbyConnectionStatus
  }

  sendLobbyConnectionStatus () {
    this.channel.send('LobbyConnectionStatus', { status: this.lobbyConnectionStatus })
  }

  setLobbyConnectionStatus (status) {
    this.lobbyConnectionStatus = status
    this.sendLobbyConnectionStatus()
  }

  sendError (message) {
    this.channel.send('Error', { message: message })
  }

  lobbyCreated (data) {
    this.channel.send('LobbyCreated', { lobbyCreated: data })
  }
}

exports.ClientInterface = ClientInterface

exports.CreateClient = (clientInterface, options) => {
  options = _.defaults(options, clientDefaults)
  if (options.connectLocal) {
    options.lobbyServer = 'localhost'
    options.lobbyServerPort = 5051
  }
  const serverAddress = options.lobbyServer + ':' + options.lobbyServerPort
  clientInterface.setLobbyConnectionStatus('CONNECTING')

  const work = [
    util.readFile('certs/localhost-ca.crt'),
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
