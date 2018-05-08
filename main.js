'use strict'

process.on('warning', warning => console.warn(warning.stack))

const PapanUtils = require('./src/common/utils.js')
const PapanServerUtils = require('./src/server/common/utils.js')
const commandline = require('command-line-args')
const optionDefinitions = [
  { name: 'auth_server', type: Boolean }
]
const argv = commandline(optionDefinitions, { partial: true, argv: process.argv })

const electronStartup = () => PapanUtils.isElectron()
  ? require('./src/server/main-electron.js').main()
  : Promise.resolve()

const nodeStartup = () => require('./src/server/main-node.js').main()

Promise.all([
  electronStartup(),
  nodeStartup()
])
  .then(results => {
    console.log('Started')
  })
  .catch(err => {
    console.error(err)
    process.exit()
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
