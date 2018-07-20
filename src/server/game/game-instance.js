'use strict'

const path = require('path')
const redux = require('redux')
const seedrandom = require('seedrandom').alea
const PRNG = require('./prng.js')
const deepDiff = require('deep-diff')
const PlayersInfo = require('../../common/player-info.js')

exports.createInstance = args => {
  const { gameInfo, playersInfo, settings, seed, channel, restoredState } = args
  const gameLogic = require(path.join(gameInfo.fullPath, gameInfo.json.main))
  const players = PlayersInfo.playersInfoToAllocatedSlotsTree(playersInfo)
  let initialState

  if (restoredState) {
    initialState = restoredState
  } else {
    const initialGameState = gameLogic.setUp({ players: players, settings: settings })
    const initialStep = gameLogic.getStep(initialGameState)
    const initialRngState = seedrandom(seed, { state: true }).state()
    initialState = {
      gameState: initialGameState,
      currentStep: initialStep,
      rngState: initialRngState
    }
  }

  const store = redux.createStore((state, action) => {
    switch (action.type) {
      case 'action':
        const random = seedrandom('', { state: state.rngState })
        const prng = new PRNG(() => random())
        const gameState = gameLogic.transition({
          state: state.gameState,
          action: action.data,
          senders: action.senders,
          prng: prng
        })
        const currentStep = gameLogic.getStep(gameState)
        const newStep = currentStep !== state.currentStep
        return {
          gameState: gameState,
          currentStep: currentStep,
          rngState: newStep ? random.state() : state.rngState
        }
      default:
        return state || initialState
    }
  })

  let previousStep = -1
  let previousPublicScene = {}

  const sceneWatcher = () => {
    const state = store.getState()
    const newPublicScene = gameLogic.getPublicScene(state.gameState)
    const newStep = gameLogic.getStep(state.gameState)
    if (previousStep !== newStep) {
      const deltas = deepDiff(previousPublicScene, newPublicScene)
      channel.sendPublicScene({ previousStep, newStep, deltas })
      previousPublicScene = newPublicScene
      previousStep = newStep
    }

    if (gameLogic.getTemporaryScene) {
      const temporaryScene = gameLogic.getTemporaryScene(state.gameState)
      if (temporaryScene) {
        const deltas = deepDiff(newPublicScene, temporaryScene)
        channel.sendTemporaryScene({ newStep, deltas })
      }
    }
  }

  store.subscribe(sceneWatcher)
  setImmediate(sceneWatcher)

  return {
    sendFullScenes: () => {
      previousPublicScene = {}
      previousStep = -1
      sceneWatcher()
    },
    action: action => {
      store.dispatch({
        type: 'action',
        data: action.data,
        senders: action.senders
      })
    }
  }
}
