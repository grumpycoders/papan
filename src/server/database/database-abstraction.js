'use strict'

const PapanUtils = require('../../common/utils.js')
const Adaptor = PapanUtils.IsElectron() ? require('./pouchdb-adaptor.js') : require('./mongodb-adaptor.js')

exports.connect = Adaptor.connect
