'use strict'

const dispatcher = require('./dispatcher.js')

class SubscribeHandlers {
  constructor ({ persist, sessionManager }) {
    this._sessionManager = sessionManager
    this._persist = persist
  }

  'PapanLobby.RegisterGameServer' (call, data) {
    let premise
    if (call.localApiKey === data.apiKey) {
      premise = Promise.resolve(true)
    } else {
      premise = this._persist.isApiKeyValid(data.register.apiKey)
    }
    const gamesList = []
    Object.keys(data.games).forEach(key => gamesList.push(data.games[key].torrent.infoHash))
    return premise
      .then(trusted => this._sessionManager.setSessionData(call, { trusted: trusted }))
      .then(data => {
        const id = this._sessionManager.getId(call)
        call.trusted = data.trusted
        call.write({
          registered: {
            trusted: call.trusted
          }
        })
        if (data.trusted) {
          return this._persist.registerGameServer(id, gamesList)
        }
      })
  }
}

class LobbyHandlers {
  constructor ({ persist, sessionManager }) {
    this._sessionManager = sessionManager
    this._persist = persist
  }

  'PapanLobby.JoinLobby' (call, data) {
    return Promise.reject(Error('unimplemented'))
  }
}

const Subscribe = (persist, options, sessionManager, call, dispatcher) => {
  const id = sessionManager.getId(call)
  call.localApiKey = options.localApiKey
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  const sub = persist.gameServerSubscribe(id, call.write)
  call.on('error', error => {
    console.log(error)
  })
  call.on('end', () => {
    sub.close()
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

exports.generateService = ({ proto, persist, sessionManager, options }) => {
  const subscribeDispatcher = dispatcher(proto.GameAction.fields, new SubscribeHandlers({ persist: persist, sessionManager: sessionManager }))
  const lobbyDispatcher = dispatcher(proto.GameLobbyAction.fields, new LobbyHandlers({ persist: persist, sessionManager: sessionManager }))
  return {
    Subscribe: call => Subscribe(persist, options, sessionManager, call, subscribeDispatcher),
    Lobby: call => Lobby(call, lobbyDispatcher)
  }
}
