'use strict'

const Database = require('../../src/server/database/database-abstraction.js')

describe('Database', function () {
  it('should create a table', function (done) {
    let db = Database.create()

    db.connect().then(() => {
      db.table('test')
      done()
    })
  })
})
