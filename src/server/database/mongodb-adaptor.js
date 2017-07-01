'use strict'

const MongoClient = require('mongodb').MongoClient

class MongoCollectionAdaptor {
  constructor (db, collection) {
    this.collection = collection
  }

  put (doc) {
    return this.collection.insertOne(doc)
  }

  get (key) {
    let cursor = this.collection.find({'_id': key})
    return new Promise((resolve, reject) => {
      cursor.each(function (err, doc) {
        if (err === null) {
          resolve(doc)
        } else {
          reject(err)
        }
      })
    })
  }

  update (doc) {
    return this.collection.findOneAndReplace({'_id': doc._id}, doc)
  }
}

class MongoAdaptor {
  constructor (db) {
    this.db = db
  }

  table (name) {
    let collection = this.db.collection(name)
    return MongoCollectionAdaptor(collection)
  }
}

exports.connect = (url = '') => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(url, (err, db) => {
      if (err === null) {
        resolve(MongoAdaptor(db))
      } else {
        reject(err)
      }
    })
  })
}
