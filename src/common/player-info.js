((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    register(module.exports)
  } else {
    that.PlayerInfo = {}
    register(that.PlayerInfo)
  }
})(global, that => {
  'use strict'

  that.playersInfoToAllocatedTree = playersInfo => {
    if (playersInfo.info === 'teams') {
      return playersInfo.teams.teams.map(team => {
        const recursed = that.processPlayersInfo(team.playersInfo)
        if (recursed.length === 0) return false
        return {
          teamName: team.name,
          teamId: team.id,
          players: that.processPlayersInfo(team.playersInfo)
        }
      }).filter(team => team)
    } else {
      return playersInfo.slots.slot.filter(slot => slot.user).map(slot => {
        const obj = {}
        obj[slot.id] = slot.user
        return obj
      })
    }
  }

  that.playersInfoToAllocatedSlotsTree = playersInfo => {
    const tree = that.playersInfoToAllocatedTree(playersInfo)
    function processSubtree (tree) {
      return tree.map(slotOrTeam => {
        if (slotOrTeam.teamName) {
          slotOrTeam.players = processSubtree(slotOrTeam.players)
          return slotOrTeam
        } else {
          return Object.keys(slotOrTeam)[0]
        }
      })
    }
    return processSubtree(tree)
  }

  that.playersInfoSlotsToPlayers = playersInfo => {
    const results = {}
    const tree = that.playersInfoToAllocatedTree(playersInfo)
    function processSubtree (tree) {
      return tree.forEach(slotOrTeam => {
        if (slotOrTeam.teamName) {
          processSubtree(slotOrTeam.players)
        } else {
          const slotId = Object.keys(slotOrTeam)[0]
          results[slotId] = slotOrTeam[slotId]
        }
      })
    }
    processSubtree(tree)
    return results
  }

  that.playersInfoPlayersIdToSlots = playersInfo => {
    const slotsToPlayers = that.playersInfoSlotsToPlayers(playersInfo)
    const results = {}
    Object.keys(slotsToPlayers).forEach(slotId => {
      const userId = slotsToPlayers[slotId].id
      if (!results[userId]) results[userId] = []
      results[userId].push(slotId)
    })
    return results
  }
})
