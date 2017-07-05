'use strict'

const express = require('express')
const fs = require('fs')

exports.registerServer = (app, config) => {
  // Static files first.
  app.use('/src/common', express.static('src/common'))
  app.use('/src/client/auth', express.static('src/client/auth'))
  app.use('/bower_components', express.static('bower_components'))
  app.use('/docs', express.static('docs'))
  app.use('/node_modules', express.static('node_modules'))
  app.use('/template', express.static('template'))

  // The dynamic AJAX stuff
  app.post('/auth/login', (req, res) => {

  })
  app.post('/auth/create', (req, res) => {

  })
  app.post('/auth/google-login', (req, res) => {

  })

  // The callback from Google
  app.post('/auth/google-login-callback', (req, res) => {

  })

  // Setting up async stuff.
  return new Promise((resolve, reject) => {
    // Reading the index file and storing it for the duration of our run.
    // We probably would want to set up caching...
    fs.readFile('auth-index.html', (err, data) => {
      if (err) reject(err)
      app.get('/', (req, res) => {
        res.set('Content-Type', 'text/html')
        res.send(data)
      })
      resolve()
    })
  })
}
