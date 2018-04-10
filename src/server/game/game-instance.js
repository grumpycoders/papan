'use strict'

const path = require('path')
const redux = require('redux')
const seedrandom = require('seedrandom').alea
const PRNG = require('./prng.js')

exports.createInstance = args => {
  const { gameInfo, settings, seed, channel, restoredState } = args
  const gameLogic = require(path.join(gameInfo.fullPath, gameInfo.json.main))
  const players = settings.players
  let initialState

  if (restoredState) {
    initialState = restoredState
  } else {
    const initialGameState = gameLogic.setUp(settings.players)
    const initialStep = gameLogic.getStep(initialGameState)
    const initialRngState = seedrandom(seed, { state: true })
    initialState = {
      gameState: initialState,
      currentStep: initialStep,
      rngState: initialRngState
    }
  }

  let store = redux.createStore((state, action) => {
    let gameState
    const random = seedrandom('', { state: state.rngState })
    const prng = new PRNG(() => random())
    let deadline
    let deadlineAction
    let deadlineSet = false
    const setTimeout = (payload, timeout) => {
      if (timeout === undefined) {
        deadline = undefined
        deadlineAction = undefined
      } else {
        deadline = (new Date()).getTime() + timeout
        deadlineAction = payload
      }
      deadlineSet = true
    }
    switch (action.type) {
      case '@@redux/INIT':
        return initialState
      case 'action':
        const gotTimeout = (state.deadline && state.deadline > (new Date().getTime()))
        gameState = gameLogic.transition({
          state: state.gameState,
          action: gotTimeout ? state.deadlineAction : action.data,
          prng: prng,
          setTimeout: setTimeout
        })
        const currentStep = gameLogic.getStep(gameState)
        const newStep = currentStep !== state.currentStep
        return {
          deadline: deadlineSet ? deadline : state.deadline,
          deadlineAction: deadlineSet ? deadlineAction : state.deadlineAction,
          gameState: gameState,
          currentStep: currentStep,
          rngState: newStep ? PRNG.state() : state.rngState
        }
    }
  })

  const sceneWatcher = () => {
    const state = store.getState()
    const newPublicScene = gameLogic.getPublicScene(state)
    const step = gameLogic.getStep(state)
    channel.sendPublicScene(step, newPublicScene)

    if (!gameLogic.getPrivateScene) return

    for (let player of players) {
      const newPrivateScene = gameLogic.getPrivateScene(state, player)
      channel.sendPrivateScene(step, newPrivateScene, player)
    }
  }

  store.subscribe(sceneWatcher)

  return {
    serialize: () => store.getState(),
    action: action => {
      store.dispatch({
        type: 'action',
        data: action
      })
    }
  }
}
