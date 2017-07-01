'use strict'

const Database = require('../../src/server/database/database-abstraction.js')
const assert = require('assert')

describe('Database', () => {
  it('should create a table', (done) => {
    let db = Database.create()

    db.connect().then(() => {
      db.table('test').then(() => { done() })
    })
  })
})

describe('Database', function () {
  it('should put, get, update and remove a document properly', (done) => {
    let db = Database.create()
    let table

    db.connect().then(() =>
    db.table('test')).then((value) => {
      table = value
      return table.put({
        _id: 42,
        data: 'foobar'
      })
    }).then(() =>
    table.get(42)).then((doc) => {
      assert.equal(doc._id, 42)
      assert.equal(doc.data, 'foobar')
      doc.data = 'barfoo'
      return table.update(doc)
    }).then(() =>
    table.get(42)).then((doc) => {
      assert.equal(doc._id, 42)
      assert.equal(doc.data, 'barfoo')
      table.remove(doc).then(() => { done() })
    })
  })
})
