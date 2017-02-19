'use strict'

const fs = require('fs')
const path = require('path')

const redux = require('redux')

exports.findGameData = (gameId) => {
  if (gameId == 'tic-tac-toe') {
    let dataPath = path.join(__dirname, '../../src/games/tic_tac_toe/game.json')
    let data = fs.readFileSync(dataPath)
    return JSON.parse(data)
  }

  return null
}

exports.createInstance = (gameId, settings = []) => {
  let data = exports.findGameData(gameId)
  const game = require(path.join(__dirname, '../../src/games/tic_tac_toe', data.main))

  let store = redux.createStore((state, action) => {
    console.log(action)
    switch(action.type) {
    case '@@redux/INIT':
      return game.setUp(['player 1', 'player 2'])
    default:
      return game.transition(state, action)
    }
  })
}

