'use strict'

const grpc = require('grpc')
const path = require('path')
const _ = require('lodash')
const protoLoader = require('../common/proto.js')
const PapanServerUtils = require('../common/utils.js')
const authsession = require('./authsession.js')

const playerLobbyService = require('./playerlobbyservice.js')
const gameLobbyService = require('./gamelobbyservice.js')

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
    protoLoader.load('lobby.proto')
  ]

  return Promise.all(work).then(results => {
    const grpcServer = new grpc.Server()
    const lobbyProto = results[3].PapanLobby
    const sslCreds = grpc.ServerCredentials.createSsl(
      results[0],
      [{ private_key: results[2], cert_chain: results[1] }],
      false
    )
    grpcServer.addService(
      lobbyProto.PlayerLobbyService.service,
      authsession.checkCredentials(
        options,
        playerLobbyService.generateService(options)
      )
    )
    grpcServer.addService(
      lobbyProto.GameLobbyService.service,
      authsession.checkCredentials(
        { requiresAuth: false },
        gameLobbyService.generateService(options)
      )
    )

    grpcServer.bind('0.0.0.0:' + options.port, sslCreds)
    grpcServer.start()

    return grpcServer
  })
}
