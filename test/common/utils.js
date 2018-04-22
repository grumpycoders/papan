'use strict'

const assert = require('assert')
const PapanUtils = require('../../src/common/utils.js')

// This is really just to see if the common testing framework
// between NodeJS and Electron works.
describe('PapanUtils.isElectron', function () {
  it('returns a boolean', () => {
    assert(typeof PapanUtils.isElectron() === 'boolean')
  })
})
