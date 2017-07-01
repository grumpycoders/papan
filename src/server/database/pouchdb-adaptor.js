'use strict'

const PouchDB = require('pouchdb')

class PouchCollectionAdaptor {
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

class PouchAdaptor {
  table (name) {
    let fullURL = this.url + name
    let db = new PouchDB(fullURL)
    return new PouchCollectionAdaptor(db)
  }

  connect (url = '') {
    if (!url.endsWith('/') && url.length !== 0) {
      this.url = url + '/'
    } else {
      this.url = url
    }

    return new Promise((resolve, reject) => resolve(this))
  }
}

exports.create = () => {
  console.log('Using PouchDB adaptor')
  return new PouchAdaptor()
}
