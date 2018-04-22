'use strict'

const chai = require('chai')
const dirtyChai = require('dirty-chai')
const PapanUtils = require('../../src/common/utils.js')
const expect = chai.expect

chai.use(dirtyChai)

describe('PapanUtils.isElectron', () => {
  it('returns a boolean', () => {
    expect(typeof PapanUtils.isElectron()).to.be.equal('boolean')
  })
})

describe('PapanUtils.areArraysEqual', () => {
  it('42 === 42', () => {
    expect(PapanUtils.areArraysEqual(42, 42)).to.be.true()
  })

  it('42 !== 43', () => {
    expect(PapanUtils.areArraysEqual(42, 43)).to.be.false()
  })

  it('42 !== [42]', () => {
    expect(PapanUtils.areArraysEqual(42, [42])).to.be.false()
  })

  it('[42] !== 42', () => {
    expect(PapanUtils.areArraysEqual([42], 42)).to.be.false()
  })

  it('[42] === [42]', () => {
    expect(PapanUtils.areArraysEqual([42], [42])).to.be.true()
  })

  it('[42, 43] !== [42]', () => {
    expect(PapanUtils.areArraysEqual([42, 43], [42])).to.be.false()
  })

  it('[42, 43] !== [42, 42]', () => {
    expect(PapanUtils.areArraysEqual([42, 43], [42, 42])).to.be.false()
  })
})

describe('PapanUtils.JSON', () => {
  it('serializes binary buffers properly', () => {
    const buf = Buffer.from('foo')
    const serial = PapanUtils.JSON.stringify({ buf: buf })
    const obj = PapanUtils.JSON.parse(serial)
    expect(obj.buf.toString()).to.be.equal('foo')
  })
})

describe('PapanUtils.delayedPromise', () => {
  it('resolves after some time', (done) => {
    const start = Date.now()
    Promise.all([
      PapanUtils.delayedPromise(200, 'resolved')
        .then(result => {
          const stop = Date.now()
          expect(result).to.be.equal('resolved')
          expect(stop - start).to.be.lessThan(300)
        }),
      PapanUtils.delayedPromise(200, 'rejected', false)
        .catch(result => {
          const stop = Date.now()
          expect(result).to.be.equal('rejected')
          expect(stop - start).to.be.lessThan(300)
        })
    ]).then(() => done())
  })
})

describe('PapanUtils.path', () => {
  it('toString', () => {
    expect(PapanUtils.path.toString('foo')).to.be.equal('foo')
  })

  it('basename', () => {
    expect(PapanUtils.path.basename('a/b/c')).to.be.equal('c')
  })

  it('dirname', () => {
    expect(PapanUtils.path.dirname('a/b/c')).to.be.equal('a/b')
  })

  it('isAbsolute', () => {
    expect(PapanUtils.path.isAbsolute('/a/b/c')).to.be.true()
    expect(PapanUtils.path.isAbsolute('a/b/c')).to.be.false()
  })

  it('isBelow', () => {
    expect(PapanUtils.path.isBelow('../../a/b/c')).to.be.true()
    expect(PapanUtils.path.isBelow('/a/b/c')).to.be.false()
    expect(PapanUtils.path.isBelow('a/b/c')).to.be.false()
  })

  it('normalize', () => {
    expect(PapanUtils.path.normalize('../../foo/bar/baz/../x/z')).to.be.equal('../../foo/bar/x/z')
  })

  it('join', () => {
    expect(PapanUtils.path.join('a', 'b', 'c')).to.be.equal('a/b/c')
    expect(PapanUtils.path.join('/foo/bar', '../baz')).to.be.equal('/foo/bar/../baz')
  })

  it('combo', () => {
    const path = new PapanUtils.Path('/foo/bar').join('..', '..', '..', 'xyz')
    expect(path.isValid()).to.be.false()
  })
})
