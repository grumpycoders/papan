'use strict'

const commandline = require('command-line-args')
const request = require('request-promise-native')
const deepDiff = require('deep-diff')
const _ = require('lodash')

const optionDefinitions = [
  { name: 'debug', type: Boolean }
]
let mainWindow

const electron = require('electron')
const settings = require('electron-settings')
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
    if (!settings.has('auth.cookies')) {
      return this.getAuthorizationCodeFromWindow()
    }
    const cookies = settings.get('auth.cookies')
    const jar = request.jar()
    const authServerURL = this.settings.authServerURL
    Object.keys(cookies).forEach(cookieName => {
      jar.setCookie(request.cookie(cookieName + '=' + cookies[cookieName]), authServerURL)
    })
    const requestData = {
      method: 'GET',
      followRedirect: false,
      jar: jar,
      url: authServerURL + '/auth/getcode',
      json: true
    }

    return new Promise((resolve, reject) => {
      request(requestData)
      .then(res => {
        if (typeof res === 'object' && typeof res.code === 'string') {
          resolve(res.code)
        } else {
          resolve(this.getAuthorizationCodeFromWindow())
        }
      })
      .catch(() => {
        resolve(this.getAuthorizationCodeFromWindow())
      })
    })
  }

  getAuthorizationCodeFromWindow () {
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
      const webRequest = electron.session.defaultSession.webRequest
      webRequest.onBeforeRequest(filter, (details, callback) => {
        const response = { cancel: false }
        if (details.url.startsWith(returnPrefix)) {
          const code = details.url.substr(returnPrefix.length)
          success = true
          window.removeListener('closed', closedListener)
          window.close()
          response.cancel = true
          resolve(code)
        }
        callback(response)
      })
      webRequest.onHeadersReceived(filter, (details, callback) => {
        const response = { cancel: false }
        if (details.url.startsWith(authRequestURL)) {
          let authCookies = {}
          const cookies = details.responseHeaders['Set-Cookie']
          if (settings.has('auth.cookies')) {
            authCookies = settings.get('auth.cookies')
          }
          if (Array.isArray(cookies)) {
            cookies.forEach(cookie => {
              const parts = cookie.split(';')
              const cookieDetails = parts[0].split('=')
              authCookies[cookieDetails[0]] = cookieDetails[1]
            })
          }
          settings.set('auth', { cookies: authCookies })
        }
        callback(response)
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

  clientInterface.channel.on('ConnectToLobbyServer', data => {
    if (clientInterface.getLobbyConnectionStatus() !== 'NOTCONNECTED') {
      return
    }
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
        client = null
      }
    })
  })

  clientInterface.channel.on('CreateLobby', data => {
    if (clientInterface.getLobbyConnectionStatus() !== 'CONNECTED' || !client) {
      return
    }

    client.createLobby(data)
  })

  const options = commandline(optionDefinitions, { partial: true, argv: process.argv })
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
