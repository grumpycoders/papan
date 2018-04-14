'use strict'

const grpc = require('grpc')
const persist = require('./persist.js')
const authsession = require('./authsession.js')

const Subscribe = (options, call) => {
  const id = authsession.getId(call)
  let trusted = false
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  call.on('error', error => {
    console.log(error)
  })
  call.on('end', () => {
    call.end()
  })
  call.on('data', data => {
    let runningPromise
    switch (data.action) {
      case 'register':
        let premise
        if (options.localApiKey === data.register.apiKey) {
          premise = Promise.resolve(true)
        } else {
          premise = persist.isApiKeyValid(data.register.apiKey)
        }
        runningPromise = premise
        .then(trusted => authsession.setSessionData(call, { trusted: trusted }))
        .then(data => {
          trusted = data.trusted
          call.write({
            registered: {
              trusted: trusted
            }
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
}

const Lobby = call => {
  call.on('error', error => {
    console.log(error)
  })
  call.on('end', () => {
    call.end()
  })
  call.on('data', data => {
    switch (data.action) {
      case 'join':
    }
  })
}

exports.generateService = options => ({
  Subscribe: call => Subscribe(options, call),
  Lobby: Lobby
})
