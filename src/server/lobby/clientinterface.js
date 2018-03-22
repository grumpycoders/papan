'use strict'

const EventEmitter = require('events')
const lobbyClient = require('./client.js')

class ClientInterface extends EventEmitter {
  constructor (channel) {
    super()

    this.channel = channel
    this.lobbyConnectionStatus = 'NOTCONNECTED'
    this.localLobbyServer = null

    channel.on('GetLobbyConnectionStatus', data => {
      this.sendLobbyConnectionStatus()
    })

    channel.on('ConnectToLobbyServer', data => {
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
      .then(() => lobbyClient.CreateClient(this, data))
      .then(createdClient => {
        this.emit('CreatedClient', createdClient)
        this.client = createdClient
      })
    })

    channel.on('CreateLobby', this.connectedCall(data => {
      this.client.createLobby(data)
    }))
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
    this.channel.send('LobbyConnectionStatus', { status: this.lobbyConnectionStatus })
  }

  sendError (message) {
    this.channel.send('Error', { message: message })
  }

  lobbyCreated (data) {
    this.channel.send('LobbyCreated', { lobbyCreated: data })
  }
}

exports.ClientInterface = ClientInterface
