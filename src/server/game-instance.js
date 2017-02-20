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

exports.createInstance = (args) => {
  let { gameId, settings, channel } = args
  let { gameData, gamePath } = exports.findGameData(gameId)
  const game = require(path.join(baseDir, gamePath, gameData.main))

  let players = settings.players

  let currentPublicScene = {}
  let currentPrivateScenes = {}
  for (let player of players) {
    currentPrivateScenes[player] = {}
  }

  let store = redux.createStore((state, action) => {
    switch(action.type) {
    case '@@redux/INIT':
      return game.setUp(players)
    case 'action':
      return game.transition(state, action.data)
    }
  })

  const sceneWatcher = () => {
    let state = store.getState()
    let newPublicScene = game.getPublicScene(state)
    channel.sendPublicScene(currentPublicScene, newPublicScene)
    currentPublicScene = newPublicScene

    for (let player of players) {
      let newPrivateScene = game.getPrivateScene(state, player)
      channel.sendPrivateScene(currentPrivateScenes[player], newPrivateScene, player)
      currentPrivateScenes[player] = newPrivateScene
    }
  }

  store.subscribe(sceneWatcher)
  let state = store.getState()
  currentPublicScene = game.getPublicScene(state)
  for (let player of players) {
    currentPrivateScenes[player] = game.getPrivateScene(state, player)
  }

  return {
    game: game,
    gameId: gameId,
    getState: () => {
      return store.getState()
    },
    refreshPublicScene: () => {
      channel.sendPublicScene({}, currentPublicScene)
    },
    refreshPrivateScene: (player) => {
      channel.sendPrivateScene({}, currentPrivateScenes[player], player)
    },
    action: (action) => {
      store.dispatch({
        type: 'action',
        data: action
      })
    }
  }
}

exports.registerGame('tic-tac-toe', 'src/games/tic_tac_toe')
