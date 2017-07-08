'use strict'

const path = require('path')
const express = require('express')
const bodyParser = require('body-parser')
const winston = require('winston')
const expressWinston = require('express-winston')
const session = require('express-session')
const pg = require('pg')
const PGSession = require('connect-pg-simple')(session)

const passport = require('passport')

const userDB = require('./userdb.js')

const root = path.normalize(path.join(__dirname, '..', '..', '..'))

exports.registerServer = (app, config) => {
  let promises = []
  let authentications = {}
  // logger
  app.use(expressWinston.logger({
    transports: [
      new winston.transports.Console({
        json: false,
        colorize: true
      })
    ],
    meta: true,
    expressFormat: true
  }))

  // session management
  const pgPool = new pg.Pool(config.pgConfig)
  app.use(session({
    store: new PGSession({
      pool: pgPool,
      tableName: 'session'
    }),
    secret: config.httpConfig.secret,
    resave: false,
    saveUninitialized: false
  }))

  // user management
  const users = userDB.create(config.pgConfig)
  promises.push(users.initialize())

  // we'll do ajax
  app.use(bodyParser.json())

  // passport
  app.use(passport.initialize())
  app.use(passport.session())

  passport.serializeUser((err, done) => users.serialize(err, done))
  passport.deserializeUser((err, done) => users.deserialize(err, done))
  passport.authenticated = returnURL => {
    return (req, res, next) => {
      if (req.isAuthenticated()) return next()
      req.session.returnURL = returnURL || req.returnURL
      res.redirect('/login')
    }
  }

  // Static files
  function sendRoot (res) {
    res.sendFile(path.join(root, 'auth-index.html'))
  }
  app.use('/src/common', express.static('src/common'))
  app.use('/src/client/auth', express.static('src/client/auth'))
  app.use('/bower_components', express.static('bower_components'))
  app.use('/docs', express.static('docs'))
  app.use('/node_modules', express.static('node_modules'))
  app.use('/template', express.static('template'))
  app.get('/', (req, res) => sendRoot(res))
  app.get('/login', (req, res) => sendRoot(res))
  app.get('/profile', (req, res) => sendRoot(res))

  // AJAX
  app.get('/profile/data', passport.authenticated(), (req, res) => {
    res.json(req.user.dataValues)
  })
  app.get('/auth/available', (req, res) => res.json(authentications))

  // Auth providers logic
  const registerProvider = (provider) => {
    app.get(
      `/auth/${provider.urlFragment}/login`, (req, res, next) => {
        if (req.isAuthenticated()) res.redirect('/profile')
        passport.authenticate(provider.create)(req, res, next)
      }
    )
    app.get(
      `/auth/${provider.urlFragment}/connect`, passport.authenticated(), (req, res, next) => {
        passport.authorize(provider.connect)(req, res, next)
      }
    )
    function getReturnURL (req) {
      let returnURL = '/profile'
      if (req.session.returnURL) {
        returnURL = req.session.returnURL
        req.session.returnURL = null
      }
      return returnURL
    }
    app.get(
      `/auth/${provider.urlFragment}/callback`,
      (req, res, next) => {
        const isConnecting = req.isAuthenticated()
        let middleware
        if (isConnecting) {
          middleware = passport.authorize(provider.connect)
        } else {
          middleware = passport.authenticate(
            provider.create,
            (err, user) => {
              if (err) return next(err)
              if (!user) return res.redirect('/login')

              req.logIn(user, err => { if (err) return next(err) })
              res.redirect(getReturnURL(req))
            }
          )
        }
        middleware(req, res, next)
      },
      (req, res, next) => {
        users.addProviderAccount(req.user, req.account, (err, user) => {
          if (err) return next(err)
          req.logIn(user, err => { if (err) return next(err) })
          res.redirect(getReturnURL(req))
        })
      }
    )
  }

  [
    {
      configName: 'googleAuthConfig',
      src: './providers/google-auth.js'
    },
    {
      configName: 'steamAuthConfig',
      src: './providers/steam-auth.js'
    }
  ].forEach(providerValues => {
    if (!config[providerValues.configName]) return
    promises.push(
      require(providerValues.src).register(passport, users, config).then(provider => {
        authentications[provider.urlFragment] = {
          loginPath: `/auth/${provider.urlFragment}/login`
        }
        registerProvider(provider)
        return Promise.resolve()
      }
    ))
  })

  // Logout
  app.get('/logout', (req, res) => {
    req.logOut()
    res.redirect('/')
  })

  // And finally, catch-all error 500, for future expansion.
  app.use((err, req, res, next) => {
    res.status(500).send(err)
  })

  return Promise.all(promises)
}
