'use strict'

const PouchDB = require('pouchdb')

class PouchCollectionAdapter {
  constructor (db) {
    this.db = db
  }

  put (doc) {
    return this.db.put(doc)
  }

  get (key) {
    return this.db.get(key)
  }

  update (doc) {
    return this.db.put(doc)
  }
}

class PouchAdapter {
  constructor (url) {
    if (!url.endsWith('/') && url.length !== 0) {
      this.url = url + '/'
    } else {
      this.url = url
    }
  }

  table (name) {
    let fullURL = this.url + name
    let db = new PouchDB(fullURL)
    return new PouchCollectionAdapter(db)
  }
}

exports.connect = (url = '') => {
  return new Promise((resolve, reject) => {
    return resolve(new PouchAdapter(url))
  })
}
