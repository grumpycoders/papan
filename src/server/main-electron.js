'use strict'

const commandline = require('command-line-args')
const deepDiff = require('deep-diff')
const _ = require('lodash')

const optionDefinitions = [
  { name: 'debug', type: Boolean }
]
let mainWindow

const electron = require('electron')
const ipc = electron.ipcMain

const path = require('path')
const url = require('url')

const instance = require('./game/game-instance.js')
const lobbyClient = require('./lobby/client.js')

class Channel {
  on (event, callback) {
    ipc.on(event, (event, data) => callback(data))
  }
  once (event, callback) {
    ipc.once(event, (event, data) => callback(data))
  }
  send (event, data) {
    mainWindow.webContents.send(event, data)
  }
}

class ElectronClientInterface extends lobbyClient.ClientInterface {
  constructor (settings) {
    super(new Channel())
    this.settings = _.defaults(settings, {
      authServerURL: 'https://auth.papan.online'
    })
  }
  getAuthorizationCode () {
    const electron = require('electron')
    const authServerURL = this.settings.authServerURL
    const authRequestURL = authServerURL + '/auth/forwardcode?returnURL=' + authServerURL + '/auth/electronreturn'
    let window = new electron.BrowserWindow({ parent: mainWindow, width: 800, height: 600 })
    let success = false
    let promise = new Promise((resolve, reject) => {
      const closedListener = () => {
        console.log('closed')
        if (!success) {
          reject(Error('Authorization window closed'))
        }
      }
      const filter = { urls: [authServerURL] }
      const returnPrefix = authServerURL + '/auth/electronreturn?code='
      electron.session.defaultSession.webRequest.onBeforeRequest(filter, (details, callback) => {
        const response = { cancel: false }
        response.cancel = false
        if (details.url.startsWith(returnPrefix)) {
          const code = details.url.substr(returnPrefix.length)
          success = true
          window.removeListener('closed', closedListener)
          window.close()
          response.cancel = true
          callback(response)
          resolve(code)
        } else {
          callback(response)
        }
      })
      window.on('closed', closedListener)
    })
    window.once('ready-to-show', () => window.show())
    window.loadURL(authRequestURL)
    return promise
  }
}

exports.main = () => {
  const app = electron.app
  const BrowserWindow = electron.BrowserWindow
  let localLobbyServer
  let client
  let clientInterface = new ElectronClientInterface()

  clientInterface.channel.on('ConnectToLobby', data => {
    let premise
    if (data.connectLocal) {
      clientInterface.setLobbyConnectionStatus('STARTINGLOBBY')
      premise = require('./lobby/server.js').registerServer()
      .then(server => {
        localLobbyServer = server
      })
    } else {
      premise = Promise.resolve()
    }
    premise
    .then(() => lobbyClient.CreateClient(clientInterface, data))
    .then(createdClient => {
      if (mainWindow) {
        client = createdClient
      } else {
        client.close()
      }
    })
  })

  const options = commandline(optionDefinitions, { partial: true })
  function createWindow () {
    mainWindow = new BrowserWindow({ width: 1100, height: 800 })
    mainWindow.loadURL(url.format({
      'pathname': path.join(__dirname, '../..', 'index.html'),
      protocol: 'file:',
      slashes: true
    }))

    if (options.debug) {
      mainWindow.webContents.openDevTools()
    }

    mainWindow.on('closed', () => {
      mainWindow = null
      if (client) {
        client.close()
      }
    })
    clientInterface.setLobbyConnectionStatus('NOTCONNECTED')
  }

  let isAppReady = false

  const returnPromise = new Promise((resolve, reject) => {
    app.on('ready', () => {
      isAppReady = true
      createWindow()
      resolve()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      if (localLobbyServer) {
        localLobbyServer.tryShutdown(() => app.quit())
      } else {
        app.quit()
      }
    }
  })

  app.on('activate', () => {
    if (isAppReady && !mainWindow) {
      createWindow()
    }
  })

  let channel = {}

  channel.sendPrivateScene = (oldscene, newscene, player) => {
    const diff = deepDiff(oldscene, newscene, player)
    if (diff !== undefined) {
      mainWindow.webContents.send('privateSceneDelta', { diff: diff, player: player })
    }
  }

  channel.sendPublicScene = (oldscene, newscene) => {
    const diff = deepDiff(oldscene, newscene)
    if (diff !== undefined) {
      mainWindow.webContents.send('publicSceneDelta', { diff: diff })
    }
  }

  let currentGame

  ipc.on('asynchronous-message', (event, arg) => {
    switch (arg.type) {
      case 'startGame':
        currentGame = instance.createInstance({
          gameId: 'tic-tac-toe',
          channel: channel,
          settings: {
            players: ['player 1', 'player 2']
          }
        })
        event.sender.send('asynchronous-reply', instance.findGameData('tic-tac-toe'))
        break
      case 'refreshPublicScene':
        currentGame.refreshPublicScene()
        break
      case 'action':
        currentGame.action(arg.data)
        break
    }
  })

  return returnPromise
}
