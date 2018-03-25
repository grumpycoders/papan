'use strict'

const EventEmitter = require('events')
const natUPNP = require('nat-upnp').createClient()
const ip = require('ip')
const Client = require('./client.js')
let natRefreshInterval

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
      if (data.connectLocal && !this.localLobbyServer) {
        this.setLobbyConnectionStatus('STARTINGLOBBY')
        premise = require('./server.js').registerServer()
        .then(server => {
          this.localLobbyServer = server
          const setMapping = () => {
            natUPNP.portMapping({
              public: 9999,
              private: 9999,
              ttl: 600
            }, err => {
              console.log(err)
              natUPNP.externalIp((err, result) => {
                let myIP = result
                if (err) {
                  myIP = ip.address()
                }
                channel.send('localServerIP', { ip: myIP })
              })
            })
          }
          setMapping()
          natRefreshInterval = setInterval(setMapping, 300000)
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

    const clientToServerMessage = [
      'join',
      'setName',
      'setPublic',
      'getJoinedLobbies'
    ]
    clientToServerMessage.forEach(message => {
      channel.on(message, this.connectedCall(data => {
        this.client[message](data)
      }))
    })

    const serverToClientMessages = [
      'subscribed',
      'error',
      'info',
      'userJoined',
      'joinedLobbies'
    ]
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
    if (this.client) this.client.close()
    if (this.localLobbyServer) {
      this.localLobbyServer.tryShutdown(callback)
      clearInterval(natRefreshInterval)
      natUPNP.portUnmapping({
        public: 9999
      })
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
