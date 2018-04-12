'use strict'

const grpc = require('grpc')
const request = require('request-promise-native')

const persist = require('./persist.js')
const PapanServerUtils = require('../common/utils.js')

const getSession = call => {
  const session = call.metadata.get('papan-session')
  if (session.length === 1) {
    return session[0]
  }
  return undefined
}

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

const checkCredentialsWrapper = options => checkCredentialsGenerator(call => {
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
          return persist.createSession(userId)
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
        return persist.createSession(userId)
      })
      .then(token => {
        let metadata = new grpc.Metadata()
        metadata.set('papan-session', token)
        return metadata
      })
    }
  }

  call.metadata.remove('papan-userid')
  const session = getSession(call)
  if (session) {
    return new Promise((resolve, reject) => {
      persist.getIdFromSession(session)
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

exports.checkCredientials = (options, handlerOrService) => checkCredentialsWrapper(options)(handlerOrService)

exports.getId = call => {
  const userid = call.metadata.get('papan-userid')
  if (userid.length === 1) {
    return userid[0]
  }
  return undefined
}

exports.getSessionData = call => {
  const session = getSession(call)
  if (!session) return Promise.reject(Error('No session'))
  return persist.getSessionData(session)
}
