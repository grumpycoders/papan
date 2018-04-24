'use strict'

const fs = require('fs')
const path = require('path')
const Module = require('module')
const actualRequire = Module.prototype.require

Module.prototype.require = function (moduleName, ...args) {
  let ret
  const absolutePath = path.normalize(path.join(path.dirname(this.id), moduleName))
  const papanBasePath = path.normalize(path.join(__dirname, '..', '..'))
  const baseRelativePath = path.relative(papanBasePath, absolutePath)
  const fragments = baseRelativePath.split(path.sep)
  if (fragments[0] === 'src') {
    fragments[0] = 'instrumented'
  }
  const newPath = path.join(papanBasePath, ...fragments)
  try {
    ret = actualRequire.call(this, newPath, ...args)
  } catch (e) {
    ret = actualRequire.call(this, moduleName, ...args)
  }

  return ret
}

function alterAllPathsStage1 (map, paths) {
  Object.keys(map).forEach(key => {
    const value = map[key]
    if (key === 'path' && typeof value === 'string') {
      const oldPath = value
      const newPath = path.posix.join('src', oldPath)
      paths[oldPath] = newPath
      map[key] = newPath
    }
    if (typeof value === 'object') alterAllPathsStage1(value, paths)
  })
}

function alterAllPathsStage2 (map, paths) {
  Object.keys(map).forEach(key => {
    const value = map[key]
    const newPath = paths[key]
    if (newPath) {
      map[newPath] = value
      delete map[key]
    }
    if (typeof value === 'object') alterAllPathsStage2(value, paths)
  })
}

function report () {
  try {
    fs.mkdirSync('.nyc_output')
  } catch (_) { }
  const map = global.__coverage__
  const paths = {}
  alterAllPathsStage1(map, paths)
  alterAllPathsStage2(map, paths)
  const filename = process.hrtime().concat(process.pid).map(String).join('-') + '.json'
  fs.writeFileSync(path.join('.nyc_output', filename), JSON.stringify(map || {}))
}

if (process.type === 'renderer') {
  window.addEventListener('unload', report)
} else {
  process.on('exit', report)
}
