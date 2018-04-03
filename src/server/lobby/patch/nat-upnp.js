'use strict'

const nat = exports

nat.utils = require('./utils.js')
nat.ssdp = require('./ssdp.js')
nat.device = require('./device.js')
nat.createClient = require('./client.js').create
