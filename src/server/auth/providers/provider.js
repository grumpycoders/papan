'use strict'

class Provider {
  constructor (create, connect, urlFragment) {
    this.create = create
    this.connect = connect
    this.urlFragment = urlFragment
  }

  registerStrategies (users, factory) {
    factory(this.create, (user, done) => {
      users.findOrCreate(user, done)
    })
    factory(this.connect, (user, done) => {
      done(null, user)
    })
  }
}

exports.Provider = Provider
