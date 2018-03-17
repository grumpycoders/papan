'use strict'

const grpc = require('grpc')
const request = require('request-promise-native')
const _ = require('lodash')
const protoLoader = require('../common/proto.js')
const util = require('../common/util.js')

const serverDefaults = {
  requiresAuth: true,
  authServer: 'https://auth.papan.online',
  port: 5051
}

exports.registerServer = options => {
  let sessions = {}

  options = _.defaults(options, serverDefaults)
  const checkCredentialsGenerator = credentialsVerifier => handlerOrService => {
    const interceptorGenerator = handler => (call, callback) => credentialsVerifier(call)
      .then(metadata => {
        if (metadata) {
          call.sendMetadata(metadata)
        }
        handler(call, callback)
      })
      .catch(err => {
        let error = {
          code: grpc.status.UNAUTHENTICATED,
          details: err.message || 'Client must authenticate'
        }
        let metadata = new grpc.Metadata()
        if (callback === undefined) {
          error.metadata = metadata
          call.emit('error', error)
        } else {
          callback(error, null, metadata)
        }
      })

    if (typeof handlerOrService === 'function') {
      const handler = handlerOrService
      return interceptorGenerator(handler)
    } else {
      const service = handlerOrService
      const intercepted = {}
      Object.keys(service).map(key => {
        const handler = service[key]
        intercepted[key] = interceptorGenerator(handler)
      })
      return intercepted
    }
  }

  const checkCredentials = checkCredentialsGenerator(call => {
    if (options.requiresAuth) {
      call.metadata.remove('papan-userid')
      let session = call.metadata.get('papan-session')[0]
      if (session && sessions[session]) {
        call.metadata.set('papan-userid', sessions[session])
        return Promise.resolve()
      }

      let code = call.metadata.get('papan-code')[0]
      if (code) {
        const requestData = {
          method: 'POST',
          url: options.authServer + '/exchange',
          body: { code: code },
          json: true
        }
        let userId = -1

        return request(requestData)
        .then(res => {
          if (!res.userId) return Promise.reject(Error('Invalid exchange code'))
          userId = res.userId
          call.metadata.set('papan-userid', userId)
          return util.generateToken()
        })
        .then(token => {
          sessions[token] = userId
          let metadata = new grpc.Metadata()
          metadata.set('papan-session', token)
          return metadata
        })
      }
      return Promise.reject(Error('Client must authenticate'))
    } else {
      return Promise.resolve(undefined)
    }
  })

  const work = [
    util.readFile('certs/localhost-ca.crt'),
    util.readFile('certs/localhost-server.crt'),
    util.readFile('certs/localhost-server.key'),
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
    grpcServer.addService(lobbyProto.PlayerLobbyService.service, checkCredentials({
      Subscribe: call => {
        console.log(call)
      },
      Lobby: call => {
        console.log(call)
      },
      ListLobbies: call => {
        console.log(call)
        call.on('end', () => call.end())
      }
    }))

    grpcServer.bind('0.0.0.0:' + options.port, sslCreds)
    grpcServer.start()

    return grpcServer
  })
}
