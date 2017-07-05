'use strict'

const PapanUtils = require('./src/common/utils.js')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))

if (PapanUtils.isElectron()) {
  const mainElectron = require('./src/server/main-electron.js')
  mainElectron.main()
}

const mainNode = require('./src/server/main-node.js')
mainNode.main()

function readJSON (filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      if (err) resolve({})
      resolve(JSON.parse(data))
    })
  })
}

if (argv.auth_server) {
  let googleAuthConfig = {}
  readJSON('config/google-auth-config.json').then((googleAuthConfigRead) => {
    googleAuthConfig = googleAuthConfigRead
    return readJSON('config/pg-config.json')
  }).then((pgConfig) => {
    const config = {
      googleAuthConfig: googleAuthConfig,
      pgConfig: pgConfig
    }

    const express = require('express')
    const papanAuth = require('./src/server/auth/server.js')
    let app = express()
    papanAuth.registerServer(app, config).then(() => app.listen(8081))
  })
}
