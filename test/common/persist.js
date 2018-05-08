'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const Persist = require('../../src/server/lobby/persist.js')
const expect = chai.expect

chai.use(dirtyChai)

describe('Persist', () => {
  const persistPromise = Persist.createPersist()

  let persist
  before(done => {
    persistPromise.then(result => {
      persist = result
      done()
    })
  })

  it('lobby ops', async () => {
    let lobbyId
    {
      const lobbyInfo = await persist.createLobby({ userId: '1' })
      expect(lobbyInfo.owner.id).to.equal('1')
      lobbyId = lobbyInfo.id
    }

    {
      const lobbyInfo = await persist.joinLobby({ userId: '2', id: lobbyId })
      expect(lobbyInfo.members).to.deep.equal([{ id: '1' }, { id: '2' }])
    }

    {
      const publicLobbies = await persist.getPublicLobbies()
      expect(publicLobbies).to.deep.equal([])
    }

    {
      const lobbyInfo = await persist.setLobbyPublic({
        userId: '1',
        id: lobbyId,
        public: true
      })
      expect(lobbyInfo.public).to.be.true()
    }

    {
      const publicLobbies = await persist.getPublicLobbies()
      expect(publicLobbies).to.be.deep.equal([lobbyId])
    }

    let slot1id
    let slot2id

    {
      const lobbyInfo = await persist.setLobbyGame({
        userId: '1',
        id: lobbyId,
        gameInfo: {
          json: {
            playersInfo: {
              info: 'players',
              players: {
                min: 2,
                max: 2
              }
            }
          }
        }
      })
      expect(lobbyInfo.playersInfo.slots.slot.length).to.be.equal(2)
      slot1id = lobbyInfo.playersInfo.slots.slot[0].id
      slot2id = lobbyInfo.playersInfo.slots.slot[1].id
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        userId: '1',
        senderId: '1',
        slotId: slot1id
      })
      expect(lobbyInfo.playersInfo.slots.slot[0].user.id).to.be.equal('1')
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        userId: '2',
        senderId: '2',
        slotId: slot2id
      })
      expect(lobbyInfo.playersInfo.slots.slot[1].user.id).to.be.equal('2')
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        userId: '2',
        senderId: '2',
        slotId: slot1id
      })
      expect(lobbyInfo.playersInfo.slots.slot[0].user.id).to.be.equal('1')
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        userId: '2',
        senderId: '1',
        slotId: slot1id
      })
      expect(lobbyInfo.playersInfo.slots.slot[0].user.id).to.be.equal('2')
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        userId: 'foo',
        senderId: '1',
        slotId: slot1id
      })
      expect(lobbyInfo.playersInfo.slots.slot[0].user.id).to.be.equal('2')
    }

    {
      const lobbyInfo = await persist.assignSlot({
        lobbyId: lobbyId,
        senderId: '1',
        slotId: slot1id
      })
      expect(lobbyInfo.playersInfo.slots.slot[0].user).to.be.undefined()
    }
  })

  after(() => {
    persist.close()
  })
})
