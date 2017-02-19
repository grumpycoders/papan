'use strict'

const electron = require('electron')
const ipc = require('electron').ipcMain

const path = require('path')
const url = require('url')

const instance = require('./src/server/game-instance.js')

exports.main = () => {

const app = electron.app
const BrowserWindow = electron.BrowserWindow

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({'width': 800, 'height': 600})
  mainWindow.loadURL(url.format({
    'pathname': path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

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

ipc.on('synchronous-message', function (event, arg) {
  console.log('main process: arg = ' + arg)
  instance.createInstance('tic-tac-toe')
  event.returnValue = 'tic-tac-toe'
})

}
