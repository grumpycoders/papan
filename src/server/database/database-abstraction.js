'use strict'

const PapanUtils = require('../../common/utils.js')
const Adaptor = PapanUtils.isElectron() ? require('./pouchdb-adaptor.js') : require('./mongodb-adaptor.js')

exports.create = Adaptor.create
