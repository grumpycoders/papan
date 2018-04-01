'use strict'

const PapanUtils = require('../../common/utils.js')
const PapanServerUtils = require('../common/utils.js')

const path = require('path')
const recursive = require('recursive-readdir')
const WebTorrent = PapanUtils.isElectron() ? require('webtorrent') : require('webtorrent-hybrid')

const client = new WebTorrent()
const games = {}
const base = path.join(__dirname, '..', '..', '..', 'games')
const jsonName = 'game.json'

client.on('error', error => console.log('WebTorrent - main process error: ' + error))

exports.base = base
exports.getGamesList = () => recursive(base)
.then(files => {
  const gamesJson = files.filter(fname => path.basename(fname).endsWith(jsonName))
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
  return Promise.all(gamesJson.map(path.dirname).map(gamepath => {
    const game = gamepath.slice(base.length + 1).replace('\\', '/')
    games[game] = {}
    return PapanServerUtils.readJSON(path.join(gamepath, jsonName))
    .then(gameJson => {
      if (games[game].info) return Promise.resolve()
      games[game].info = gameJson
      return new Promise((resolve, reject) => {
        Promise.all(files
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
          client.seed(input, torrent => {
            games[game].torrent = torrent
            resolve()
          })
        })
      })
    })
  }))
})
.then(() => games)
