((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    register(module.exports)
  } else {
    that.PapanUtils = {}
    register(that.PapanUtils)
  }
})(this, that => {
  'use strict'

  that.isElectron = () => {
    let p = typeof (process) !== 'undefined' && process
    return !!p && !!p.versions && !!p.versions.electron
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
