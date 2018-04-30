'use strict'

const grpc = require('grpc')
const deepclone = require('deepclone')
const dispatcher = require('./dispatcher.js')

class SubscribeHandlers {
  constructor ({ persist, sessionManager }) {
    this._sessionManager = sessionManager
    this._persist = persist
  }

  'PapanLobby.WhisperChatMessage' (call, data) {
    const id = this._sessionManager.getId(call)
    const message = deepclone(data)
    message.id = id
    this._persist.sendUserMessage(data.id, { message: message })
  }

  'PapanLobby.GetJoinedLobbies' (call, data) {
    const id = this._sessionManager.getId(call)
    return this._persist.getJoinedLobbies({ id: id })
      .then(result => {
        call.write({
          joinedLobbies: {
            lobbies: result
          }
        })
      })
  }
}

class LobbyHandlers {
  constructor ({ persist, sessionManager }) {
    this._sessionManager = sessionManager
    this._persist = persist
  }

  'PapanLobby.JoinLobby' (call, data) {
    const userId = this._sessionManager.getId(call)
    let id = data.id
    let premise
    if (id) {
      premise = this._persist.joinLobby({
        userId: userId,
        id: id
      })
    } else {
      premise = this._persist.createLobby({
        userId: userId
      })
    }
    return premise
      .then(result => {
        id = result.id
        call.id = id
        const sub = this._persist.lobbySubscribe(id, call.write.bind(call))
        call.on('end', sub.close.bind(sub))
        call.write({
          info: result
        })
        this._persist.lobbySendMessage(id, {
          userJoined: {
            id: userId
          }
        })
      })
  }

  'PapanLobby.SetLobbyName' (call, data) {
    const userId = this._sessionManager.getId(call)
    return this._persist.setLobbyName({
      userId: userId,
      id: call.id,
      name: data.name
    })
      .then(result => {
        this._persist.lobbySendMessage(call.id, {
          info: result
        })
      })
  }

  'PapanLobby.SetLobbyPublic' (call, data) {
    const userId = this._sessionManager.getId(call)
    return this._persist.setLobbyPublic({
      userId: userId,
      id: call.id,
      public: data.public
    }).then(result => {
      this._persist.lobbySendMessage(call.id, {
        info: result
      })
    })
  }

  'PapanLobby.SetLobbyGame' (call, data) {
    const userId = this._sessionManager.getId(call)
    return this._persist.setLobbyGame({
      userId: userId,
      id: call.id,
      gameInfo: data.info
    }).then(result => {
      this._persist.lobbySendMessage(call.id, {
        info: result
      })
    })
  }

  'PapanLobby.LobbyChatMessage' (call, data) {
    data.message.user = { id: this._sessionManager.getId(call) }
    this._persist.lobbySendMessage(call.id, { message: data })
  }

  'PapanLobby.RequestGameInfo' (call, data) {
    this._persist.lobbySendMessage(call.id, { requestGameInfo: data })
  }

  'PapanLobby.SendGameInfo' (call, data) {
    this._persist.lobbySendMessage(call.id, { gameInfo: data })
  }

  'PapanLobby.SetGameSettings' (call, data) {
    console.log(data)
  }

  'PapanLobby.StartGame' (call, data) {
    console.log(data)
  }

  'PapanLobby.LeaveLobby' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.SetReady' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.KickUser' (call, data) { return Promise.reject(Error('Unimplemented')) }
}

const Subscribe = (persist, sessionManager, call, dispatcher) => {
  const id = sessionManager.getId(call)
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  const sub = persist.userSubscribe(id, call.write)
  call.on('data', data => dispatcher(call, data))
  call.on('end', () => {
    sub.close()
    call.end()
  })
}

const Lobby = (persist, call, dispatcher) => {
  let gotJoin = false
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
    } else {
      dispatcher(call, data)
    }
  })
}

const ListLobbies = (persist, call) => {
  const sub = persist.lobbyListSubscribe(call.write.bind(call))
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

exports.generateService = ({ proto, persist, sessionManager, options }) => {
  const subscribeDispatcher = dispatcher(proto.Action.fields, new SubscribeHandlers({ persist: persist, sessionManager: sessionManager }))
  const lobbyDispatcher = dispatcher(proto.LobbyAction.fields, new LobbyHandlers({ persist: persist, sessionManager: sessionManager }))
  return {
    Subscribe: call => Subscribe(persist, sessionManager, call, subscribeDispatcher),
    Lobby: call => Lobby(persist, call, lobbyDispatcher),
    ListLobbies: call => ListLobbies(persist, call)
  }
}
