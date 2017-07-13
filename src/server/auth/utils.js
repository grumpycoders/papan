'use strict'

const crypto = require('crypto')

exports.GenerateToken = (length = 66) => {
  const dictionary = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  return new Promise((resolve, reject) => {
    crypto.randomBytes(length + 1, (err, buf) => {
      if (err) reject(err)
      let tokens = []
      const start = buf[length]
      for (let i = 0; i < length; i++) {
        tokens[i] = dictionary[(i + start + buf[i]) % dictionary.length]
      }
      resolve(tokens.join(''))
    })
  })
}
