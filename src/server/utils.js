'use strict'

const fs = require('fs')
const path = require('path')

function mkdirRec (p, cb) {
  fs.mkdir(p, (err) => {
    if (!err || err.code === 'EEXIST') {
      cb(null)
    } else {
      let parent = path.dirname(p)
      if (parent === '.') {
        cb(null)
      }
      mkdirRec(parent, (errrec) => {
        if (errrec) {
          cb(errrec)
        }
        fs.mkdir(p, (err) => {
          if (err && err.code === 'EEXIST') {
            cb(null)
          } else {
            cb(err)
          }
        })
      })
    }
  })
}

exports.mkdirRec = mkdirRec
