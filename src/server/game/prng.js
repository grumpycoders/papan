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

    if (min >= max) {
      throw Error('min needs to be less than max')
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

    return this.range(0, faces) + 1
  }

  coin () {
    return this.random() >= 0.5
  }

  shuffle (a) {
    const n = a.length
    for (let i = 0; i <= n - 2; i++) {
      const j = this.range(i, n)
      const t = a[j]
      a[j] = a[i]
      a[i] = t
    }
  }
}

module.exports = PRNG
