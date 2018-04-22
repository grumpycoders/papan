'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const PapanUtils = require('../../src/common/utils.js')
const expect = chai.expect

chai.use(dirtyChai)

// This is really just to see if the common testing framework
// between NodeJS and Electron works.
describe('PapanUtils.isElectron', () => {
  it('is false', () => {
    expect(PapanUtils.isElectron()).to.be.false()
  })
})
