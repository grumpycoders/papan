'use strict'

if (this.PapanUtils.isElectron()) {
  const electron = require('electron')
  const ipc = electron.ipcRenderer
  class Channel {
    ready () {
      return true
    }
    on (event, callback) {
      ipc.on(event, (event, data) => callback(data))
    }
    once (event, callback) {
      ipc.once(event, (event, data) => callback(data))
    }
    send (event, data) {
      ipc.send(event, data)
    }
  }
  this.channel = new Channel()
} else {
  let socket

  class Channel {
    constructor () {
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

    ready () {
      return true
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
      socket.send({ event: event, message: data })
    }
  }

  const iojspath = 'node_modules/socket.io-client/dist/socket.io.js'
  const iojs = document.createElement('script')
  iojs.onload = () => {
    socket = this.io()
    const channel = new Channel()
    this.channel.spillover(channel)
    const onready = this.channel.onready
    this.channel = channel
    if (onready) onready()
  }
  iojs.src = iojspath
  this.document.head.appendChild(iojs)

  class Queuer {
    constructor () {
      this.ons = []
      this.onces = []
      this.sends = []
    }

    ready () {
      return false
    }

    on (event, callback) {
      this.ons.push({ event: event, callback: callback })
    }

    once (event, callback) {
      this.onces.push({ event: event, callback: callback })
    }

    send (event, data) {
      this.sends.push({ event: event, data: data })
    }

    spillover (channel) {
      this.ons.forEach(on => channel.on(on.event, on.callback))
      this.onces.forEach(once => channel.once(once.event, once.callback))
      this.sends.forEach(send => channel.send(send.event, send.data))
      return channel
    }
  }

  this.channel = new Queuer()
}
