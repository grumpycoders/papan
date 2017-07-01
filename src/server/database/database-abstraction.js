'use strict'

const PapanUtils = require('../../common/utils.js')
const Adaptor = PapanUtils.isElectron() ? require('./leveldb-adaptor.js') : require('./mongodb-adaptor.js')

exports.create = Adaptor.create
