'use strict'

const crypto = require('crypto')
const fs = require('fs')
const base64url = require('base64url')

exports.generateToken = (length = 48) =>
  new Promise((resolve, reject) => {
    crypto.randomBytes(length, (err, buffer) => {
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

exports.promisifyClass = object => {
  const locals = {}
  return new Proxy(object, {
    set: (target, prop, value) => {
      locals[prop] = value
      return true
    },
    get: (target, prop, receiver) => {
      if (locals[prop]) return locals[prop]
      if (typeof object[prop] !== 'function') return object[prop]
      return (...args) => new Promise((resolve, reject) => {
        object[prop](...args, (err, ...results) => {
          if (err) {
            reject(err)
          } else {
            switch (results.length) {
              case 0:
                resolve()
                break
              case 1:
                resolve(results[0])
                break
              default:
                resolve(results)
                break
            }
          }
        })
      })
    }
  })
}
