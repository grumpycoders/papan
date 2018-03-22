'use strict'

const grpc = require('grpc')
const path = require('path')
const protobufjs = require('protobufjs')
const recursive = require('recursive-readdir')
const protosdirs = ['protos'].map(
  protopath => path.normalize(path.join(__dirname, '..', '..', '..', protopath))
)
let allprotos = {}

exports.load = filename => {
  let root = new protobufjs.Root()
  root.resolvePath = (origin, target) => {
    let foundValue = ''
    Object.keys(allprotos).forEach(base => {
      allprotos[base].forEach(filename => {
        if (filename.endsWith(target)) foundValue = filename
      })
    })
    return foundValue
  }

  return Promise.all(protosdirs.map(path => recursive(path)))
  .then(results => {
    protosdirs.map((key, index) => {
      allprotos[key] = results[index]
    })
    return protobufjs.load(filename, root)
  })
  .then(proto => {
    return grpc.loadObject(proto)
  })
}
