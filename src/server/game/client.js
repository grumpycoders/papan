'use strict'

const EventEmitter = require('events')
const path = require('path')
const grpc = require('grpc')
const merge = require('deepmerge')
const _ = require('lodash')
const DeepDiffWrapper = require('../../common/deep-diff-wrapper.js')
const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')
const protoLoader = require('../common/proto.js')
const GameInstance = require('./game-instance.js')
const dispatcher = require('../common/dispatcher.js')
const PlayersInfo = require('../../common/player-info.js')

class LobbyHandlers {
  'PapanLobby.GameStarted' (call, message) {
    call.playersToSlots = PlayersInfo.playersInfoPlayersIdToSlots(message.info.playersInfo)
    const args = {
      gameInfo: message.info.gameInfo,
      playersInfo: message.info.playersInfo,
      settings: {},
      seed: message.seed,
      channel: {
        sendPublicScene: publicScene => call.write({
          publicScene: {
            previousStep: publicScene.previousStep,
            newStep: publicScene.newStep,
            deltas: DeepDiffWrapper.wrap(publicScene.deltas)
          }
        }),
        sendTemporaryScene: (step, scene) => {}
      }
    }
    call.gameInstance = GameInstance.createInstance(args)
  }

  'PapanLobby.SceneAction' (call, message) {
    const senders = call.playersToSlots[message.sender.id]
    if (!senders) return
    call.gameInstance.action({
      data: PapanUtils.JSON.parse(message.message),
      senders: senders
    })
  }
}

class LobbyClient extends EventEmitter {
  constructor ({ gamesList, grpcClient, proto }) {
    super()

    this._lobbyDispatcher = dispatcher(proto.PapanLobby.GameLobbyUpdate, new LobbyHandlers())
    this.grpcClient = grpcClient
    this._gamesList = gamesList
    this._lobbies = {}
  }

  close () {
    if (this.subscription) this.subscription.cancel()
    Object.keys(this._lobbies).forEach(key => {
      this._lobbies[key].call.cancel()
    })
  }

  getAuthMetadata () {
    let metadata = new grpc.Metadata()
    if (this.papanSession) {
      metadata.set('papan-session', this.papanSession)
    }
    return metadata
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

  subscribe ({ apiKey }) {
    const call = this.grpcClient.Subscribe()
    this.subscription = call
    this.metadataCatcher(call, console.log)
    call.on('status', status => {
      console.log(status)
    })
    call.on('end', () => {
      console.log('end')
    })
    call.on('error', error => {
      console.log(error)
    })
    call.on('data', data => {
      switch (data.update) {
        case 'subscribed':
          if (apiKey) {
            call.write({
              register: {
                apiKey: apiKey,
                games: this._gamesList
              }
            })
          }
          this.emit('ClientConnected')
          break
      }
    })
  }

  joinLobby (id) {
    const call = this.grpcClient.Lobby()
    this._lobbies[id] = { call }
    call.on('status', status => {
      console.log(status)
    })
    call.on('end', () => {
      console.log('end')
    })
    call.on('error', error => {
      console.log(error)
    })
    call.on('data', data => {
      this._lobbyDispatcher(call, data)
    })
    call.write({
      join: {
        id: id
      }
    })
  }
}

const clientDefaults = Object.freeze({
  connectLocal: false,
  lobbyServer: 'lobby.papan.online',
  lobbyServerPort: 9999,
  useLocalCA: true
})

exports.createClient = (gamesList, options) => {
  options = _.defaults(options, clientDefaults)
  if (options.connectLocal) {
    options.lobbyServer = 'localhost'
    options.lobbyServerPort = 9999
    options.useLocalCA = true
  }

  const serverAddress = options.lobbyServer + ':' + options.lobbyServerPort

  const work = [
    PapanServerUtils.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-ca.crt')),
    protoLoader.load('lobby.proto')
  ]

  return Promise.all(work).then(results => {
    const lobbyProtoRoot = results[1].rootProto
    const lobbyProto = results[1].PapanLobby
    let client
    const sslCreds = options.useLocalCA ? grpc.credentials.createSsl(results[0]) : grpc.credentials.createSsl()
    const callCreds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
      const metadata = client.getAuthMetadata()
      callback(null, metadata)
    })
    const creds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds)
    const localChannelOptions = {
      'grpc.ssl_target_name_override': 'localhost'
    }
    let channelOptions = {}
    if (options.useLocalCA) channelOptions = merge(channelOptions, localChannelOptions)

    const grpcClient = new lobbyProto.GameLobbyService(serverAddress, creds, channelOptions)
    client = new LobbyClient({ gamesList: gamesList, lobbyProto: results[1], grpcClient: grpcClient, proto: lobbyProtoRoot })
    client.subscribe(options)

    return client
  })
}
