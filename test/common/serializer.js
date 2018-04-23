'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const Serializer = require('../../src/common/serializer.js')
const protoLoader = require('../../src/server/common/proto.js')
const expect = chai.expect

chai.use(dirtyChai)

const loadPromise = protoLoader.load('test.proto', ['test/protos'])

describe('Serializer', () => {
  it('serializes', async () => {
    const serializer = Serializer.createSerializer((await loadPromise).rootProto)
    const serialized = serializer.serialize('PapanTest.Test', { someField: 'foo' })
    const deserialized = serializer.deserialize('PapanTest.Test', serialized)
    expect(deserialized).to.be.deep.equal({
      someField: 'foo',
      someOtherField: 'value'
    })
  })
})
