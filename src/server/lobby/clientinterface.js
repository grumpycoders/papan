'use strict'

const EventEmitter = require('events')
const deepclone = require('deepclone')
const deepmerge = require('deepmerge')
const natUPNP = require('./patch/nat-upnp.js').createClient()
const ip = require('ip')
const Client = require('./client.js')
const createSerializer = require('../../common/serializer.js').createSerializer
const protoLoader = require('../common/proto.js').load
const Queuer = require('../../common/utils.js').Queuer
const PapanServerUtils = require('../common/utils.js')

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
      const options = deepclone(message)
      if (this.getLobbyConnectionStatus() !== 'NOTCONNECTED') {
        return
      }
      let premise
      if (options.connectLocal && !this.localLobbyServer) {
        let localApiKey
        this.setLobbyConnectionStatus('STARTINGLOBBY')
        premise = PapanServerUtils.generateToken()
        .then(token => {
          localApiKey = token
          return Promise.all([
            require('./server.js').registerServer({ localApiKey: localApiKey }),
            require('../game/games-list.js').getGamesList()
          ])
        })
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
          return require('../game/client.js').createClient(this.gamesList, deepmerge(options, { apiKey: localApiKey }))
        })
        .then(gameClient => {
          this.gameClient = gameClient
          return new Promise((resolve, reject) => {
            gameClient.on('ClientConnected', () => {
              resolve()
            })
          })
        })
      } else {
        premise = Promise.resolve()
      }
      premise
      .then(() => Client.createClient(this, options))
      .then(createdClient => {
        this.emit('CreatedClient', createdClient)
        this.client = createdClient
      })
    })

    this.protoPromise
    .then(proto => {
      const getTypes = fields => Object.keys(fields).map(field => 'ProtoLobby.' + fields[field].type)
      const actionMsgs = ['Action', 'LobbyAction']
      const updateMsgs = ['Update', 'LobbyUpdate']
      const actionsArray = actionMsgs.map(msg => getTypes(proto.rootProto.PapanLobby[msg].fields))
      const updatesArray = updateMsgs.map(msg => getTypes(proto.rootProto.PapanLobby[msg].fields))
      const reduce = (array, initial = []) => array.reduce((result, array) => {
        const duplicate = array.reduce((result, msg) => array.includes(msg) ? msg : result)
        if (duplicate) {
          throw Error('Duplicated message ' + duplicate)
        }
        return result + array
      }, initial)
      const actions = reduce(actionsArray, [
        'PapanLobby.StartWatchingLobbies',
        'PapanLobby.StopWatchingLobbies'
      ])
      const updates = reduce(updatesArray)

      actions.forEach(type => {
        this.channel.on(type, this.connectedCall((message, metadata) => {
          this.client[type](message, metadata)
        }))
      })

      updates.forEach(type => {
        if (this[type]) return
        this[type] = (message = {}, metadata = {}) => this.channel.send(type, message, metadata)
      })

      this.emit('ready')
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
    if (this.gameClient) this.gameClient.close()
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
