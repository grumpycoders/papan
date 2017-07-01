'use strict'

const levelup = require('levelup')
const fs = require('fs')

class LevelCollectionAdaptor {
  constructor (db) {
    this.db = db
  }

  put (doc) {
    let db = this.db

    return new Promise((resolve, reject) => {
      db.put(doc._id, JSON.stringify(doc), (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }

  get (key) {
    let db = this.db

    return new Promise((resolve, reject) => {
      db.get(key, (err, value) => {
        if (err) {
          reject(err)
        } else {
          resolve(JSON.parse(value))
        }
      })
    })
  }

  update (doc) {
    return this.put(doc)
  }

  remove (doc) {
    let db = this.db

    return new Promise((resolve, reject) => {
      db.del(doc._id, (err) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })
  }
}

class LevelAdaptor {
  table (name) {
    return new Promise((resolve, reject) => {
      let fullURL = this.url + name + '.json'
      let db = levelup(fullURL, { db: require('jsondown') })
      resolve(new LevelCollectionAdaptor(db))
    })
  }

  connect (url = 'database') {
    if (!url.endsWith('/') && url.length !== 0) {
      this.url = url + '/'
    } else {
      this.url = url
    }

    return new Promise((resolve, reject) => {
      fs.mkdir(this.url, (err) => {
        if (err && err.code !== 'EEXIST') {
          reject(err)
        } else {
          resolve(this)
        }
      })
    })
  }
}

exports.create = () => {
  console.log('Using LevelUp adaptor')
  return new LevelAdaptor()
}
