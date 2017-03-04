'use strict'

exports.main = () => {
  const path = require('path')
  const express = require('express')
  const port = 8080

  const app = express()

  app.use(express.static(path.join(__dirname, '../..')))

  app.listen(port)
}
