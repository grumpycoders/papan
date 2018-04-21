((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    register(module.exports)
  } else {
    that.PapanUtils = {}
    register(that.PapanUtils)
  }
})(global, that => {
  'use strict'

  that.isElectron = () => {
    let p = typeof (process) !== 'undefined' && process
    return !!p && !!p.versions && !!p.versions.electron
  }

  that.areArraysEqual = (a1, a2) => {
    if (a1 === a2) return true
    if (!Array.isArray(a1)) return false
    if (!Array.isArray(a2)) return false
    if (a1.length !== a2.length) return false
    for (let i = 0; i < a1.length; i++) {
      if (a2.indexOf(a1[i]) < 0) return false
    }
    return true
  }

  that.JSON = {
    stringify: JSON.stringify,
    parse: string => JSON.parse(string, (key, value) => {
      if (value === null) return value
      if (typeof value !== 'object') return value
      if (!that.areArraysEqual(Object.keys(value), ['type', 'data'])) return value
      if (value.type !== 'Buffer') return value
      if (!Array.isArray(value.data)) return value
      return Buffer.from(value.data)
    })
  }

  that.delayedPromise = (time, value, pass = true) => new Promise((resolve, reject) => {
    let wait = setTimeout(() => {
      clearTimeout(wait)
      if (pass) {
        resolve(value)
      } else {
        reject(value)
      }
    }, time)
  })

  class Queuer {
    constructor (owner) {
      this.ons = []
      this.onces = []
      this.sends = []
      this.owner = owner
      this.onready = () => {}
    }

    ready () {
      return false
    }

    on (event, callback) {
      if (this.channel) {
        this.channel.on(event, callback)
      } else {
        this.ons.push({ event: event, callback: callback })
      }
    }

    once (event, callback) {
      if (this.channel) {
        this.channel.once(event, callback)
      } else {
        this.onces.push({ event: event, callback: callback })
      }
    }

    send (event, data = {}, metadata = {}) {
      if (this.channel) {
        this.channel.send(event, data, metadata)
      } else {
        this.sends.push({ event: event, data: data, metadata: metadata })
      }
    }

    spillover (channel) {
      console.log('Switching to live channel')
      this.channel = channel
      this.owner.channel = channel
      this.ons.forEach(on => channel.on(on.event, on.callback))
      this.onces.forEach(once => channel.once(once.event, once.callback))
      this.sends.forEach(send => channel.send(send.event, send.data, send.metadata))
      this.onready()
      return channel
    }
  }

  that.Queuer = Queuer
})
