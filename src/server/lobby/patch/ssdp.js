'use strict'

const patch = require('patch-module')
const path = require('path')

const root = path.join(__dirname, '..', '..', '..', '..', 'node_modules', 'nat-upnp')
const nat = path.join(__dirname, 'nat-upnp.js').replace(/\\/g, '/')

module.exports = patch(path.join(root, 'lib', 'nat-upnp', 'ssdp.js'), {
  version: '1.1.1',
  package: path.join(root, 'package.json')
}, [
  {
    find: '../nat-upnp',
    replace: nat,
    expects: 1
  }
])
