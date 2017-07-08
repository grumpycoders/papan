'use strict'

function createUsers (query, DataTypes) {
  return query.createTable('users', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true
    },
    screenName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    avatarURL: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  })
}

function createProvidedAuths (query, DataTypes) {
  return query.createTable('providedAuths', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    userId: {
      type: DataTypes.BIGINT,
      references: {
        model: 'users',
        key: 'id'
      },
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  })
}

function createTemporaryCodes (query, DataTypes) {
  return query.createTable('temporaryCode', {
    id: {
      type: DataTypes.STRING,
      primaryKey: true
    },
    userId: {
      type: DataTypes.BIGINT,
      references: {
        model: 'users',
        key: 'id'
      },
      allowNull: false
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    }
  })
}

module.exports = {
  up: function (query, DataTypes) {
    // Note: because of the foreign key, these need to be chained like this.
    return createUsers(query, DataTypes).then(() => Promise.all([createProvidedAuths(query, DataTypes), createTemporaryCodes(query, DataTypes)]))
  },

  down: function (query, DataTypes) {
    // Note: because of the foreign key, these need to be dropped in that order.
    return Promise.all([query.dropTable('temporaryCode'), query.dropTable('providedAuth')]).then(() => query.dropTable('users'))
  }
}
