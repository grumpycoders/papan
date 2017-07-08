'use strict'

class Provider {
  constructor (create, connect, urlFragment) {
    this.create = create
    this.connect = connect
    this.urlFragment = urlFragment
  }

  registerStrategies (users, factory) {
    factory(this.create, (user) => {
      return users.findOrCreate(user)
    })
    factory(this.connect, (user) => {
      return Promise.resolve(user)
    })
  }
}

exports.Provider = Provider
