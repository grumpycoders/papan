'use strict'

const grpc = require('grpc')
const path = require('path')
const protobufjs = require('protobufjs')
const recursive = require('recursive-readdir')

exports.load = async (filenames, paths = ['protos']) => {
  let allprotos = {}
  if (typeof filenames === 'string') {
    filenames = [filenames]
  }

  const protosdirs = paths.map(
    protopath => path.normalize(path.join(__dirname, '..', '..', '..', protopath))
  )
  const root = new protobufjs.Root()
  root.resolvePath = (origin, target) => {
    let foundValue = ''
    Object.keys(allprotos).forEach(base => {
      allprotos[base].forEach(filename => {
        if (filename === target) foundValue = path.join(base, filename)
      })
    })
    return foundValue
  }

  const results = await Promise.all(protosdirs.map(path => recursive(path)))
  protosdirs.map((key, index) => {
    allprotos[key] = results[index].map(fullpath => path.relative(key, fullpath))
  })
  const proto = await protobufjs.load(filenames, root)
  const ret = grpc.loadObject(proto, { protobufjsVersion: 6 })
  ret.rootProto = proto
  return ret
}
