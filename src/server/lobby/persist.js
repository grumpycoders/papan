const optionDefinitions = [
  { name: 'use_redis_mock', type: Boolean },
  { name: 'use_redis_server', type: Boolean }
]
const commandline = require('command-line-args')
const argv = commandline(optionDefinitions, { partial: true, argv: process.argv })

const PapanUtils = require('../../common/utils.js')

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

exports.createLobby = ({ userId, lobbyId, lobbyName }) => {
  const key = 'lobbyinfo:' + lobbyId
  return new Promise((resolve, reject) => {
    client.hsetnx(key, 'owner', userId, (err, results) => {
      if (err) reject(err)
      if (results === 0) resolve(undefined)
      client.hset(key, 'name', lobbyName, (err, results) => {
        if (err) reject(err)
        client.expire(key, 15 * 60, (err, results) => {
          if (err) reject(err)
          resolve(lobbyId)
        })
      })
    })
  })
}
