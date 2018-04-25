'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const Persist = require('../../src/server/lobby/persist.js')
const expect = chai.expect

chai.use(dirtyChai)

const persistPromise = Persist.createPersist()

describe('Persist', () => {
  let persist
  before(done => {
    persistPromise.then(result => {
      persist = result
      done()
    })
  })

  it('createLobby', done => {
    persist.createLobby({ userId: '1' })
      .then(lobbyInfo => {
        expect(lobbyInfo.owner.id).to.equal('1')
        done()
      })
  })

  after(() => {
    persist.close()
  })
})
