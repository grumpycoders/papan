'use strict'

if (typeof (process.versions.electron) !== 'undefined') {
  const mainElectron = require('./main-electron.js')
  mainElectron.main()
}

const mainNode = require('./main-node.js')
mainNode.main()
