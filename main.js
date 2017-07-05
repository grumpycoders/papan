'use strict'

const PapanUtils = require('./src/common/utils.js')
const argv = require('minimist')(process.argv.slice(2))

if (PapanUtils.isElectron()) {
  const mainElectron = require('./src/server/main-electron.js')
  mainElectron.main()
}

const mainNode = require('./src/server/main-node.js')
mainNode.main()

if (argv.auth_server) {
  let config = {}
  const express = require('express')
  const papanAuth = require('./src/server/auth/server.js')
  let app = express()
  papanAuth.registerServer(app, config).then(app.listen(8081))
}
