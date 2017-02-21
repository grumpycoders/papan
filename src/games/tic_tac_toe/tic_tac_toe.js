'use strict'

exports.setUp = (players) => {
  let board = []
  for (let x = 0; x < 3; x++) {
    board[x] = []
    for (let y = 0; y < 3; y++) {
      board[x][y] = {owner: null}
    }
  }
  return {
    players,
    player_sides: {
      [players[0]]: 'X',
      [players[1]]: 'O'
    },
    winner: null,
    board: board,
    turn: players[0],
    turns: 0
  }
}

function checkWinner (board) {
  for (let i = 0; i < 3; i++) {
    let rowOwner = []
    let colOwner = []
    for (let j = 0; j < 3; j++) {
      rowOwner[j] = board[i][j].owner
      colOwner[j] = board[j][i].owner
    }
    for (const arr of [rowOwner, colOwner]) {
      if (arr[0] !== null) {
        if (arr.every((val, i, arr) => val === arr[0])) {
          return arr[0]
        }
      }
    }
  }
  let diag1Owner = [board[0][0].owner, board[1][1].owner, board[2][2].owner]
  let diag2Owner = [board[0][2].owner, board[1][1].owner, board[2][0].owner]
  for (const arr of [diag1Owner, diag2Owner]) {
    if (arr[0] !== null) {
      if (arr.every((val, i, arr) => val === arr[0])) {
        return arr[0]
      }
    }
  }
  return null
}

function otherPlayer (state, player) {
  if (player === state.players[0]) {
    return state.players[1]
  } else {
    return state.players[0]
  }
}

exports.transition = (state, action) => {
  if (action.name !== 'take' && !!state.winner) {
    return state
  }
  let {x, y} = action.attributes.position
  if (state.board[x][y].owner !== null) {
    return state
  }
  state.turns++
  state.board[x][y].owner = state.turn
  state.winner = checkWinner(state.board)
  state.turn = otherPlayer(state, state.turn)
  return state
}

exports.getPublicScene = (state) => {
  let actors = {}
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      let classList = []
      let actions = []
      if (state.board[x][y].owner) {
        classList = [state.player_sides[state.board[x][y].owner]]
      } else {
        classList = ['empty']
        actions = state.winner && [
          {
            name: 'take',
            conditions: [
              {
                type: 'is_in_set',
                element: {
                  type: 'actor',
                  name: 'turn',
                  property: 'player'
                },
                set: {
                  type: 'channel',
                  value: 'players'
                }
              }
            ]
          }
        ] || []
      }
      let id = 'space_' + x + '_' + y
      actors[id] = {
        attributes: {
          position: {x, y}
        },
        class: classList,
        actions
      }
    }
  }
  actors['turn'] = {
    attributes: {
      player: state.turn
    },
    class: ['turn']
  }
  if (!!state.winner || state.turns === 9) {
    actors['winner'] = {
      attributes: {
        player: state.winner
      },
      class: ['winner']
    }
  }
  return actors
}

exports.getPrivateScene = (state, player) => []

exports.isRunning = (state) => !state.winner && state.turns !== 9
