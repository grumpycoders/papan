'use strict'

const commandline = require('command-line-args')
const deepDiff = require('deep-diff')

const optionDefinitions = [
  { name: 'debug', type: Boolean }
]

const electron = require('electron')
const ipc = electron.ipcMain

const path = require('path')
const url = require('url')

const instance = require('./src/server/game-instance.js')

exports.main = () => {

const app = electron.app
const BrowserWindow = electron.BrowserWindow

const options = commandline(optionDefinitions, { partial: true })

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({'width': 1100, 'height': 800})
  mainWindow.loadURL(url.format({
    'pathname': path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  if (options.debug) {
    mainWindow.webContents.openDevTools()
  }

  mainWindow.on('closed', function() {
    mainWindow = null
  })
}

app.on('ready', createWindow)

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', function() {
  if (mainWindow === null) {
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
  switch(arg.type) {
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

}
