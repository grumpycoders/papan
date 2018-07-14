'use strict'

class Lobby extends global.EventEmitter {
  constructor (info, lobbyInterface) {
    super()

    this.info = info
    this.isOwner = lobbyInterface.getUserInfo().id === info.owner.id
    this._publicScenes = [{}, {}]
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

  receiveDeltas (message) {
    const oldStep = message.oldStep
    const newStep = message.newStep
    const publicDelta = message.publicDelta
    if (oldStep !== this._currentStep) {
      this._currentStep = -1
      this._send('PapanLobby.RequestFullUpdate')
      return
    }

    let publicScene = this._publicScenes[0]

    if (oldStep === newStep) {
      this._publicScenes[1] = global.deepmerge(this._pubicScenes[0], {})
      publicScene = this._publicScenes[1]
    }

    this._currentStep = newStep

    publicDelta.forEach(change => {
      global.DeepDiff.applyChange(publicScene, {}, change)
    })

    if (this._element) {
      this._element.alterPublicScene(publicScene)
    }
  }
}

global.Lobby = Lobby
