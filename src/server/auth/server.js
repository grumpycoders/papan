'use strict'

function root (req, res, config) {
  res.send('Papan Auth')
}

exports.registerServer = (app, config) => {
  return new Promise((resolve, reject) => resolve(app.get('/', (req, res) => root(req, res, config))))
}
