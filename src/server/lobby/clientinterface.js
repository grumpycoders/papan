'use strict'

const EventEmitter = require('events')
const Client = require('./client.js')

class ClientInterface extends EventEmitter {
  constructor (channel) {
    super()

    this.channel = channel
    this.lobbyConnectionStatus = 'NOTCONNECTED'
    this.localLobbyServer = null

    channel.on('getLobbyConnectionStatus', data => {
      this.sendLobbyConnectionStatus()
    })

    channel.on('connectToLobbyServer', data => {
      if (this.getLobbyConnectionStatus() !== 'NOTCONNECTED') {
        return
      }
      let premise
      if (data.connectLocal) {
        this.setLobbyConnectionStatus('STARTINGLOBBY')
        premise = require('./server.js').registerServer()
        .then(server => {
          this.localLobbyServer = server
        })
      } else {
        premise = Promise.resolve()
      }
      premise
      .then(() => Client.CreateClient(this, data))
      .then(createdClient => {
        this.emit('CreatedClient', createdClient)
        this.client = createdClient
      })
    })

    const clientToServerMessage = ['joinLobby', 'setName']
    clientToServerMessage.forEach(message => {
      channel.on(message, this.connectedCall(data => {
        this.client[message](data)
      }))
    })

    const serverToClientMessages = ['subscribed', 'error', 'lobbyInfo', 'userJoined']
    serverToClientMessages.forEach(message => {
      this[message] = data => this.channel.send(message, data)
    })
  }

  connectedCall (callback) {
    return data => {
      if (this.getLobbyConnectionStatus() !== 'CONNECTED' || !this.client) {
        return
      }

      callback(data)
    }
  }

  close () {
    if (this.client) this.client.close()
    this.client = null
  }

  shutdown (callback) {
    if (this.localLobbyServer) {
      this.lobbyConnectionStatus.tryShutdown(callback)
    } else {
      setImmediate(callback)
    }
  }

  getLobbyConnectionStatus () {
    return this.lobbyConnectionStatus
  }

  setLobbyConnectionStatus (status) {
    this.lobbyConnectionStatus = status
    this.sendLobbyConnectionStatus()
  }

  sendLobbyConnectionStatus () {
    this.channel.send('lobbyConnectionStatus', { status: this.lobbyConnectionStatus })
  }
}

exports.ClientInterface = ClientInterface
