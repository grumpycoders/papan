'use strict'

const grpc = require('grpc')
const dispatcher = require('../common/dispatcher.js')
const Persist = require('./persist.js')

class SubscribeHandlers {
  constructor ({ sessionManager }) {
    this._sessionManager = sessionManager
  }

  async 'PapanLobby.RegisterGameServer' (call, data) {
    const trusted = call.localApiKey === data.apiKey || await call.persist.isApiKeyValid(data.register.apiKey)
    const gamesList = []
    Object.keys(data.games).forEach(key => gamesList.push(data.games[key].torrent.infoHash))
    const sessionData = await this._sessionManager.setSessionData(call, { trusted: trusted })
    const id = this._sessionManager.getId(call)
    call.trusted = sessionData.trusted
    call.write({
      registered: {
        trusted: call.trusted
      }
    })
    if (trusted) {
      await call.persist.registerGameServer(id, gamesList)
    }
  }
}

class LobbyHandlers {
  constructor ({ sessionManager }) {
    this._sessionManager = sessionManager
  }

  'PapanLobby.JoinLobby' (call, data) {
    call.id = data.id
    call.persist.gameServerSubscribe(data.id, message => {
      call.write(message)
    })
  }

  'PapanLobby.PublicScene' (call, data) {
    call.persist.lobbySendMessage(call.id, { publicScene: data })
  }
}

const Subscribe = (options, sessionManager, call, dispatcher) => {
  call.persist = Persist.createPersist()
  const id = sessionManager.getId(call)
  call.localApiKey = options.localApiKey
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  const sub = call.persist.gameServerSubscribe(id, call.write)
  call.on('error', error => {
    console.log(error)
  })
  call.on('end', () => {
    sub.close()
    call.persist.close()
    call.end()
  })
  call.on('data', data => dispatcher(call, data))
}

const Lobby = (call, dispatcher) => {
  call.persist = Persist.createPersist()
  let gotJoin = false
  call.on('end', () => {
    call.persist.close()
    call.end()
  })
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
    } else {
      dispatcher(call, data)
    }
  })
}

exports.generateService = ({ proto, sessionManager, options }) => {
  const subscribeDispatcher = dispatcher(proto.GameAction, new SubscribeHandlers({ sessionManager: sessionManager }))
  const lobbyDispatcher = dispatcher(proto.GameLobbyAction, new LobbyHandlers({ sessionManager: sessionManager }))
  return {
    Subscribe: call => Subscribe(options, sessionManager, call, subscribeDispatcher),
    Lobby: call => Lobby(call, lobbyDispatcher)
  }
}
