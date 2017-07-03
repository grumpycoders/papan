'use strict'

function root (req, res, config) {
  res.send('Papan Auth')
}

exports.registerServer = (app, config) => {
  app.get('/', (req, res) => root(req, res, config))
}
