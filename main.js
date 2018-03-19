'use strict'

const PapanUtils = require('./src/common/utils.js')
const PapanServerUtils = require('./src/server/utils.js')
const argv = require('minimist')(process.argv.slice(2))

let grpcServers = []

const lobbyStartup = () => argv.lobby_server && !PapanUtils.isElectron()
? require('./src/server/lobby/server.js').registerServer()
  .then(server => {
    grpcServers.push(server)
  })
: Promise.resolve()

const electronStartup = () => PapanUtils.isElectron()
? require('./src/server/main-electron.js').main()
: Promise.resolve(() => {})

const nodeStartup = () => require('./src/server/main-node.js').main()

Promise.all([
  lobbyStartup(),
  electronStartup(),
  nodeStartup()
])
.then(results => {
  results[1]()
  console.log('Started')
})
.catch(err => {
  console.error(err)
})

// process.env['GRPC_VERBOSITY'] = 'DEBUG'
// process.env['GRPC_TRACE'] = 'all'

if (argv.auth_server) {
  Promise.all([
    PapanServerUtils.readJSON('config/google-auth-config.json'),
    PapanServerUtils.readJSON('config/facebook-auth-config.json'),
    PapanServerUtils.readJSON('config/twitter-auth-config.json'),
    PapanServerUtils.readJSON('config/steam-auth-config.json'),
    PapanServerUtils.readJSON('config/pg-config.json'),
    PapanServerUtils.readJSON('config/http-config.json')
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
