'use strict'

exports.processRequest = (req, res, config) => {
  res.writeHead(403)
  res.end('Unauthorized')
}
