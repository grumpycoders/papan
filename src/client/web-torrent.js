'use strict'

if (global.PapanUtils.isElectron()) {
  global.webtorrentReady = true
  const WebTorrent = require('webtorrent')
  global.webTorrentClient = new WebTorrent()
} else {
  global.webtorrentReady = false
  global.Papan.jsLoader('node_modules/webtorrent/webtorrent.min.js')
  .then(() => {
    global.webTorrentClient = new global.WebTorrent()
    if (global.webtorrentOnReady) global.webtorrentOnReady()
  })
}

global.webTorrentClient.on('error', console.error)
