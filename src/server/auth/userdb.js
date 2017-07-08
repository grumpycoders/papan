'use strict'

const Sequelize = require('sequelize')
const Umzug = require('umzug')

class Users {
  constructor (config) {
    this.pgConfig = config
  }

  serialize (user, done) {
    done(null, { id: user.dataValues.id })
  }

  deserialize (user, done) {
    this.User.findAll({
      where: {
        id: user.id
      },
      include: [{
        model: this.ProvidedAuth
      }]
    }).then(result => {
      done(null, result.length === 0 ? false : result[0])
    })
  }

  findOrCreate (user, done) {
    const providerId = `${user.provider}#${user.id}`
    this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length === 1) {
        this.deserialize({ id: result[0].dataValues.userId }, done)
      } else {
        this.User.create({
          screenName: user.screenName,
          avatarURL: user.avatarURL,
          providedAuths: [{
            id: providerId,
            screenName: user.screenName,
            avatarURL: user.avatarURL
          }]
        }, {
          include: [
            this.User.ProvidedAuths
          ]
        }).then(user => {
          done(null, user)
        }).catch(err => done(err, false))
      }
    }).catch(err => done(err, false))
  }

  find (user, done) {
    const providerId = `${user.provider}#${user.id}`
    this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length === 1) {
        this.deserialize({ id: result[0].dataValues.userId }, done)
      } else {
        done(null, false)
      }
    }).catch(err => done(err, false))
  }

  addProviderAccount (user, account, done) {
    const providerId = `${account.provider}#${account.id}`
    const userId = user.dataValues.id
    this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length !== 0) {
        if (result[0].dataValues.userId === userId) {
          done(null, user)
        } else {
          done('Account already connected by someone else', false)
        }
      } else {
        return this.ProvidedAuth.create({
          id: providerId,
          screenName: account.screenName,
          avatarURL: account.avatarURL,
          userId: userId
        })
      }
    }).then(() => {
      this.deserialize({ id: userId }, done)
    }).catch(err => done(err, false))
  }

  initialize () {
    const pg = this.pgConfig
    this.sequelize = new Sequelize(
      `postgres://${pg.user}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
    )

    const umzug = new Umzug({
      storage: 'sequelize',
      storageOptions: {
        sequelize: this.sequelize
      },

      migrations: {
        params: [
          this.sequelize
        ],
        path: './src/server/auth/migrations',
        pattern: /\.js$/
      },

      logging: () => {
        console.log.apply(null, arguments)
      }
    })

    this.User = this.sequelize.define('user', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true
      },
      screenName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      avatarURL: {
        type: Sequelize.STRING,
        allowNull: true
      }
    })

    this.ProvidedAuth = this.sequelize.define('providedAuths', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    })
    this.User.ProvidedAuths = this.User.hasMany(this.ProvidedAuth)

    this.TemporaryCode = this.sequelize.define('temporaryCodes', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      },
      screenName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      avatarURL: {
        type: Sequelize.STRING,
        allowNull: true
      }
    })
    this.User.TemporaryCodes = this.User.hasMany(this.TemporaryCode)

    return this.sequelize.authenticate().then(() => umzug.up())
  }
}

exports.create = config => new Users(config)
