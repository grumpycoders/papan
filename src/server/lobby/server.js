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
    const authAndSessionWork = () => {
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
            return persist.createUserSession(userId)
          })
          .then(token => {
            let metadata = new grpc.Metadata()
            metadata.set('papan-session', token)
            return metadata
          })
        }
        return Promise.reject(Error('Client must authenticate'))
      } else {
        return PapanServerUtils.generateToken()
        .then(userId => {
          call.metadata.set('papan-userid', userId)
          return persist.createUserSession(userId)
        })
        .then(token => {
          let metadata = new grpc.Metadata()
          metadata.set('papan-session', token)
          return metadata
        })
      }
    }

    call.metadata.remove('papan-userid')
    let session = call.metadata.get('papan-session')[0]
    if (session) {
      return new Promise((resolve, reject) => {
        persist.getUserFromSession(session)
        .then(userId => {
          call.metadata.set('papan-userid', userId)
          resolve()
        })
        .catch(() => { resolve(authAndSessionWork()) })
      })
    } else {
      return authAndSessionWork()
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
        const id = getUserId(call)
        call.write({
          subscribed: {
            self: {
              id: id
            }
          }
        })
        const sub = persist.userSubscribe(id, message => {
          call.write(message)
        })
        call.on('data', data => {
          switch (data.action) {
            case 'message':
              let message = deepclone(data)
              message.message.id = id
              persist.sendMessage(data.id, message)
              break
            case 'getJoinedLobbies':
              persist.getJoinedLobbies({ id: id })
              .then(result => {
                call.write({
                  joinedLobbies: {
                    lobbies: result
                  }
                })
              })
              break
          }
        })
        call.on('end', () => {
          sub.close()
          call.end()
        })
      },
      Lobby: call => {
        const userId = getUserId(call)
        let gotJoin = false
        let id
        let sub
        let runningPromise
        call.on('end', () => call.end())
        call.on('data', data => {
          let joinError = false
          let errorMsg
          if (data.action === 'join') {
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
            case 'join':
              id = data.join.id
              let premise
              if (id) {
                premise = persist.joinLobby({
                  userId: userId,
                  id: id
                })
              } else {
                premise = persist.createLobby({
                  userId: userId
                })
              }
              runningPromise = premise
              .then(result => {
                id = result.id
                sub = persist.lobbySubscribe(id, message => {
                  call.write(message)
                })
                call.on('end', () => sub.close())
                call.write({
                  info: result
                })
                persist.lobbySendMessage(id, {
                  userJoined: {
                    id: userId
                  }
                })
              })
              break
            case 'setName':
              runningPromise = persist.setLobbyName({
                userId: userId,
                id: id,
                name: data.setName.name
              })
              .then(result => {
                persist.lobbySendMessage({
                  info: result
                })
              })
              break
            case 'setPublic':
              runningPromise = persist.setLobbyPublic({
                userId: userId,
                id: id,
                public: data.setPublic.public
              }).then(result => {
                persist.lobbySendMessage({
                  info: result
                })
              })
              break
          }
          if (runningPromise) {
            runningPromise.catch(err => {
              let error = {
                code: grpc.status.UNKNOWN,
                details: err.message,
                metadata: new grpc.Metadata()
              }
              call.emit('error', error)
              call.end()
            })
          }
        })
      },
      ListLobbies: call => {
        const sub = persist.lobbyListSubscribe(data => {
          call.write(data)
        })
        persist.getPublicLobbies()
        .then(lobbies => {
          if (!lobbies) lobbies = []
          return Promise.all(lobbies.map(id => persist.getLobbyInfo({ id: id })))
        })
        .then(lobbies => {
          lobbies.forEach(info => {
            call.write({
              lobby: info,
              status: 0
            })
          })
        })
        call.on('end', () => {
          sub.close()
          call.end()
        })
      }
    }))

    const checkSessionGenerator = sessionVerifier => handlerOrService => {
      const interceptorGenerator = handler => (call, callback) => sessionVerifier(call)
      .then(metadata => {
        if (metadata) {
          call.sendMetadata(metadata)
        }
        handler(call, callback)
      })
      .catch(err => {
        let error = {
          code: grpc.status.UNKNOWN,
          details: err.message
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

    const checkSession = checkSessionGenerator(call => {
      const sessionWork = () => {
        return PapanServerUtils.generateToken()
        .then(userId => {
          call.metadata.set('papan-gameserverid', userId)
          return persist.createUserSession(userId)
        })
        .then(token => {
          let metadata = new grpc.Metadata()
          metadata.set('papan-session', token)
          return metadata
        })
      }

      call.metadata.remove('papan-gameserverid')
      let session = call.metadata.get('papan-session')[0]
      if (session) {
        return new Promise((resolve, reject) => {
          persist.getGameServerFromSession(session)
          .then(userId => {
            call.metadata.set('papan-gameserverid', userId)
            resolve()
          })
          .catch(() => { resolve(sessionWork()) })
        })
      } else {
        return sessionWork()
      }
    })

    const getGameServerId = call => {
      const userid = call.metadata.get('papan-gameserverid')
      if (userid.length === 1) {
        return userid[0]
      }
      return ''
    }

    grpcServer.addService(lobbyProto.GameLobbyService.service, checkSession({
      Subscribe: call => {
        const id = getGameServerId(call)
        call.write({
          subscribed: {
            self: {
              id: id
            }
          }
        })
        call.on('end', () => {
          call.end()
        })
        call.on('data', data => {
          console.log(data)
        })
      }
    }))

    grpcServer.bind('0.0.0.0:' + options.port, sslCreds)
    grpcServer.start()

    return grpcServer
  })
}
