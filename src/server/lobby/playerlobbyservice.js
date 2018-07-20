'use strict'

const grpc = require('grpc')
const deepclone = require('deepclone')
const dispatcher = require('../common/dispatcher.js')
const PapanServerUtils = require('../common/utils.js')
const Persist = require('./persist.js')

class SubscribeHandlers {
  constructor ({ sessionManager }) {
    this._sessionManager = sessionManager
  }

  'PapanLobby.WhisperChatMessage' (call, data) {
    const id = this._sessionManager.getId(call)
    const message = deepclone(data)
    message.id = id
    call.persist.sendUserMessage(data.id, { message: message })
  }

  async 'PapanLobby.GetJoinedLobbies' (call, data) {
    const id = this._sessionManager.getId(call)
    const lobbies = await call.persist.getJoinedLobbies({ id: id })
    call.write({
      joinedLobbies: {
        lobbies: lobbies
      }
    })
  }
}

class LobbyHandlers {
  constructor ({ sessionManager }) {
    this._sessionManager = sessionManager
  }

  async 'PapanLobby.JoinLobby' (call, data) {
    const userId = this._sessionManager.getId(call)
    let id = data.id
    let lobbyInfo
    if (id) {
      lobbyInfo = await call.persist.joinLobby({
        userId: userId,
        id: id
      })
    } else {
      lobbyInfo = await call.persist.createLobby({
        userId: userId
      })
    }
    id = lobbyInfo.id
    call.id = id
    const sub = call.persist.lobbySubscribe(id, call.write.bind(call))
    call.on('end', () => {
      sub.close()
      call.persist.close()
      call.end()
    })
    call.write({
      info: lobbyInfo
    })
    call.persist.lobbySendMessage(id, {
      userJoined: {
        id: userId
      }
    })
  }

  async 'PapanLobby.SetLobbyName' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await call.persist.setLobbyName({
      userId: userId,
      id: call.id,
      name: data.name
    })
    call.persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.SetLobbyPublic' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await call.persist.setLobbyPublic({
      userId: userId,
      id: call.id,
      public: data.public
    })
    call.persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.SetLobbyGame' (call, data) {
    const userId = this._sessionManager.getId(call)
    const lobbyInfo = await call.persist.setLobbyGame({
      userId: userId,
      id: call.id,
      gameInfo: data.info
    })
    call.persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  'PapanLobby.LobbyChatMessage' (call, data) {
    data.message.user = { id: this._sessionManager.getId(call) }
    call.persist.lobbySendMessage(call.id, { message: data })
  }

  'PapanLobby.RequestGameInfo' (call, data) {
    call.persist.lobbySendMessage(call.id, { requestGameInfo: data })
  }

  'PapanLobby.SendGameInfo' (call, data) {
    call.persist.lobbySendMessage(call.id, { gameInfo: data })
  }

  async 'PapanLobby.StartGame' (call, data) {
    const info = await call.persist.getLobbyInfo({ id: call.id })
    if (info.owner.id !== this._sessionManager.getId(call)) return
    const seed = await PapanServerUtils.generateToken({ prefix: 'SEED' })
    const gameId = await call.persist.lobbyStartNewGame({ id: call.id, seed: seed })
    if (!gameId) return
    call.persist.lobbySendMessage(call.id, { gameStarted: { info: info, gameId: gameId } })
    call.persist.sendGameMessage(call.id, { gameStarted: { info: info, gameId: gameId, seed: seed } })
  }

  async 'PapanLobby.AssignSlot' (call, data) {
    const lobbyInfo = await call.persist.assignSlot({
      lobbyId: call.id,
      userId: data.user ? data.user.id : undefined,
      senderId: this._sessionManager.getId(call),
      team: data.team,
      slotId: data.slotId
    })
    call.persist.lobbySendMessage(call.id, {
      info: lobbyInfo
    })
  }

  async 'PapanLobby.RequestFullUpdate' (call, data) {
    return Promise.reject(Error('Unimplemented'))
  }

  'PapanLobby.SceneAction' (call, data) {
    call.persist.sendGameMessage(call.id, {
      sceneAction: {
        message: data.message,
        sender: {
          id: this._sessionManager.getId(call)
        }
      }
    })
  }

  'PapanLobby.LeaveLobby' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.SetReady' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.KickUser' (call, data) { return Promise.reject(Error('Unimplemented')) }
}

const Subscribe = (sessionManager, call, dispatcher) => {
  call.persist = Persist.createPersist()
  const id = sessionManager.getId(call)
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  const sub = call.persist.userSubscribe(id, call.write)
  call.on('data', data => dispatcher(call, data))
  call.on('end', () => {
    call.persist.close()
    sub.close()
    call.end()
  })
}

const Lobby = (call, dispatcher) => {
  call.persist = Persist.createPersist()
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

const ListLobbies = call => {
  const persist = Persist.createPersist()
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
    persist.close()
    call.end()
  })
}

exports.generateService = ({ proto, sessionManager, options }) => {
  const subscribeDispatcher = dispatcher(proto.Action, new SubscribeHandlers({ sessionManager: sessionManager }))
  const lobbyDispatcher = dispatcher(proto.LobbyAction, new LobbyHandlers({ sessionManager: sessionManager }))
  return {
    Subscribe: call => Subscribe(sessionManager, call, subscribeDispatcher),
    Lobby: call => Lobby(call, lobbyDispatcher),
    ListLobbies: call => ListLobbies(call)
  }
}
