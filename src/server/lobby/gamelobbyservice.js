'use strict'

const persist = require('./persist.js')
const authsession = require('./authsession.js')
const dispatcher = require('./dispatcher.js')

class SubscribeHandlers {
  'PapanLobby.RegisterGameServer' (call, data) {
    let premise
    if (call.localApiKey === data.apiKey) {
      premise = Promise.resolve(true)
    } else {
      premise = persist.isApiKeyValid(data.register.apiKey)
    }
    return premise
    .then(trusted => authsession.setSessionData(call, { trusted: trusted }))
    .then(data => {
      call.trusted = data.trusted
      call.write({
        registered: {
          trusted: call.trusted
        }
      })
    })
  }
}

class LobbyHandlers {
  'PapanLobby.JoinLobby' (call, data) {
    return Promise.reject(Error('unimplemented'))
  }
}

const Subscribe = (options, call, dispatcher) => {
  const id = authsession.getId(call)
  call.localApiKey = options.localApiKey
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
  call.on('data', data => dispatcher(call, data))
}

const Lobby = (call, dispatcher) => {
  call.on('error', error => {
    console.log(error)
  })
  call.on('end', () => {
    call.end()
  })
  call.on('data', data => dispatcher(call, data))
}

exports.generateService = (proto, options) => {
  const subscribeDispatcher = dispatcher(proto.GameAction.fields, new SubscribeHandlers())
  const lobbyDispatcher = dispatcher(proto.GameLobbyAction.fields, new LobbyHandlers())
  return {
    Subscribe: call => Subscribe(options, call, subscribeDispatcher),
    Lobby: call => Lobby(call, lobbyDispatcher)
  }
}
