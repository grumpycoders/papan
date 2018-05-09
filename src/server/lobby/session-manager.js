'use strict'

const grpc = require('grpc')
const request = require('request-promise-native')

const PapanServerUtils = require('../common/utils.js')

class SessionManager {
  constructor (persist) {
    this._persist = persist
  }

  _getSession (call) {
    let session = call.metadata.get('papan-session')
    if (session.length === 1) {
      return session[0]
    }
    session = call.papanSession
    if (typeof session === 'string' && session.length >= 0) {
      return session
    }
    return undefined
  }

  _checkCredentialsGenerator (credentialsVerifier) {
    return handlerOrService => {
      const interceptorGenerator = handler => (call, callback) => credentialsVerifier(call)
        .then(metadata => {
          if (metadata) {
            call.sendMetadata(metadata)
          }
          handler(call, callback)
        })
        .catch(err => {
          console.error('SessionManager caught an error:')
          console.log(err)
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
  }

  _checkCredentialsWrapper (options) {
    return this._checkCredentialsGenerator(call => {
      const authAndSessionWork = async () => {
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

            const res = await request(requestData)
            if (!res.userId) throw Error('Invalid exchange code')
            userId = res.userId
            call.metadata.set('papan-userid', userId)
            const token = await this._persist.createSession(userId)
            let metadata = new grpc.Metadata()
            metadata.set('papan-session', token)
            call.papanSession = token
            return metadata
          }
          throw Error('Client must authenticate')
        } else {
          const userId = await PapanServerUtils.generateToken({ prefix: 'USER' })
          call.metadata.set('papan-userid', userId)
          const token = await this._persist.createSession(userId)
          let metadata = new grpc.Metadata()
          metadata.set('papan-session', token)
          call.papanSession = token
          return metadata
        }
      }

      call.metadata.remove('papan-userid')
      const session = this._getSession(call)
      if (session) {
        return new Promise((resolve, reject) => {
          this._persist.getIdFromSession(session)
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
  }

  checkCredentials (options, handlerOrService) {
    return this._checkCredentialsWrapper(options)(handlerOrService)
  }

  getId (call) {
    const userid = call.metadata.get('papan-userid')
    if (userid.length === 1) {
      return userid[0]
    }
    return undefined
  }

  getSessionData (call) {
    const session = this._getSession(call)
    if (!session) return Promise.reject(Error('No session'))
    return this._persist.getSessionData(session)
  }

  setSessionData (call, sessionData) {
    const session = this._getSession(call)
    if (!session) return Promise.reject(Error('No session'))
    return this._persist.setSessionData(session, sessionData)
  }
}

module.exports = SessionManager
