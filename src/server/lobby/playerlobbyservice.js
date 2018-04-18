'use strict'

const grpc = require('grpc')
const deepclone = require('deepclone')
const persist = require('./persist.js')
const authsession = require('./authsession.js')
const dispatcher = require('./dispatcher.js')

class SubscribeHandlers {
  'PapanLobby.WhisperChatMessage' (call, data) {
    const id = authsession.getId(call)
    const message = deepclone(data)
    message.id = id
    persist.sendMessage(data.id, { message: message })
  }

  'PapanLobby.GetJoinedLobbies' (call, data) {
    const id = authsession.getId(call)
    return persist.getJoinedLobbies({ id: id })
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
  'PapanLobby.JoinLobby' (call, data) {
    const userId = authsession.getId(call)
    let id = data.id
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
    return premise
    .then(result => {
      id = result.id
      call.id = id
      const sub = persist.lobbySubscribe(id, call.write.bind(call))
      call.on('end', sub.close.bind(sub))
      call.write({
        info: result
      })
      persist.lobbySendMessage(id, {
        userJoined: {
          id: userId
        }
      })
    })
  }

  'PapanLobby.SetLobbyName' (call, data) {
    const userId = authsession.getId(call)
    return persist.setLobbyName({
      userId: userId,
      id: call.id,
      name: data.name
    })
    .then(result => {
      persist.lobbySendMessage(call.id, {
        info: result
      })
    })
  }

  'PapanLobby.SetLobbyPublic' (call, data) {
    const userId = authsession.getId(call)
    return persist.setLobbyPublic({
      userId: userId,
      id: call.id,
      public: data.public
    }).then(result => {
      persist.lobbySendMessage(call.id, {
        info: result
      })
    })
  }

  'PapanLobby.SetLobbyGame' (call, data) {
    const userId = authsession.getId(call)
    return persist.setLobbyGame({
      userId: userId,
      id: call.id,
      gameInfo: data.info
    }).then(result => {
      persist.lobbySendMessage(call.id, {
        info: result
      })
    })
  }

  'PapanLobby.LobbyChatMessage' (call, data) {
    data.message.user = { id: authsession.getId(call) }
    persist.lobbySendMessage(call.id, { message: data })
  }

  'PapanLobby.LeaveLobby' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.SetReady' (call, data) { return Promise.reject(Error('Unimplemented')) }
  'PapanLobby.KickUser' (call, data) { return Promise.reject(Error('Unimplemented')) }
}

const Subscribe = (call, dispatcher) => {
  const id = authsession.getId(call)
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

const Lobby = (call, dispatcher) => {
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

exports.generateService = (proto, options) => {
  const subscribeDispatcher = dispatcher(proto.Action.fields, new SubscribeHandlers())
  const lobbyDispatcher = dispatcher(proto.LobbyAction.fields, new LobbyHandlers())
  return {
    Subscribe: call => Subscribe(call, subscribeDispatcher),
    Lobby: call => Lobby(call, lobbyDispatcher),
    ListLobbies: ListLobbies
  }
}
