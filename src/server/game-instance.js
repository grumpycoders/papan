'use strict'

const fs = require('fs')
const path = require('path')

const redux = require('redux')

let registry = {}

const baseDir = path.join(__dirname, '..', '..')

exports.registerGame = (gameId, gamePath) => {
  let dataPath = path.join(baseDir, gamePath, 'game.json')
  if (fs.existsSync(dataPath)) {
    registry[gameId] = gamePath
  }
}

exports.findGameData = (gameId) => {
  const gamePath = registry[gameId]
  if (gamePath) {
    let dataPath = path.join(gamePath, 'game.json')
    let data = fs.readFileSync(dataPath)
    return {
      gameData: JSON.parse(data),
      gamePath: gamePath
    }
  }

  return null
}

exports.createInstance = (gameId, settings = []) => {
  let {gameData, gamePath} = exports.findGameData(gameId)
  const game = require(path.join(baseDir, gamePath, gameData.main))

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

exports.registerGame('tic-tac-toe', 'src/games/tic_tac_toe')