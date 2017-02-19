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

function sendPublicScene(oldScene, newScene) {
  console.log('old scene: ' + oldScene)
  console.log('new scene: ' + newScene)
}

function sendPrivateScene(oldScene, newScene, player) {

}

exports.createInstance = (gameId, settings = []) => {
  let {gameData, gamePath} = exports.findGameData(gameId)
  const game = require(path.join(baseDir, gamePath, gameData.main))

  let players = settings.players

  let currentPublicScene = undefined
  let currentPrivateScenes = {}

  let store = redux.createStore((state, action) => {
    console.log(action)
    switch(action.type) {
    case '@@redux/INIT':
      return game.setUp(players)
    default:
      return game.transition(state, action)
    }
  })

  let sceneWatcher = () => {
    let state = store.getState()
    let newPublicScene = game.getPublicScene(state)
    sendPublicScene(currentPublicScene, newPublicScene)
    currentPublicScene = newPublicScene

    for (let player of players) {
      let newPrivateScene = game.getPrivateScene(state, player)
      sendPrivateScene(currentPrivateScenes[player], newPrivateScene, player)
      currentPrivateScenes[player] = newPrivateScene
    }
  }

  store.subscribe(sceneWatcher)
  sceneWatcher()

  return {
    game: game,
    gameId: gameId,
    state: store,
    scenes: {
      publicScene: currentPublicScene,
      privateScenes: currentPrivateScenes,
    }
  }
}

exports.registerGame('tic-tac-toe', 'src/games/tic_tac_toe')
