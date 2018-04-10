'use strict'

if (this.PapanUtils.isElectron()) {
  this.webtorrentReady = true
  const WebTorrent = require('webtorrent')
  this.webTorrentClient = new WebTorrent()

  this.webTorrentClient.on('error', console.error)
} else {
  this.webtorrentReady = false
  const wtjspath = 'node_modules/webtorrent/webtorrent.min.js'
  const wtjs = document.createElement('script')
  wtjs.onload = () => {
    this.webTorrentClient = new this.WebTorrent()
    if (this.webtorrentOnReady) this.webtorrentOnReady()
  }
  wtjs.src = wtjspath
  this.document.head.appendChild(wtjs)
}
