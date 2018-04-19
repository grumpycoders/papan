'use strict'

const grpc = require('grpc')
const path = require('path')
const _ = require('lodash')
const protoLoader = require('../common/proto.js')
const PapanServerUtils = require('../common/utils.js')
const SessionManager = require('./session-manager.js')

const playerLobbyService = require('./playerlobbyservice.js')
const gameLobbyService = require('./gamelobbyservice.js')
const Persist = require('./persist.js')

const serverDefaults = {
  requiresAuth: true,
  authServer: 'https://auth.papan.online',
  port: 9999
}

exports.registerServer = options => {
  options = _.defaults(options, serverDefaults)

  const work = [
    PapanServerUtils.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-ca.crt')),
    PapanServerUtils.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-server.crt')),
    PapanServerUtils.readFile(path.join(__dirname, '..', '..', '..', 'certs', 'localhost-server.key')),
    Persist.createPersist(),
    protoLoader.load('lobby.proto')
  ]

  return Promise.all(work).then(results => {
    const persist = results[3]
    const sessionManager = new SessionManager(persist)
    const grpcServer = new grpc.Server()
    const lobbyProto = results[4]
    const sslCreds = grpc.ServerCredentials.createSsl(
      results[0],
      [{ private_key: results[2], cert_chain: results[1] }],
      false
    )
    grpcServer.addService(
      lobbyProto.PapanLobby.PlayerLobbyService.service,
      sessionManager.checkCredentials(
        options,
        playerLobbyService.generateService({
          proto: lobbyProto.rootProto.PapanLobby,
          persist: persist,
          sessionManager: sessionManager,
          options: options
        })
      )
    )
    grpcServer.addService(
      lobbyProto.PapanLobby.GameLobbyService.service,
      sessionManager.checkCredentials(
        { requiresAuth: false },
        gameLobbyService.generateService({
          proto: lobbyProto.rootProto.PapanLobby,
          persist: persist,
          sessionManager: sessionManager,
          options: options
        })
      )
    )

    grpcServer.bind('0.0.0.0:' + options.port, sslCreds)
    grpcServer.start()

    return grpcServer
  })
}
