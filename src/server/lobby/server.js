'use strict'

const grpc = require('grpc')
const path = require('path')
const request = require('request-promise-native')
const _ = require('lodash')
const deepclone = require('deepclone')
const protoLoader = require('../common/proto.js')
const PapanServerUtils = require('../common/utils.js')
const persist = require('./persist.js')

const serverDefaults = {
  requiresAuth: true,
  authServer: 'https://auth.papan.online',
  port: 9999
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
    call.metadata.remove('papan-userid')
    let session = call.metadata.get('papan-session')[0]
    if (session && sessions[session]) {
      call.metadata.set('papan-userid', sessions[session])
      return Promise.resolve()
    }

    if (options.requiresAuth) {
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
          return PapanServerUtils.generateToken()
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
      return PapanServerUtils.generateToken()
      .then(token => {
        sessions[token] = token
        let metadata = new grpc.Metadata()
        metadata.set('papan-session', token)
        call.metadata.set('papan-userid', token)
        return metadata
      })
    }
  })

  const getUserId = call => {
    const userid = call.metadata.get('papan-userid')
    if (userid.length === 1) {
      return userid[0]
    }
    return ''
  }

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
    grpcServer.addService(lobbyProto.PlayerLobbyService.service, checkCredentials({
      Subscribe: call => {
        const userId = getUserId(call)
        call.write({
          subscribed: {
            self: {
              userId: userId
            }
          }
        })
        const sub = persist.userSubscribe(userId, message => {
          call.write(message)
        })
        call.on('data', data => {
          switch (data.action) {
            case 'message':
              let message = deepclone(data)
              message.message.userId = userId
              persist.sendMessage(data.userId, message)
              break
          }
        })
        call.on('end', () => sub.close())
      },
      Lobby: call => {
        const userId = getUserId(call)
        let gotJoin = false
        let lobbyId
        let sub
        call.on('data', data => {
          let joinError = false
          let errorMsg
          if (data.action === 'joinLobby') {
            if (gotJoin) {
              joinError = true
              errorMsg = 'You can\'t join twice'
            }
            gotJoin = true
          } else {
            if (!gotJoin) {
              joinError = true
              errorMsg = 'You need to join first'
            }
          }
          if (joinError) {
            let error = {
              code: grpc.status.FAILED_PRECONDITION,
              details: errorMsg,
              metadata: new grpc.Metadata()
            }
            call.emit('error', error)
            call.end()
            return
          }
          switch (data.action) {
            case 'joinLobby':
              lobbyId = data.joinLobby.lobbyId
              let premise
              if (lobbyId) {
                premise = persist.joinLobby({
                  userId: userId,
                  lobbyId: lobbyId
                })
              } else {
                premise = persist.createLobby({
                  userId: userId
                })
              }
              premise
              .then(result => {
                lobbyId = result.lobbyId
                sub = persist.lobbySubscribe(lobbyId, message => {
                  call.write(message)
                })
                call.on('end', () => sub.close())
                call.write({
                  lobbyInfo: result
                })
                persist.lobbySendMessage(lobbyId, {
                  userJoined: {
                    userId: userId
                  }
                })
              })
              .catch(err => {
                let error = {
                  code: grpc.status.UNKNOWN,
                  details: err.message,
                  metadata: new grpc.Metadata()
                }
                call.emit('error', error)
                call.end()
              })
              break
            case 'setName':
              persist.setLobbyName({
                userId: userId,
                lobbyId: lobbyId,
                lobbyName: data.setName
              })
              .then(result => {
                persist.lobbySendMessage({
                  lobbyInfo: result
                })
              })
              break
          }
        })
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
