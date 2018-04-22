'use strict'

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')
const proto = require('../common/proto.js')

const path = require('path')
const recursive = require('recursive-readdir')
const WebTorrent = PapanUtils.isElectron() ? require('webtorrent') : require('webtorrent-hybrid')

const client = new WebTorrent()
const games = {}
const base = path.join(__dirname, '..', '..', '..', 'games')
const jsonName = 'game.json'

client.on('error', error => console.log('WebTorrent - main process error: ' + error))

const gameInfoProtoLoader = proto.load('game-info.proto')

gameInfoProtoLoader.catch(error => { throw error })

exports.base = base
exports.getGamesList = () => recursive(base)
.then(allFiles => {
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
  return gameInfoProtoLoader
  .then(result => {
    const GameInfoMessageType = result.rootProto.lookupType('Papan.GameJson')
    return Promise.all(gamesJson.map(path.dirname).map(gamepath => {
      const game = gamepath.slice(base.length + 1).replace(/\\/g, '/')
      if (games[game] && games[game].id) return Promise.resolve()
      games[game] = {}
      return PapanServerUtils.readJSON(path.join(gamepath, jsonName))
      .then(gameJson => {
        const error = GameInfoMessageType.verify(gameJson)
        if (error) throw Error(error)
        games[game].id = game
        games[game].fullPath = gamepath
        games[game].json = GameInfoMessageType.create(gameJson)
        return new Promise((resolve, reject) => {
          Promise.all(allFiles
            .filter(fname => !path.relative(gamepath, fname).startsWith('.'))
            .map(fname => path.relative(gamepath, fname))
            .sort()
            .map(fname => {
              return PapanServerUtils.readFile(path.join(gamepath, fname))
              .then(buffer => {
                buffer.name = fname.replace('\\', '/')
                return buffer
              })
            }
          )).then(input => {
            client.seed(input, { name: game }, torrent => {
              games[game].torrent = torrent
              resolve()
            })
          })
        })
      })
    }))
  })
})
.then(() => games)
