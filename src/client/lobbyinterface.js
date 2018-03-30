'use strict'

const channel = this.channel

class Lobby extends this.EventEmitter {
  constructor (info) {
    super()

    this.info = info
    this.isOwner = this.lobbyInterface.getUserInfo().id === info.owner.id
  }

  update (info) {
    this.info = info
    this.emit('update', this)
  }

  getInfo () {
    return this.info
  }

  isOwner () {
    return this.isOwner
  }

  setPublic (pub) {
    if (this.isowner) {
      channel.send('setPublic', {
        id: this.info.id,
        public: pub
      })
    }
  }

  setName (name) {
    if (this.isowner) {
      channel.send('setName', {
        id: this.info.id,
        name: name
      })
    }
  }
}

class LobbyInterface extends this.EventEmitter {
  constructor () {
    super()

    this.status = 'UNKNOWN'
    this.lobbyList = {}
    this.publicLobbyList = {}
    channel.send('getLobbyConnectionStatus')
    channel.on('subscribed', data => {
      this.userInfo = data.self
      this.emit('connected')
    })
    channel.on('error', data => {
      this.emit('error', data.error)
    })
    channel.on('lobbyConnectionStatus', data => {
      this.status = data.status
      this.emit('status', data.status)
    })
    channel.on('info', data => {
      const id = data.id
      if (this.publicLobbyList[id]) {
        const data = this.publicLobbyList[id]
        delete this.publicLobbyList[id]
        this.emit('publicLobbyRemove', data)
      }
      if (this.lobbyList[id]) {
        this.lobbyList[id].update(data)
      } else {
        this.lobbyList[id] = new Lobby(data)
        this.emit('lobbyJoin', this.lobbyList[id])
      }
    })
    channel.on('publicLobbyUpdate', data => {
      const id = data.lobby.id
      if (data.status === 'ADDED' && !this.lobbyList[id]) {
        if (this.publicLobbyList[id]) {
          this.emit('publicLobbyUpdate', data.lobby)
        } else {
          this.emit('publicLobbyAdd', data.lobby)
        }
        this.publicLobbyList[id] = data.lobby
      } else {
        this.emit('publicLobbyRemove', data.lobby)
        delete this.publicLobbyList[id]
      }
    })
  }

  getStatus () { return this.status }
  getUserInfo () { return this.userInfo }
  startWatchingLobbies () { channel.send('startWatchingLobbies') }
  stopWatchingLobbies () { channel.send('stopWatchingLobbies') }
  connectToLobbyServer (serverInfo) { channel.send('connectToLobbyServer', serverInfo) }
  createLobby () { channel.send('join') }
  joinLobby (id) { channel.send('join', { id: id }) }
}

this.lobbyInterface = new LobbyInterface()
