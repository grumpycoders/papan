const optionDefinitions = [
  { name: 'use_redis_mock', type: Boolean },
  { name: 'use_redis_server', type: Boolean }
]
const commandline = require('command-line-args')
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

if (mock) {
  client.duplicate = () => client
}

const promised = PapanServerUtils.promisifyClass(client)

exports.userSubscribe = (userId, callback) => {
  const subscriber = client.duplicate()
  const key = 'usersub:' + userId
  subscriber.subscribe(key, (channel, message) => {
    callback(JSON.parse(message))
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

exports.createLobby = data => {
  let lobbyId
  const { userId } = data
  return PapanServerUtils.generateToken()
  .then(token => {
    lobbyId = token
    return promised.hsetnx('lobbyinfo:' + lobbyId, 'owner', userId)
  })
  .then(result => {
    if (result === 0) return exports.createLobby(data)
    return promised.sadd('lobbymembers:' + lobbyId, userId)
  })
  .then(() => lobbyId)
}

exports.joinLobby = data => {
  const { userId, lobbyId } = data
  return promised.hget('lobbyinfo:' + lobbyId, 'owner')
  .then(result => {
    if (result === 0) Promise.reject(Error('Lobby doesn\t exist'))
    return promised.sadd('lobbymembers:' + lobbyId, userId)
  })
  .then(() => lobbyId)
}

exports.lobbySubscribe = (lobbyId, callback) => {
  const subscriber = client.duplicate()
  const key = 'lobbysub:' + lobbyId
  subscriber.subscribe(key, (channel, message) => {
    callback(JSON.parse(message))
  })

  const ret = {
    subscriber: subscriber,
    close: () => subscriber.unsubscribe(key)
  }
  return ret
}

exports.lobbySendMessage = (lobbyId, message) => {
  client.publish('lobbysub:' + lobbyId, JSON.stringify(message))
}
