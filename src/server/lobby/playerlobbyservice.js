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

  async 'PapanLobby.GetJoinedLobbies' (call, data) {
    const id = this._sessionManager.getId(call)
    const lobbies = await this._persist.getJoinedLobbies({ id: id })
    call.write({
      joinedLobbies: {
        lobbies: lobbies
      }
    })
  }
}

class LobbyHandlers {
  constructor ({ persist, sessionManager }) {
    this._sessionManager = sessionManager
    this._persist = persist
  }

  async 'PapanLobby.JoinLobby' (call, data) {
    const userId = this._sessionManager.getId(call)
    let id = data.id
    let lobbyInfo
    if (id) {
      lobbyInfo = await this._persist.joinLobby({
        userId: userId,
        id: id
      })
    } else {
      lobbyInfo = await this._persist.createLobby({
        userId: userId
      })
    }
    id = lobbyInfo.id
    call.id = id
    const sub = this._persist.lobbySubscribe(id, call.write.bind(call))
    call.on('end', sub.close.bind(sub))
    call.write({
      info: lobbyInfo
    })
    this._persist.lobbySendMessage(id, {
      userJoined: {
        id: userId
      }
    })
  }

  async 'PapanLobby.SetLobbyName' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await this._persist.setLobbyName({
      userId: userId,
      id: call.id,
      name: data.name
    })
    this._persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.SetLobbyPublic' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await this._persist.setLobbyPublic({
      userId: userId,
      id: call.id,
      public: data.public
    })
    this._persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.SetLobbyGame' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await this._persist.setLobbyGame({
      userId: userId,
      id: call.id,
      gameInfo: data.info
    })
    this._persist.lobbySendMessage(call.id, {
      info: lobbyInfo
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

  'PapanLobby.StartGame' (call, data) {
    this._persist.getLobbyInfo({ id: call.id }).then(info => {
      this._persist.lobbySendMessage(call.id, { gameStarted: { info: info } })
      this._persist.sendGameMessage(call.id, { gameStarted: { info: info } })
    })
  }

  async 'PapanLobby.AssignSlot' (call, data) {
    const lobbyInfo = await this._persist.assignSlot({
      lobbyId: call.id,
      userId: data.user ? data.user.id : undefined,
      senderId: this._sessionManager.getId(call),
      team: data.team,
      slotId: data.slotId
    })
    this._persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.RequestFullUpdate' (call, data) {
    return Promise.reject(Error('Unimplemented'))
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
