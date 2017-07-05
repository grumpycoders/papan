'use strict'

const MongoClient = require('mongodb').MongoClient

class MongoCollectionAdaptor {
  constructor (collection) {
    this.collection = collection
  }

  put (doc) {
    return new Promise((resolve, reject) => {
      this.collection.insertOne(doc).then(() => resolve(doc)).catch((err) => reject(err))
    })
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

  remove (doc) {
    return this.collection.findAndRemove({'_id': doc._id})
  }
}

class MongoAdaptor {
  table (name) {
    return new Promise((resolve, reject) => {
      let collection = this.db.collection(name)
      resolve(new MongoCollectionAdaptor(collection))
    })
  }

  connect (url = 'mongodb://localhost/') {
    return new Promise((resolve, reject) => {
      MongoClient.connect(url, (err, db) => {
        if (err === null) {
          this.db = db
          resolve(this)
        } else {
          reject(err)
        }
      })
    })
  }
}

exports.create = () => new MongoAdaptor()
