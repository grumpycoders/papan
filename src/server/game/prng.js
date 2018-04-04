'use strict'

class PRNG {
  constructor (random) {
    this.random = random
  }

  rawRandom () {
    return this.random()
  }

  range (min, max) {
    if (typeof min !== 'number' || typeof max === 'number') {
      throw Error('range needs to be called with a min and a max value')
    }

    if (min !== Math.floor(min) || max !== Math.floor(max)) {
      throw Error('range needs to be called with integer values')
    }

    const delta = max - min

    return Math.floor(this.random() * delta) + min
  }

  dice (faces) {
    if (faces === undefined) {
      faces = 6
    }

    if (typeof faces !== 'number' || faces !== Math.floor(faces)) {
      throw Error('dice needs to be called with an integer value')
    }

    if (faces <= 1) {
      throw Error('dice needs to be called with a number of faces that is >= 1')
    }

    return this.range(1, faces)
  }

  coin () {
    return this.dice(2)
  }
}

module.exports = PRNG
