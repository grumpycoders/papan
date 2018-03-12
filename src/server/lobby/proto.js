'use strict'

const grpc = require('grpc')
const protobufjs = require('protobufjs')
const recursive = require('recursive-readdir')
const protosdirs = ['protos']
let allprotos = {}

exports.load = () => {
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
    return protobufjs.load('lobby.proto', root)
  })
  .then(proto => {
    return grpc.loadObject(proto)
  })
}
