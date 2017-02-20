'use strict';

exports.setUp = function setUp(players) {
  let board = [];
  for (let x = 0; x < 3; x++) {
    board[x] = [];
    for (let y = 0; y < 3; y++) {
      board[x][y] = {owner: null};
    }
  }
  return {
    players,
    player_sides: {
      [players[0]]: 'X',
      [players[1]]: 'O'
    },
    board: board,
    turn: players[0]
  }
}

function checkWinner(board) {
  for (let i = 0; i < 3; i++) {
    let row_owner = [];
    let col_owner = [];
    for (let j = 0; j < 3; j++) {
      row_owner[j] = board[i][j].owner;
      col_owner[j] = board[j][i].owner;
    }
    for (const arr of [row_owner, col_owner]) {
      if (arr[0] !== null) {
        if (arr.every( (val, i, arr) => val === arr[0])) {
          return arr[0];
        }
      }
    }
  }
  let diag1_owner = [board[0][0].owner, board[1][1].owner, board[2][2].owner];
  let diag2_owner = [board[0][2].owner, board[1][1].owner, board[2][0].owner];
  for (const arr of [diag1_owner, diag2_owner]) {
    if (arr[0] !== null) {
      if (arr.every( (val, i, arr) => val === arr[0])) {
        return arr[0];
      }
    }
  }
  return null;
}

function otherPlayer(state, player) {
  if (player === state.players[0]) {
    return state.players[1];
  } else {
    return state.players[0];
  }
}

exports.transition = function transition(state, action) {
  if (action.name != "take") {
    return state;
  }
  let {x, y} = action.attributes.position;
  if (state.board[x][y].owner !== null) {
    return state;
  }
  state.board[x][y].owner = state.turn;
  let winner = checkWinner(state.board);
  if (winner !== null) {
    state.winner = winner;
  }
  state.turn = otherPlayer(state, state.turn);
  return state;
}

exports.getPublicScene = function getPublicScene(state) {
  let actors = {};
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      let class_list = [];
      let actions = [];
      if (state.board[x][y].owner) {
        class_list = [state.player_sides[state.board[x][y].owner]];
      } else {
        class_list = ['empty']
        actions = [
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
        ];
      }
      let id = 'space_' + x + '_' + y;
      actors[id] = {
        attributes: {
          position: {x, y},
        },
        class: class_list,
        actions
      };
    }
  }
  actors['turn'] = {
    attributes: {
      player: state.turn
    },
    class: ['turn']
  }
  if (state.hasOwnProperty('winner')) {
    actors['winner'] = {
      attributes: {
        player: state.winner
      },
      class: ['winner']
    };
  }
  return actors;
}

exports.getPrivateScene = function getPrivateScene(state, player) {
  return [];
}
