'use strict'

class Lobby extends global.EventEmitter {
  constructor (info, lobbyInterface) {
    super()

    this.info = info
    this.isOwner = lobbyInterface.getUserInfo().id === info.owner.id
    this._publicScene = {}
    this._currentStep = -1
  }

  _send (message, data) {
    global.channel.send(message, data, { id: this.info.id })
  }

  update (info) {
    this.info = info
    this.emit('update', this)
    console.log('update')
    console.log(info)
  }

  getInfo () {
    return this.info
  }

  isOwner () {
    return this.isOwner
  }

  setPublic (pub) {
    if (this.isOwner) {
      this._send('PapanLobby.SetLobbyPublic', {
        public: pub
      })
    }
  }

  setName (name) {
    if (this.isOwner) {
      this._send('PapanLobby.SetLobbyName', {
        name: name
      })
    }
  }

  setGame (gameInfo) {
    if (this.isOwner) {
      this._send('PapanLobby.SetLobbyGame', {
        info: gameInfo
      })
    }
  }

  sendChatMessage (message) {
    this._send('PapanLobby.LobbyChatMessage', {
      message: {
        message: message
      }
    })
  }

  startGame () {
    this._send('PapanLobby.StartGame')
  }

  assignSlot (userId, slotData) {
    this._send('PapanLobby.AssignSlot', global.deepmerge({ user: { id: userId } }, slotData))
  }

  setBoardElement (element) {
    this._boardElement = element
  }

  publicScene (message) {
    const previousStep = message.previousStep
    const newStep = message.newStep
    const deltas = global.DeepDiffWrapper.unwrap(message.deltas)
    if (previousStep !== this._currentStep) {
      this._currentStep = -1
      this._send('PapanLobby.RequestFullUpdate')
      return
    }

    this._currentStep = newStep
    deltas.forEach(change => {
      global.DeepDiff.applyChange(this._publicScene, change)
    })

    if (this._boardElement) {
      this._boardElement.alterPublicScene(this._publicScene)
    }
  }

  action (action) {
    this._send('PapanLobby.SceneAction', {
      message: global.PapanUtils.JSON.stringify(action)
    })
  }
}

global.Lobby = Lobby
