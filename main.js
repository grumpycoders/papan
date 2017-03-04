'use strict'

const PapanUtils = require('./src/common/utils.js')

if (PapanUtils.isElectron()) {
  const mainElectron = require('./src/server/main-electron.js')
  mainElectron.main()
}

const mainNode = require('./src/server/main-node.js')
mainNode.main()
