'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const PapanUtils = require('../../src/common/utils.js')
const expect = chai.expect

chai.use(dirtyChai)

describe('PapanUtils.isElectron', () => {
  it('is false', () => {
    expect(PapanUtils.isElectron()).to.be.false()
  })
})
