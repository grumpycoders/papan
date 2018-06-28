'use strict'

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')
const proto = require('../common/proto.js')

const path = require('path')
const recursive = require('recursive-readdir')
const WebTorrent = PapanUtils.isElectron() ? require('webtorrent') : require('webtorrent-hybrid')

const client = new WebTorrent()
const base = path.join(__dirname, '..', '..', '..', 'games')
const jsonName = 'game.json'

client.on('error', error => console.log('WebTorrent - main process error: ' + error))

const gameInfoProtoLoader = proto.load('game-info.proto')

exports.base = base
exports.getGamesList = async () => {
  const games = {}
  const allFiles = await recursive(base)
  const gamesJson = allFiles.filter(fname => path.basename(fname).endsWith(jsonName))
  gamesJson.sort((a, b) => {
    function prefix (str) {
      if (str.startsWith('builtins')) return '001-' + str
      if (str.startsWith('custom')) return '002-' + str
      if (str.startsWith('downloaded')) return '900-' + str
      return '999-' + str
    }
    a = prefix(path.relative(base, a))
    b = prefix(path.relative(base, b))
    if (a < b) return -1
    if (a > b) return 1
    return 0
  })
  const proto = await gameInfoProtoLoader
  const GameInfoMessageType = proto.rootProto.lookupType('Papan.GameJson')
  await Promise.all(gamesJson.map(path.dirname).map(async gamepath => {
    const game = gamepath.slice(base.length + 1).replace(/\\/g, '/')
    if (games[game] && games[game].id) return
    const gameJson = await PapanServerUtils.readJSON(path.join(gamepath, jsonName))
    const error = GameInfoMessageType.verify(gameJson)
    if (error) throw Error(error)
    games[game] = {
      id: game,
      fullPath: gamepath,
      json: GameInfoMessageType.create(gameJson)
    }
    const input = await Promise.all(allFiles
      .filter(fname => !path.relative(gamepath, fname).startsWith('.'))
      .map(fname => path.relative(gamepath, fname))
      .sort()
      .map(async fname => {
        const buffer = await PapanServerUtils.readFile(path.join(gamepath, fname))
        buffer.name = fname.replace('\\', '/')
        return buffer
      })
    )
    return new Promise((resolve, reject) => {
      client.seed(input, { name: game }, torrent => {
        games[game].torrent = torrent
        resolve()
      })
    })
  }))
  return games
}
