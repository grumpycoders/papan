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

function report () {
  const filename = process.hrtime().concat(process.pid).map(String).join('-') + '.json'
  fs.writeFileSync(path.join('.nyc_output', filename), JSON.stringify(global.__coverage__ || {}))
}

if (process.type === 'browser') {
  process.on('exit', report)
} else {
  window.addEventListener('unload', report)
}
