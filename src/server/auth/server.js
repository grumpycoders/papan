'use strict'

const path = require('path')
const env = require('process').env
const express = require('express')
const bodyParser = require('body-parser')
const winston = require('winston')
const expressWinston = require('express-winston')
const session = require('express-session')
const pg = require('pg')
const PGSession = require('connect-pg-simple')(session)
const assert = require('assert')

const passport = require('passport')

const userDB = require('./userdb.js')

const root = path.normalize(path.join(__dirname, '..', '..', '..'))

const builtInAuthProviders =
  [
    {
      configName: 'googleAuthConfig',
      src: './providers/google-auth.js'
    },
    {
      configName: 'facebookAuthConfig',
      src: './providers/facebook-auth.js'
    },
    {
      configName: 'twitterAuthConfig',
      src: './providers/twitter-auth.js'
    },
    {
      configName: 'steamAuthConfig',
      src: './providers/steam-auth.js'
    }
  ]

exports.registerServer = (app, config) => {
  let authentications = []
  let users
  let registerProvider

  if (!config) config = {}
  if (!config.pgConfig) config.pgConfig = {}
  config.pgConfig.user = config.pgConfig.user || env.PGUSER
  config.pgConfig.password = config.pgConfig.password || env.PGPASSWORD
  config.pgConfig.host = config.pgConfig.host || env.PGHOST
  config.pgConfig.port = config.pgConfig.port || env.PGPORT
  config.pgConfig.database = config.pgConfig.database || env.PGDATABASE

  return Promise.resolve(userDB.create(config.pgConfig)).then(createdUsers => {
    // We need to create and migrate the database first thing before going on with the rest of the work.
    users = createdUsers
    return users.initialize()
  }).then(() => new Promise((resolve, reject) => {
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

    // we'll do ajax
    app.use(bodyParser.json())

    // passport
    app.use(passport.initialize())
    app.use(passport.session())

    passport.serializeUser((user, done) => users.serialize(user).then(id => done(null, id)).catch(err => done(err, false)))
    passport.deserializeUser((id, done) => users.deserialize(id).then(user => done(null, user)).catch(err => done(err, false)))
    passport.authenticated = returnURL => {
      return (req, res, next) => {
        if (req.isAuthenticated()) return next()
        req.session.returnURL = returnURL || req.returnURL
        res.redirect('/render/login')
      }
    }

    // Static files
    function sendRoot (res) {
      res.sendFile(path.join(root, 'auth-index.html'))
    }
    app.use('/src/common', express.static(path.join(root, 'src', 'common')))
    app.use('/src/client/auth', express.static(path.join(root, 'src', 'client', 'auth')))
    app.use('/bower_components', express.static(path.join(root, 'bower_components')))
    app.use('/docs', express.static(path.join(root, 'docs')))
    app.use('/node_modules', express.static(path.join(root, 'node_modules')))
    app.use('/template', express.static(path.join(root, 'template')))
    app.get('/', (req, res) => res.redirect('/render/main'))
    app.get('/render/main', (req, res) => sendRoot(res))
    app.get('/render/login', (req, res) => sendRoot(res))
    app.get('/render/profile', (req, res) => sendRoot(res))

    // AJAX
    app.get('/profile/data', (req, res) => res.json(
      req.isAuthenticated() ? req.user.dataValues : {}
    ))
    app.get('/auth/available', (req, res) => res.json({ providers: authentications }))
    app.get('/info', (req, res) => res.json({
      authenticated: req.isAuthenticated()
    }))

    // Auth providers logic
    registerProvider = (provider) => {
      app.get(
        `/auth/${provider.urlFragment}/login`, (req, res, next) => {
          if (req.isAuthenticated()) res.redirect('/render/profile')
          passport.authenticate(provider.create)(req, res, next)
        }
      )
      app.get(
        `/auth/${provider.urlFragment}/connect`, passport.authenticated(), (req, res, next) => {
          passport.authorize(provider.connect)(req, res, next)
        }
      )
      function getReturnURL (req) {
        let returnURL = '/render/profile'
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
            middleware = passport.authorize(
              provider.connect,
              (err, account) => {
                if (err) return next(err)
                users.addProviderAccount(req.user, account).then(user => {
                  req.logIn(user, err => {
                    if (err) return next(err)
                    res.redirect(getReturnURL(req))
                  })
                }).catch(err => next(err))
              }
            )
          } else {
            middleware = passport.authenticate(
              provider.create,
              (err, user) => {
                if (err) return next(err)
                if (!user) return res.redirect('/render/login')

                req.logIn(user, err => {
                  if (err) return next(err)
                  res.redirect(getReturnURL(req))
                })
              }
            )
          }
          middleware(req, res, next)
        }
      )
    }

    // Logout
    app.get('/logout', (req, res) => {
      req.logOut()
      res.redirect('/')
    })

    // And finally, catch-all error 500, for future expansion.
    app.use((err, req, res, next) => {
      res.status(500).send(err)
    })

    resolve()
  })).then(() => {
    // Contruction of all the promises we're going to wait for to start the server.
    const promises = []
    try {
      const authProviders = builtInAuthProviders.concat(config.externalAuthProviders || [])
      authProviders.forEach(providerValues => {
        if (!config[providerValues.configName]) return
        const registerPromise = require(providerValues.src).register(passport, users, config)
        promises.push(
          registerPromise.then(provider => {
            assert(provider.urlFragment.indexOf('#') === -1)
            authentications.push({
              provider: provider.urlFragment,
              loginPath: `/auth/${provider.urlFragment}/login`,
              connectPath: `/auth/${provider.urlFragment}/connect`
            })
            registerProvider(provider)
            return Promise.resolve()
          }
        ))
      })
    } catch (err) {
      promises.push(Promise.reject(err))
    }
    return Promise.all(promises)
  })
}
