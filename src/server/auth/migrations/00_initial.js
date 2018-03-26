'use strict'

const path = require('path')

const root = path.normalize(path.join(__dirname, '..', '..', '..', '..'))

const readFile = path => new Promise((resolve, reject) =>
  require('fs').readFile(path, 'ascii',
    (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(data)
      }
    }
  )
)

exports = {
  up: function (sequelize) {
    const Sequelize = sequelize.constructor

    const User = sequelize.define('user', {
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

    const ProvidedAuth = sequelize.define('providedAuths', {
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
    User.ProvidedAuths = User.hasMany(ProvidedAuth)

    const TemporaryCode = sequelize.define('temporaryCodes', {
      id: {
        type: Sequelize.STRING,
        primaryKey: true
      }
    })
    User.TemporaryCodes = User.hasMany(TemporaryCode)

    return Promise.all([
      readFile(path.join(root, 'node_modules', 'connect-pg-simple', 'table.sql'))
        .then(sessionsQuery => sequelize.query(sessionsQuery)),
      sequelize.sync()
    ])
  },

  down: function (sequelize) {
    const query = sequelize.getQueryInterface()
    return Promise.all([
      query.dropTable('sessions'),
      // Note: because of the foreign key, these need to be dropped in that order.
      Promise.all([
        query.dropTable('temporaryCode'),
        query.dropTable('providedAuth')
      ]).then(() => query.dropTable('users'))
    ])
  }
}
