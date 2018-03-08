'use strict'

const Sequelize = require('sequelize')
const Umzug = require('umzug')
const path = require('path')

class Users {
  constructor (config) {
    this.pgConfig = config
  }

  serialize (user) {
    return Promise.resolve({ id: user.dataValues.id })
  }

  deserialize (user) {
    return this.User.findAll({
      where: {
        id: user.id
      },
      include: [{
        model: this.ProvidedAuth
      }]
    }).then(result => Promise.resolve(result.length === 0 ? false : result[0]))
  }

  findOrCreate (user) {
    const providerId = `${user.provider}#${user.id}`
    return this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length === 1) {
        return this.deserialize({ id: result[0].dataValues.userId })
      } else {
        return this.User.create({
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
        })
      }
    })
  }

  find (user) {
    const providerId = `${user.provider}#${user.id}`
    return this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length === 1) {
        return this.deserialize({ id: result[0].dataValues.userId })
      } else {
        return Promise.resolve(false)
      }
    })
  }

  addProviderAccount (user, account) {
    const providerId = `${account.provider}#${account.id}`
    const userId = user.dataValues.id
    return this.ProvidedAuth.findAll({
      where: {
        id: providerId
      }
    }).then(result => {
      if (result.length !== 0) {
        if (result[0].dataValues.userId === userId) {
          return Promise.resolve(user)
        } else {
          return Promise.reject('Account already connected by someone else')
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
      return this.deserialize({ id: userId })
    })
  }

  addTemporaryCode (user, code) {
    return this.TemporaryCode.create({
      id: code,
      userId: user.dataValues.id
    })
  }

  revokeTemporaryCode (code) {
    return this.TemporaryCode.findAll({
      where: {
        id: code
      }
    }).then(result => Promise.all(result.map(code => code.destroy())))
  }

  findUserByTemporaryCode (code) {
    return this.TemporaryCode.findAll({
      where: {
        id: code
      }
    }).then(result => {
      if (result.length === 0) {
        return Promise.resolve(false)
      } else {
        return this.deserialize({ id: result[0].dataValues.userId })
      }
    })
  }

  initialize () {
    const pg = this.pgConfig
    if (pg.useSocket) {
      this.sequelize = new Sequelize(
        pg.database, pg.user, pg.password, {
          host: pg.host,
          dialect: 'postgres'
        }
      )
    } else {
      this.sequelize = new Sequelize(
        `postgres://${pg.user}:${pg.password}@${pg.host}:${pg.port}/${pg.database}`
      )
    }

    const umzug = new Umzug({
      storage: 'sequelize',
      storageOptions: {
        sequelize: this.sequelize
      },

      migrations: {
        params: [
          this.sequelize
        ],
        path: path.join(__dirname, 'migrations'),
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
    this.User.ProvidedAuths = this.User.hasMany(this.ProvidedAuth)

    this.TemporaryCode = this.sequelize.define('temporaryCodes', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    })
    this.User.TemporaryCodes = this.User.hasMany(this.TemporaryCode)

    return this.sequelize.authenticate().then(() => {
      const p = umzug.up()
      return p.then(() => {
        console.log('Database migration resolved')
        return Promise.resolve()
      })
    })
  }
}

exports.create = config => new Users(config)
