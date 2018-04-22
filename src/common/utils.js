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

  class Path {
    constructor (path) {
      this._array = []
      this._absolute = false
      switch (typeof path) {
        case 'string':
          this._array = path.split('/').filter(f => !(['', '.'].includes(f)))
          this._absolute = path.startsWith('/')
          break
        case 'object':
          this._array = path._array.concat([])
          this._absolute = path._absolute
          break
      }
    }

    static _methodList () {
      return Object.getOwnPropertyNames(Path.prototype)
        .filter(name => !(['constructor', 'toString'].includes('join')) && !name.startsWith('_'))
    }

    static _wrappers () {
      return Path._methodList().reduce((output, name) => {
        output[name] = (path, ...args) => (new Path(path))[name](...args).toString()
        return output
      }, {})
    }

    toString () {
      return (this._absolute ? '/' : '') + this._array.join('/')
    }

    basename () {
      const path = new Path()
      path._normalize()
      if (this._array.length !== 0) path._array.push(this._array[this._array.length - 1])
      return path
    }

    dirname () {
      const path = new Path(this)
      path._normalize()
      path._array.pop()
      return path
    }

    isAbsolute () {
      return this._absolute
    }

    isValid () {
      return !this._absolute || this._array[0] !== '..'
    }

    isBelow () {
      return this._array[0] === '..'
    }

    _normalize () {
      let copy = this._array.concat([])
      let fragmentsCount = 0

      this._array = []
      for (let i = 0; i < copy.length; i++) {
        if (copy[i] === '..' && fragmentsCount !== 0) {
          fragmentsCount--
          this._array.pop()
        } else {
          if (copy[i] !== '..') fragmentsCount++
          this._array.push(copy[i])
        }
      }
    }

    normalize () {
      const path = new Path(this)
      path._normalize()
      return path
    }

    join (...args) {
      const path = new Path(this)
      const fragments = []
      for (let i = 0; i < args.length; i++) {
        if (typeof args[i] === 'string') {
          fragments.push(new Path(args[i]))
        } else {
          fragments.push(args[i])
        }
      }
      path._absolute = this._absolute
      path._array = this._array.concat(...fragments.map(element => element._array))
      return path
    }
  }

  that.path = Path._wrappers()
  that.Path = Path
})
