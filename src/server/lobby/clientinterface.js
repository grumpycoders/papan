'use strict'

const EventEmitter = require('events')
const natUPNP = require('./patch/nat-upnp.js').createClient()
const ip = require('ip')
const Client = require('./client.js')
const createSerializer = require('../../common/serializer.js').createSerializer
const protoLoader = require('../common/proto.js').load
const Queuer = require('../../common/utils.js').Queuer

let natRefreshInterval

class ClientInterface extends EventEmitter {
  constructor () {
    super()

    this.channel = new Queuer(this)
    this.lobbyConnectionStatus = 'NOTCONNECTED'
    this.localLobbyServer = null

    this.protoPromise = protoLoader(['lobby.proto', 'channel.proto'])

    this.channel.on('PapanChannel.GetLobbyConnectionStatus', () => {
      this.sendLobbyConnectionStatus()
    })

    this.channel.on('PapanChannel.ConnectToLobbyServer', message => {
      if (this.getLobbyConnectionStatus() !== 'NOTCONNECTED') {
        return
      }
      let premise
      if (message.connectLocal && !this.localLobbyServer) {
        this.setLobbyConnectionStatus('STARTINGLOBBY')
        premise = Promise.all([
          require('./server.js').registerServer(),
          require('../game/games-list.js').getGamesList()
        ])
        .then(results => {
          this.localLobbyServer = results[0]
          this.gamesList = results[1]
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
                this.channel.send('PapanChannel.LocalServerIP', { ip: myIP })
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
      .then(() => Client.CreateClient(this, message))
      .then(createdClient => {
        this.emit('CreatedClient', createdClient)
        this.client = createdClient
      })
    })

    const clientToServerMessage = [
      'PapanLobby.JoinLobby',
      'PapanLobby.SetLobbyName',
      'PapanLobby.SetLobbyPublic',
      'PapanLobby.GetJoinedLobbies',
      'PapanLobby.StartWatchingLobbies',
      'PapanLobby.StopWatchingLobbies'
    ]
    clientToServerMessage.forEach(type => {
      this.channel.on(type, this.connectedCall((message, metadata) => {
        this.client[type](message, metadata)
      }))
    })

    const serverToClientMessages = [
      'PapanLobby.Subscribed',
      'PapanLobby.Error',
      'PapanLobby.LobbyInfo',
      'PapanLobby.UserJoined',
      'PapanLobby.JoinedLobbies',
      'PapanLobby.PublicLobbyUpdate'
    ]
    serverToClientMessages.forEach(type => {
      this[type] = (message = {}, metadata = {}) => this.channel.send(type, message, metadata)
    })
  }

  getSerializer () {
    return this.protoPromise
    .then(proto => {
      if (!this.serializer) {
        this.serializer = createSerializer(proto.rootProto)
      }

      return this.serializer
    })
  }

  setChannel (channel) {
    if (this.channel instanceof Queuer) {
      this.channel.spillover(channel)
    } else {
      throw Error('Channel already set')
    }
  }

  connectedCall (callback) {
    return (data, metadata) => {
      if (this.getLobbyConnectionStatus() !== 'CONNECTED' || !this.client) {
        return
      }

      callback(data, metadata)
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
    this.channel.send('PapanChannel.LobbyConnectionStatus', { status: this.lobbyConnectionStatus })
  }
}

exports.ClientInterface = ClientInterface
