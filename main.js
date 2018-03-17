'use strict'

const PapanUtils = require('./src/common/utils.js')
const fs = require('fs')
const argv = require('minimist')(process.argv.slice(2))

let grpcServers = []

const settings = {
  connectLocal: false
}

const lobbyStartup = () => argv.lobby_server
? require('./src/server/lobby/server.js').registerServer()
  .then(server => {
    settings.connectLocal = true
    grpcServers.push(server)
  })
: Promise.resolve()

const electronStartup = () => PapanUtils.isElectron()
? require('./src/server/main-electron.js').main()
: Promise.resolve(() => {})

const nodeStartup = () => require('./src/server/main-node.js').main(settings)

Promise.all([
  lobbyStartup(),
  electronStartup(),
  nodeStartup()
])
.then(results => {
  results[1](settings)
  console.log('Started')
})
.catch(err => {
  console.error(err)
})

// process.env['GRPC_VERBOSITY'] = 'DEBUG'
// process.env['GRPC_TRACE'] = 'all'

function readJSON (filename) {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, (err, data) => {
      resolve(err ? undefined : JSON.parse(data))
    })
  })
}

if (argv.auth_server) {
  Promise.all([
    readJSON('config/google-auth-config.json'),
    readJSON('config/facebook-auth-config.json'),
    readJSON('config/twitter-auth-config.json'),
    readJSON('config/steam-auth-config.json'),
    readJSON('config/pg-config.json'),
    readJSON('config/http-config.json')
  ]).then(values => {
    const config = {
      googleAuthConfig: values[0],
      facebookAuthConfig: values[1],
      twitterAuthConfig: values[2],
      steamAuthConfig: values[3],
      pgConfig: values[4],
      httpConfig: values[5]
    }
    const express = require('express')
    const papanAuth = require('./src/server/auth/server.js')
    let app = express()
    papanAuth.registerServer(app, config)
      .then(() => {
        console.log('Starting Auth server...')
        const httpConfig = config.httpConfig || []
        app.listen(httpConfig.port || 8081)
      }).catch(err => {
        console.log('Not starting Auth server:')
        console.log(err)
      }
    )
  })
}
