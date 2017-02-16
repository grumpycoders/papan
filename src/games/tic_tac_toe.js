'use strict';

exports.setUp = function setUp(players) {
  let player_sides = {
    [players[0]]: 'X',
    [players[1]]: 'O'
  };
  let board = [];
  for (let x = 0; x < 3; y++) {
    board[x] = [];
    for (let y = 0; y < 3; x ++) {
      board[x][y] = {
        position: {x, y}
      };
    }
  }
  return {
    players,
    player_sides,
    board,
    turn: players[0]
  }
}

function checkWinner(board) {
  for (let i = 0; i < 3; i++) {
    row_owner = [];
    col_owner = [];
    for (let j = 0; j < 3; j++) {
      row_owner[j] = board[i][j].owner;
      col_owner[j] = board[j][i].owner;
    }
    for (const arr of [row_owner, col_owner]) {
      if (arr[0] !== null && arr[0] != undefined) {
        if (arr.every( (val, i, arr) => val === arr[0])) {
          return arr[0];
        }
      }
    }
  }
  diag1_owner = [board[0][0].owner, board[1][1].owner, board[2][2].owner];
  diag2_owner = [board[0][2].owner, board[1][1].owner, board[2][0].owner];
  for (const arr of [diag1_owner, diag2_owner]) {
    if (arr[0] !== null && arr[0] != undefined) {
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
  if (action.player != state.turn) {
    return state;
  }
  let {x, y} = action.args.position;
  state.board[x][y] = {
    position: {x, y},
    owner: action.player
  };
  let winner = checkWinner(state.board);
  if (winner !== null) {
    state.winner = winner;
  }
  state.turn = otherPlayer(state, state.turn);
  return state;
}

exports.getPublicScene = function getPublicScene(state) {
  let actors = {};
  for (let x = 0; x < 3; y++) {
    for (let y = 0; y < 3; x ++) {
      let class_list = [];
      if (state.board[i][j].hasOwnProperty('owner')) {
        class_list = [state.player_sides[state.board[i][j].owner]];
      } else {
        class_list = ['empty']
      }
      id = 'space_' + x + '_' + y;
      actors[id] = {
        attributes: {
          position: {x, y},
        },
        class: class_list,
        actions: [
          { player: state.players[0] },
          { player: state.players[1] }
        ]
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

exports.name = "Tic Tac Toe"
