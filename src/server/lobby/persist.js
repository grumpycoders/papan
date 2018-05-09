const optionDefinitions = [
  { name: 'use_redis_mock', type: Boolean },
  { name: 'use_redis_server', type: Boolean }
]
const commandline = require('command-line-args')
const deepmerge = require('deepmerge')
const randomWords = require('random-words')
const RedisSessions = require('redis-sessions')
const argv = commandline(optionDefinitions, { partial: true, argv: process.argv })

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')

class PersistClient {
  constructor ({ rs, client, redis }) {
    const execIntercept = object => new Proxy(object, {
      get: (target, prop, receiver) => {
        if (prop !== 'exec') return (...args) => execIntercept(object[prop](...args))
        return () => new Promise((resolve, reject) => {
          object.exec((err, result) => {
            if (err) reject(err)
            resolve(result)
          })
        })
      }
    })
    this._redis = redis
    this._rs = rs
    this._client = client
    this._promised = PapanServerUtils.promisifyClass(client)
    this._promised.multi = () => execIntercept(client.multi())
  }

  close () {
    this._client.quit()
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

  sendUserMessage (userId, message) {
    this._client.publish('usersub:' + userId, PapanUtils.JSON.stringify(message))
  }

  registerGameServer (id, games) {
    let request = this._promised.multi().sadd('gameservers', id)
    games.forEach(infoHash => {
      request = request.sadd('game:' + infoHash, id)
    })
    return request.exec()
  }

  gameServerSubscribe (id, callback) {
    const subscriber = this._redis.createClient()
    const key = 'gamesub:' + id
    subscriber.subscribe(key)
    subscriber.on('message', (channel, message) => {
      if (channel === key) {
        callback(PapanUtils.JSON.parse(message))
      }
    })

    return {
      subscriber: subscriber,
      close: () => subscriber.unsubscribe(key)
    }
  }

  sendGameMessage (id, message) {
    this._client.publish('gamesub:' + id, PapanUtils.JSON.stringify(message))
  }

  async getJoinedLobbies (data) {
    const { id } = data
    let results = await this._promised.smembers('user:' + id + ':lobbies')
    if (!results) results = []
    return Promise.all(results.map(id => this.getLobbyInfo({ id: id })))
  }

  async getLobbyInfo (data) {
    const { id } = data
    const members = (await this._promised.smembers('lobbymembers:' + id)).map(id => ({ id: id }))
    const info = await this._promised.hgetall('lobbyinfo:' + id)
    const gameId = await this._promised.get('lobbyinfo:' + id + ':gameid')
    if (!info || !info.owner) throw Error('Lobby doesn\'t exist')
    const playersInfoTree = {}
    const teaminfo = await this._promised.hgetall('lobbyinfo:' + id + ':gameteaminfo:' + gameId)
    const convertValue = (key, value) => {
      switch (key) {
        case 'order':
          return parseInt(value)
        case 'user':
          return { id: value }
        default:
          return value
      }
    }
    Object.keys(teaminfo || {}).filter(subKey => subKey.match(/^playerinfo:.*team:/)).sort().forEach(team => {
      const matches = team.match(/^playerinfo:(.*):?team:(.*):(.*)$/)
      const components = matches[1].split(':')
      const id = matches[2]
      const key = matches[3]
      let parent = playersInfoTree
      components.filter(id => id.length !== 0).forEach(id => {
        parent = parent.teams[id]
      })
      if (!parent.teams) parent.teams = {}
      if (!parent.teams[id]) parent.teams[id] = {}
      parent.teams[id][key] = convertValue(key, teaminfo[team])
    })
    Object.keys(teaminfo || {}).filter(subkey => subkey.match(/^playerinfo:.*slot:/)).forEach(slot => {
      const matches = slot.match(/^playerinfo:(.*):?slot:(.*):(.*)$/)
      const components = matches[1].split(':')
      const id = matches[2]
      const key = matches[3]
      let parent = playersInfoTree
      components.filter(id => id.length !== 0).forEach(id => {
        parent = parent.teams[id]
      })
      if (!parent.slots) parent.slots = {}
      if (!parent.slots[id]) parent.slots[id] = {}
      parent.slots[id][key] = convertValue(key, teaminfo[slot])
    })
    const convertTree = tree => {
      const ret = {}
      if (tree.slots) {
        ret.slots = {}
        ret.slots.slot = []
        Object.keys(tree.slots).forEach(id => {
          tree.slots[id].id = id
          ret.slots.slot.push(tree.slots[id])
        })
        ret.slots.slot.sort((a, b) => a.order - b.order)
      } else if (tree.teams) {
        ret.teams = {}
        ret.teams.team = []
        Object.keys(tree.teams).forEach(id => {
          const subTree = convertTree(tree.teams[id])
          delete tree.teams[id].teams
          delete tree.teams[id].slots
          tree.teams[id].playersInfo = subTree
          ret.teams.team.push(tree.teams[id])
        })
        ret.teams.team.sort((a, b) => a.order - b.order)
      }

      return ret
    }
    return {
      id: id,
      owner: {
        id: info.owner
      },
      members: members,
      name: info.name,
      public: info.public === 'true',
      playersInfo: convertTree(playersInfoTree),
      gameInfo: info.gameInfo ? PapanUtils.JSON.parse(info.gameInfo) : info.gameInfo
    }
  }

  async createLobby (data) {
    const { userId } = data
    const id = await PapanServerUtils.generateToken({ prefix: 'LBBY' })
    if ((await this._promised.hsetnx('lobbyinfo:' + id, 'owner', userId)) === 0) {
      return this.createLobby(data)
    }
    await Promise.all([
      this._promised.set('lobbyinfo:' + id + ':gameid', 0),
      this._promised.sadd('lobbymembers:' + id, userId),
      this._promised.sadd('user:' + userId + ':lobbies', id)
    ])
    return this.setLobbyName({
      id: id,
      userId: userId,
      name: randomWords({ exactly: 4, join: ' ' })
    })
  }

  async joinLobby (data) {
    const { userId, id } = data
    const owner = await this._promised.hget('lobbyinfo:' + id, 'owner')
    if (owner === null) throw Error('Lobby doesn\'t exist')
    await this._promised.sadd('lobbymembers:' + id, userId)
    await this._promised.sadd('user:' + userId + ':lobbies', id)
    return this.getLobbyInfo({ id: id })
  }

  async _setLobbyField (data) {
    const { id, userId, field } = data
    const key = 'lobbyinfo:' + id
    const owner = await this._promised.hget(key, 'owner')
    if (owner === null) throw Error('Lobby doesn\'t exist')
    if (userId === owner) {
      await this._promised.hset(key, field, data[field])
    }
    return this.getLobbyInfo({ id: id })
  }

  setLobbyName (data) {
    return this._setLobbyField(deepmerge(data, { field: 'name' }))
  }

  async setLobbyPublic (data) {
    const info = await this._setLobbyField(deepmerge(data, { field: 'public' }))
    if (data.public) {
      await this._promised.sadd('publiclobbies', data.id)
      this._client.publish('publiclobbies', PapanUtils.JSON.stringify({
        id: data.id,
        status: 'ADDED'
      }))
    } else {
      await this._promised.srem('publiclobbies', data.id)
      this._client.publish('publiclobbies', PapanUtils.JSON.stringify({
        id: data.id,
        status: 'REMOVED'
      }))
    }
    return info
  }

  async setLobbyGame ({ userId, id, gameInfo }) {
    const createMinimumSlots = async (gameTeamKey, multi, playersInfo, owner = '') => {
      if (playersInfo.info === 'players') {
        for (let i = 0; i < playersInfo.players.min; i++) {
          const slotId = await PapanServerUtils.generateToken({ prefix: 'SLOT' })
          const subKey = 'playerinfo:' + owner + 'slot:' + slotId + ':order'
          multi.hset(gameTeamKey, subKey, i)
        }
      } else {
        for (let i = 0; i < playersInfo.teams.teams.length; i++) {
          for (let j = 0; j < playersInfo.teams.teams[i].cardMin; j++) {
            const teamId = await PapanServerUtils.generateToken({ prefix: 'TEAM' })
            const subKey = 'playerinfo:' + owner + 'team:' + teamId
            multi.hset(gameTeamKey, subKey + ':order', i * playersInfo.teams.teams.length + j) //TODO: fix, probably separate i and j
            multi.hset(gameTeamKey, subKey + ':name', playersInfo.teams.teams[i].name)
            await createMinimumSlots(teamId + ':', multi, playersInfo.teams.teams[i].playersInfo) //TODO: check parameters
          }
        }
      }
    }
    const info = await this._setLobbyField({
      userId: userId,
      id: id,
      gameInfo: PapanUtils.JSON.stringify(gameInfo),
      field: 'gameInfo'
    })
    if (info.owner.id !== userId) return info
    const newGameId = await this._promised.incrby('lobbyinfo:' + id + ':gameid', 1)
    const oldGameId = newGameId - 1
    const multi = this._client.multi()
    multi.del('lobbyinfo:' + id + ':gameteaminfo:' + oldGameId)
    await createMinimumSlots('lobbyinfo:' + id + ':gameteaminfo:' + newGameId, multi, gameInfo.json.playersInfo)
    await multi.exec()
    return this.getLobbyInfo({ id: id })
  }

  async assignSlot (data) {
    const { lobbyId, userId, senderId } = data
    const info = await this.getLobbyInfo({ id: lobbyId })
    const owner = info.owner.id
    if (userId) {
      let found = false
      info.members.forEach(user => {
        if (user.id === userId) {
          found = true
        }
      })
      if (!found) return info
    }
    this._client.watch('lobbyinfo:' + lobbyId + ':gameid')
    const gameId = await this._promised.get('lobbyinfo:' + lobbyId + ':gameid')
    const buildSlotId = data => {
      if (data.slotId) return 'slot:' + data.slotId
      return (data.id ? (data.id + ':') : '') + buildSlotId(data.team)
    }
    const slotId = 'playerinfo:' + buildSlotId(data)
    const multi = this._client.multi()
    let discarded = false
    const gameKey = 'lobbyinfo:' + lobbyId + ':gameteaminfo:' + gameId
    if (owner === senderId) {
      if (userId) {
        multi.hset(gameKey, slotId + ':user', userId)
      } else {
        multi.hdel(gameKey, slotId + ':user')
      }
    } else {
      const currentPlayer = await this._promised.hget(gameKey, slotId + ':user')
      if ((currentPlayer && currentPlayer !== senderId) || (userId && userId !== senderId)) {
        multi.discard()
        discarded = true
      } else {
        if (userId) {
          multi.hsetnx(gameKey, slotId + ':user', userId)
        } else {
          multi.hdel(gameKey, slotId + ':user')
        }
      }
    }

    if (!discarded) {
      await multi.exec()
    }

    return this.getLobbyInfo({ id: lobbyId })
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
  if (mock) {
    redis.setMaxListeners(0)
    client.watch = () => {}
  }
  const rs = new RedisSessions({ client: client })

  return Promise.resolve(new PersistClient({ rs: rs, client: client, redis: redis }))
}
