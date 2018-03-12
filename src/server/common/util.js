'use strict'

const crypto = require('crypto')
const base64url = require('base64url')

exports.generateToken = () => new Promise((resolve, reject) => {
  crypto.randomBytes(48, (err, buffer) => {
    if (err) {
      reject(err)
    } else {
      resolve(base64url(buffer))
    }
  })
})
