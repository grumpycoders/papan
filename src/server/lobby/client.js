'use strict'

const EventEmitter = require('events')
const path = require('path')
const grpc = require('grpc')
const _ = require('lodash')
const util = require('../common/util.js')
const protoLoader = require('../common/proto.js')

class LobbyClient extends EventEmitter {
  close () {

  }

  getAuthMetadata () {
    let metadata = new grpc.Metadata()
    if (this.papanCode) {
      metadata.set('papan-code', this.papanCode)
    } else if (this.papan_session) {
      metadata.set('papan-session', this.papan_session)
    }
    return metadata
  }

  errorCatcher (call, handler) {
    call.on('error', err => {
      if (err.code === grpc.status.UNAUTHENTICATED) {
        this.clientInterface.setLobbyConnectionStatus('AUTHENTICATING')
        this.clientInterface.getAuthorizationCode()
        .then(code => {
          this.papanCode = code
          this.subscribe()
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

  subscribe () {
    let call = this.grpcClient.Subscribe()
    this.errorCatcher(call, console.log)
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

  subscribedWrite (data) {
    if (this.clientInterface.getLobbyConnectionStatus() !== 'CONNECTED') {
      return
    }

    this.subscription.write(data)
  }

  createLobby (data) {
    this.subscribedWrite({
      message: {
        createLobby: data
      }
    })
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
    util.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-ca.crt')),
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
