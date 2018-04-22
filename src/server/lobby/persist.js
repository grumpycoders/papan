const optionDefinitions = [
  { name: 'use_redis_mock', type: Boolean },
  { name: 'use_redis_server', type: Boolean }
]
const commandline = require('command-line-args')
const deepmerge = require('deepmerge')
const RedisSessions = require('redis-sessions')
const argv = commandline(optionDefinitions, { partial: true, argv: process.argv })

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')
const protoLoader = require('../common/proto.js')
const createSerializer = require('../../common/serializer.js').createSerializer

class PersistClient {
  constructor ({ proto, rs, client, redis }) {
    this._redis = redis
    this._rs = rs
    this._client = client
    this._promised = PapanServerUtils.promisifyClass(client)
    this._serializer = createSerializer(proto.rootProto)
  }

  createSession (userId) {
    return new Promise((resolve, reject) => {
      this._rs.create({
        app: 'papan',
        id: userId,
        ip: '1'
      }, (err, resp) => {
        if (err) reject(err)
        resolve(resp.token)
      })
    })
  }

  getIdFromSession (session) {
    return new Promise((resolve, reject) => {
      this._rs.get({
        app: 'papan',
        token: session
      }, (err, resp) => {
        if (err) reject(err)
        if (!resp.id) reject(Error('Empty session'))
        resolve(resp.id)
      })
    })
  }

  getSessionData (session) {
    return new Promise((resolve, reject) => {
      this._rs.get({
        app: 'papan',
        token: session
      }, (err, resp) => {
        if (err) reject(err)
        if (!resp.id) reject(Error('Empty session'))
        resolve(resp.d)
      })
    })
  }

  setSessionData (session, data) {
    return new Promise((resolve, reject) => {
      this._rs.set({
        app: 'papan',
        token: session,
        d: data
      }, (err, resp) => {
        if (err) reject(err)
        if (!resp.id) reject(Error('Empty session'))
        resolve(resp.d)
      })
    })
  }

  userSubscribe (userId, callback) {
    const subscriber = this._redis.createClient()
    const key = 'usersub:' + userId
    subscriber.subscribe(key)
    subscriber.on('message', (channel, message) => {
      if (channel === key) {
        callback(PapanUtils.JSON.parse(message))
      }
    })

    const ret = {
      subscriber: subscriber,
      close: () => subscriber.unsubscribe(key)
    }
    return ret
  }

  sendMessage (userId, message) {
    this._client.publish('usersub:' + userId, PapanUtils.JSON.stringify(message))
  }

  getJoinedLobbies (data) {
    const { id } = data
    return this._promised.smembers('user:' + id + ':lobbies')
      .then(results => {
        if (!results) results = []
        return Promise.all(results.map(id => this.getLobbyInfo({ id: id })))
      })
  }

  getLobbyInfo (data) {
    const { id } = data
    let members
    return this._promised.smembers('lobbymembers:' + id)
      .then(results => {
        members = results.map(id => ({ id: id }))
        return this._promised.hgetall('lobbyinfo:' + id)
      })
      .then(results => {
        if (!results.owner) return Promise.reject(Error('Lobby doesn\'t exist'))
        return {
          id: id,
          owner: {
            id: results.owner
          },
          members: members,
          name: results.name,
          public: results.public,
          gameInfo: results.gameInfo ? this._serializer.deserialize('Papan.GameInfo', Buffer.from(results.gameInfo, 'base64')) : results.gameInfo
        }
      })
  }

  createLobby (data) {
    let id
    const { userId } = data
    return PapanServerUtils.generateToken()
      .then(token => {
        id = token
        return this._promised.hsetnx('lobbyinfo:' + id, 'owner', userId)
      })
      .then(result => {
        if (result === 0) return this.createLobby(data)
        return this._promised.sadd('lobbymembers:' + id, userId)
      })
      .then(() => this._promised.sadd('user:' + userId + ':lobbies', id))
      .then(() => this.getLobbyInfo({ id: id }))
  }

  joinLobby (data) {
    const { userId, id } = data
    return this._promised.hget('lobbyinfo:' + id, 'owner')
      .then(result => {
        if (result === null) Promise.reject(Error('Lobby doesn\'t exist'))
        return this._promised.sadd('lobbymembers:' + id, userId)
      })
      .then(() => this._promised.sadd('user:' + userId + ':lobbies', id))
      .then(() => this.getLobbyInfo({ id: id }))
  }

  _setLobbyField (data) {
    const { id, userId, field } = data
    const key = 'lobbyinfo:' + id
    return this._promised.hget(key, 'owner')
      .then(result => {
        if (result === null) return Promise.reject(Error('Lobby doesn\'t exist'))
        let info = this.getLobbyInfo({ id: id })
        if (userId !== result) {
          return info
        } else {
          return this._promised.hset(key, field, data[field])
            .then(() => info)
        }
      })
  }

  setLobbyName (data) {
    return this._setLobbyField(deepmerge(data, { field: 'name' }))
  }

  setLobbyPublic (data) {
    return this._setLobbyField(deepmerge(data, { field: 'public' }))
      .then(info => {
        let ret
        if (data.public) {
          ret = this._promised.sadd('publiclobbies', data.id)
          this._client.publish('publiclobbies', PapanUtils.JSON.stringify({
            id: data.id,
            status: 'ADDED'
          }))
        } else {
          ret = this._promised.srem('publiclobbies', data.id)
          this._client.publish('publiclobbies', PapanUtils.JSON.stringify({
            id: data.id,
            status: 'REMOVED'
          }))
        }
        return ret.then(() => info)
      })
  }

  setLobbyGame ({ userId, id, gameInfo }) {
    return this._setLobbyField({
      userId: userId,
      id: id,
      gameInfo: this._serializer.serialize('Papan.GameInfo', gameInfo).toString('base64'),
      field: 'gameInfo'
    })
  }

  lobbySubscribe (id, callback) {
    const subscriber = this._redis.createClient()
    const key = 'lobbysub:' + id
    subscriber.subscribe(key)
    subscriber.on('message', (channel, message) => {
      if (channel === key) {
        callback(PapanUtils.JSON.parse(message))
      }
    })

    const ret = {
      subscriber: subscriber,
      close: () => subscriber.unsubscribe(key)
    }
    return ret
  }

  lobbySendMessage (id, message) {
    this._client.publish('lobbysub:' + id, PapanUtils.JSON.stringify(message))
  }

  getPublicLobbies () {
    return this._promised.smembers('publiclobbies')
  }

  lobbyListSubscribe (callback) {
    const subscriber = this._redis.createClient()
    const key = 'publiclobbies'
    subscriber.subscribe(key)
    subscriber.on('message', (channel, message) => {
      const data = PapanUtils.JSON.parse(message)
      if (data.status === 0) {
        this.getLobbyInfo({ id: data.id })
          .then(info => {
            data.lobby = info
            callback(data)
          })
      } else {
        data.lobby = { id: data.id }
        callback(data)
      }
    })

    const ret = {
      subscriber: subscriber,
      close: () => subscriber.unsubscribe(key)
    }
    return ret
  }

  isApiKeyValid (apiKey) {
    return Promise.resolve(false)
  }
}

exports.createPersist = () => {
  let mock
  if (!argv.use_redis_mock && !argv.use_redis_server) {
    mock = PapanUtils.isElectron()
  } else {
    if (argv.use_redis_mock && argv.use_redis_server) {
      throw Error('You can\'t have both --use_redis_mock and --use_redis_server')
    }
    mock = argv.use_redis_mock
  }

  const redis = mock ? require('redis-mock') : require('redis')
  const client = redis.createClient()
  const rs = new RedisSessions({ client: client })

  return protoLoader.load('lobby.proto')
    .then(proto => new PersistClient({ proto: proto, rs: rs, client: client, redis: redis }))
}
