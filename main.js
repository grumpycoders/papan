'use strict'

const PapanUtils = require('./common/util.js')

if (PapanUtils.isElectron()) {
  const mainElectron = require('./main-electron.js')
  mainElectron.main()
}

const mainNode = require('./main-node.js')
mainNode.main()
