'use strict'

const EventEmitter = require('events')
const grpc = require('grpc')
const _ = require('lodash')
const util = require('../common/util.js')
const protoLoader = require('../common/proto.js')

class LobbyClient extends EventEmitter {
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
      console.log(data)
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
}

const clientDefaults = {
  connectLocal: false,
  lobbyServer: 'lobby.papan.online',
  lobbyServerPort: 5051
}

class ClientInterface {

}

module.exports.ClientInterface = ClientInterface

module.exports.CreateClient = (clientInterface, options) => {
  options = _.defaults(options, clientDefaults)
  if (options.connectLocal) {
    options.lobbyServer = 'localhost'
    options.lobbyServerPort = 5051
  }
  const serverAddress = options.lobbyServer + ':' + options.lobbyServerPort

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
