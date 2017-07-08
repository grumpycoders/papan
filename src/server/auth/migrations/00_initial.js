'use strict'

module.exports = {
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
      }
    })
    User.ProvidedAuths = User.hasMany(ProvidedAuth)

    const TemporaryCode = sequelize.define('temporaryCodes', {
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
    User.TemporaryCodes = User.hasMany(TemporaryCode)

    return sequelize.sync()
  },

  down: function (sequelize) {
    // Note: because of the foreign key, these need to be dropped in that order.
    const query = sequelize.getQueryInterface()
    return Promise.all([query.dropTable('temporaryCode'), query.dropTable('providedAuth')]).then(() => query.dropTable('users'))
  }
}
