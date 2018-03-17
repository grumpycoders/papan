'use strict'

const commandline = require('command-line-args')
const deepDiff = require('deep-diff')

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

class ElectronClientInterface extends lobbyClient.ClientInterface {
  getAuthorizationCode () {
    const electron = require('electron')
    const authServerURL = 'https://auth.papan.online'
    const authRequestURL = authServerURL + '/auth/forwardcode?returnURL=https://auth.papan.online/auth/electronreturn'
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

exports.main = (settings) => {
  const app = electron.app
  const BrowserWindow = electron.BrowserWindow

  const options = commandline(optionDefinitions, { partial: true })
  const createWindow = settings => {
    mainWindow = new BrowserWindow({'width': 1100, 'height': 800})
    mainWindow.loadURL(url.format({
      'pathname': path.join(__dirname, '../..', 'index.html'),
      protocol: 'file:',
      slashes: true
    }))

    if (options.debug) {
      mainWindow.webContents.openDevTools()
    }

    let client

    mainWindow.on('closed', () => {
      mainWindow = null
      if (client) {
        client.close()
      }
    })

    lobbyClient.CreateClient(new ElectronClientInterface(), settings)
    .then(createdClient => {
      if (mainWindow) {
        client = createdClient
      } else {
        client.close()
      }
    })
  }

  let isAppReady = false

  const returnPromise = new Promise((resolve, reject) => {
    app.on('ready', () => {
      isAppReady = true
      resolve(settings => createWindow(settings))
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  app.on('activate', () => {
    if (isAppReady && mainWindow === null) {
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
