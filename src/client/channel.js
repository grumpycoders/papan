'use strict'

this.channel = new this.PapanUtils.Queuer(this)

this.Papan.jsLoader('node_modules/protobufjs/dist/protobuf.min.js')
.then(() => this.Papan.jsLoader('src/common/serializer.js'))
.then(() => {
  const root = new this.protobuf.Root()
  root.resolvePath = (origin, target) => {
    return 'protos/' + target
  }

  return this.protobuf.load(['channel.proto', 'lobby.proto', 'game-info.proto'], root)
})
.then(proto => {
  let serializer = this.PapanProto.createSerializer(proto)
  if (this.PapanUtils.isElectron()) {
    const electron = require('electron')
    const ipc = electron.ipcRenderer
    class Channel {
      ready () {
        return true
      }
      on (event, callback) {
        ipc.on(event, (_, data) => {
          const message = serializer.deserialize(event, data.message)
          callback(message, data.metadata)
        })
      }
      once (event, callback) {
        ipc.once(event, (_, data) => {
          const message = serializer.deserialize(event, data.message)
          callback(message, data.metadata)
        })
      }
      send (event, message = {}, metadata = {}) {
        const data = {
          message: serializer.serialize(event, message),
          metadata: metadata
        }
        ipc.send(event, data)
      }
    }
    this.channel.spillover(new Channel())
  } else {
    class Channel {
      constructor (socket) {
        this.socket = socket
        this.listeners = {}
        this.socket.on('message', data => {
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

      send (event, message = {}, metadata = {}) {
        this.socket.send({ event: event, message: message, metadata: metadata })
      }
    }

    const iojspath = 'node_modules/socket.io-client/dist/socket.io.js'
    const iojs = document.createElement('script')
    iojs.onload = () => this.channel.spillover(new Channel(this.io()))
    iojs.src = iojspath
    this.document.head.appendChild(iojs)
  }
})
