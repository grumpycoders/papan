'use strict'

const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const ClientInterface = require('./lobby/clientinterface.js').ClientInterface

class Channel {
  constructor (socket) {
    this.socket = socket
    this.listeners = {}

    socket.on('message', data => {
      const event = data.event
      const listeners = this.listeners[event]
      if (listeners) {
        let toremove = []
        for (let index = 0; index < listeners.length; index++) {
          listeners[index].callback(data.message)
          if (listeners[index].once) {
            toremove.unshift(index)
          }
        }
        toremove.forEach(index => {
          listeners.splice(index, 1)
        })
      }
    })
  }

  on (event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }

    this.listeners[event].push({ callback: callback })
  }

  once (event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }

    this.listeners[event].push({ callback: callback, once: true })
  }

  send (event, data) {
    this.socket.send({ event: event, message: data })
  }
}

class NodejsClientInterface extends ClientInterface {
  getAuthorizationCode () {
    console.log('get code...')
  }
}

exports.main = () => {
  const port = 8080
  const app = express()
  const server = http.Server(app)
  const io = socketio(server)

  app.use(express.static(path.join(__dirname, '../..')))
  io.on('connection', socket => {
    let channel = new Channel(socket)
    let clientInterface = new NodejsClientInterface(channel)
    socket.on('disconnect', reason => {
      console.log(reason)
      clientInterface.close()
    })
  })

  return new Promise((resolve, reject) => {
    server.listen(port, resolve)
  })
}
