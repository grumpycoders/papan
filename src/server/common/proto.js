'use strict'

const grpc = require('grpc')
const path = require('path')
const protobufjs = require('protobufjs')
const recursive = require('recursive-readdir')

exports.load = (filenames, paths = ['protos']) => {
  let allprotos = {}
  let singleResult = false
  if (typeof filenames === 'string') {
    singleResult = true
    filenames = [filenames]
  }

  const protosdirs = paths.map(
    protopath => path.normalize(path.join(__dirname, '..', '..', '..', protopath))
  )
  let root = new protobufjs.Root()
  root.resolvePath = (origin, target) => {
    let foundValue = ''
    Object.keys(allprotos).forEach(base => {
      allprotos[base].forEach(filename => {
        if (filename === target) foundValue = path.join(base, filename)
      })
    })
    return foundValue
  }

  return Promise.all(protosdirs.map(path => recursive(path)))
  .then(results => {
    protosdirs.map((key, index) => {
      allprotos[key] = results[index].map(fullpath => path.relative(key, fullpath))
    })
    return Promise.all(filenames.map(filename => protobufjs.load(filename, root)))
  })
  .then(protos => {
    const results = protos.map(proto => grpc.loadObject(proto))
    return singleResult ? results[0] : results
  })
}
