const optionDefinitions = [
  { name: 'use_redis_mock', type: Boolean },
  { name: 'use_redis_server', type: Boolean }
]
const commandline = require('command-line-args')
const deepmerge = require('deepmerge')
const argv = commandline(optionDefinitions, { partial: true, argv: process.argv })

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')

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

const promised = PapanServerUtils.promisifyClass(client)

exports.userSubscribe = (userId, callback) => {
  const subscriber = redis.createClient()
  const key = 'usersub:' + userId
  subscriber.subscribe(key)
  subscriber.on('message', (channel, message) => {
    if (channel === key) {
      callback(JSON.parse(message))
    }
  })

  const ret = {
    subscriber: subscriber,
    close: () => subscriber.unsubscribe(key)
  }
  return ret
}

exports.sendMessage = (userId, message) => {
  client.publish('usersub:' + userId, JSON.stringify(message))
}

exports.getJoinedLobbies = data => {
  const { id } = data
  return promised.smembers('user:' + id + ':lobbies')
  .then(results => {
    if (!results) results = []
    return Promise.all(results.map(id => exports.getLobbyInfo({ id: id })))
  })
}

exports.getLobbyInfo = data => {
  const { id } = data
  let members
  return promised.smembers('lobbymembers:' + id)
  .then(results => {
    members = results.map(id => ({ id: id }))
    return promised.hgetall('lobbyinfo:' + id)
  })
  .then(results => {
    if (!results.owner) return Promise.reject(Error('Lobby doesn\t exist'))
    return {
      id: id,
      owner: {
        id: results.owner
      },
      members: members,
      name: results.name,
      public: results.public
    }
  })
}

exports.createLobby = data => {
  let id
  const { userId } = data
  return PapanServerUtils.generateToken()
  .then(token => {
    id = token
    return promised.hsetnx('lobbyinfo:' + id, 'owner', userId)
  })
  .then(result => {
    if (result === 0) return exports.createLobby(data)
    return promised.sadd('lobbymembers:' + id, userId)
  })
  .then(() => promised.sadd('user:' + userId + ':lobbies', id))
  .then(() => exports.getLobbyInfo({ id: id }))
}

exports.joinLobby = data => {
  const { userId, id } = data
  return promised.hget('lobbyinfo:' + id, 'owner')
  .then(result => {
    if (result === null) Promise.reject(Error('Lobby doesn\t exist'))
    return promised.sadd('lobbymembers:' + id, userId)
  })
  .then(() => promised.sadd('user:' + userId + ':lobbies', id))
  .then(() => exports.getLobbyInfo({ id: id }))
}

const setLobbyField = data => {
  const { id, userId, field } = data
  const key = 'lobbyinfo:' + id
  return promised.hget(key, 'owner')
  .then(result => {
    if (result === null) return Promise.reject(Error('Lobby doesn\'t exist'))
    let info = this.getLobbyInfo({ id: id })
    if (userId !== result) {
      return info
    } else {
      return promised.hset(key, field, data[field])
      .then(() => info)
    }
  })
}

exports.setLobbyName = data => setLobbyField(deepmerge(data, { field: 'name' }))
exports.setLobbyPublic = data => setLobbyField(deepmerge(data, { field: 'public' }))
.then(info => {
  let ret
  if (data.public) {
    ret = promised.sadd('publiclobbies', data.id)
    client.publish('publiclobbies', JSON.stringify({
      id: data.id,
      status: 0
    }))
  } else {
    ret = promised.srem('publiclobbies', data.id)
    client.publish('publiclobbies', JSON.stringify({
      id: data.id,
      status: 1
    }))
  }
  return ret.then(() => info)
})

exports.lobbySubscribe = (id, callback) => {
  const subscriber = redis.createClient()
  const key = 'lobbysub:' + id
  subscriber.subscribe(key)
  subscriber.on('key', (channel, message) => {
    if (channel === key) {
      callback(JSON.parse(message))
    }
  })

  const ret = {
    subscriber: subscriber,
    close: () => subscriber.unsubscribe(key)
  }
  return ret
}

exports.lobbySendMessage = (id, message) => {
  client.publish('lobbysub:' + id, JSON.stringify(message))
}

exports.getPublicLobbies = () => {
  return promised.smembers('publiclobbies')
}

exports.lobbyListSubscribe = callback => {
  const subscriber = redis.createClient()
  const key = 'publiclobbies'
  subscriber.subscribe(key)
  subscriber.on('message', (channel, message) => {
    const data = JSON.parse(message)
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
