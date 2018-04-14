'use strict'

const grpc = require('grpc')
const deepclone = require('deepclone')
const persist = require('./persist.js')
const authsession = require('./authsession.js')

const Subscribe = call => {
  const id = authsession.getId(call)
  call.write({
    subscribed: {
      self: {
        id: id
      }
    }
  })
  const sub = persist.userSubscribe(id, message => {
    call.write(message)
  })
  call.on('data', data => {
    let runningPromise
    switch (data.action) {
      case 'message':
        let message = deepclone(data)
        message.message.id = id
        persist.sendMessage(data.id, message)
        break
      case 'getJoinedLobbies':
        runningPromise = persist.getJoinedLobbies({ id: id })
        .then(result => {
          call.write({
            joinedLobbies: {
              lobbies: result
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
  call.on('end', () => {
    sub.close()
    call.end()
  })
}

const Lobby = call => {
  const userId = authsession.getId(call)
  let gotJoin = false
  let id
  let sub
  let runningPromise
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
      return
    }
    switch (data.action) {
      case 'join':
        id = data.join.id
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
        runningPromise = premise
        .then(result => {
          id = result.id
          sub = persist.lobbySubscribe(id, message => {
            call.write(message)
          })
          call.on('end', () => sub.close())
          call.write({
            info: result
          })
          persist.lobbySendMessage(id, {
            userJoined: {
              id: userId
            }
          })
        })
        break
      case 'setName':
        runningPromise = persist.setLobbyName({
          userId: userId,
          id: id,
          name: data.setName.name
        })
        .then(result => {
          persist.lobbySendMessage({
            info: result
          })
        })
        break
      case 'setPublic':
        runningPromise = persist.setLobbyPublic({
          userId: userId,
          id: id,
          public: data.setPublic.public
        }).then(result => {
          persist.lobbySendMessage({
            info: result
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

const ListLobbies = call => {
  const sub = persist.lobbyListSubscribe(data => {
    call.write(data)
  })
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

exports.generateService = options => ({
  Subscribe: Subscribe,
  Lobby: Lobby,
  ListLobbies: ListLobbies
})
