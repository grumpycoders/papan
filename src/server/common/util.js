'use strict'

const crypto = require('crypto')
const fs = require('fs')
const base64url = require('base64url')

exports.generateToken = () =>
new Promise((resolve, reject) => {
  crypto.randomBytes(48, (err, buffer) => {
    if (err) {
      reject(err)
    } else {
      resolve(base64url(buffer))
    }
  })
})

exports.readFile = filename =>
new Promise((resolve, reject) => {
  fs.readFile(filename, (err, data) => {
    resolve(err ? undefined : data)
  })
})

exports.readJSON = filename =>
exports.readFile(filename)
.then(data => data ? JSON.parse(data) : undefined)
