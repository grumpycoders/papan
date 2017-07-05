'use strict'

const https = require('https')
const queryString = require('querystring')

// Generating the URL for the Google auth.
// This is a promise in case we need to generate a random token later on.
exports.start = (redirectURI, clientID) => {
  return new Promise((resolve, reject) => {
    const authURL = [
      'https://',
      'accounts.google.com',
      '/o/oauth2/v2/auth?',
      queryString.stringify({
        'client_id': clientID,
        'redirect_uri': redirectURI,
        'response_type': 'code',
        'scope': 'profile email openid'
      })].join('')
    resolve(authURL)
  })
}

// THis is the callback from the Google auth. The answer will still
// need to be decoded and verified by a JWT verifier.
exports.finish = (redirectURI, clientID, clientSecret, code, err) => {
  return new Promise((resolve, reject) => {
    const args = {
      'code': code,
      'client_id': clientID,
      'client_secret': clientSecret,
      'redirect_uri': redirectURI,
      'grant_type': 'authorization_code'
    }
    const postData = queryString.stringify(args)
    const options = {
      host: 'www.googleapis.com',
      path: '/oauth2/v4/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    let tokenData = ''
    const req = https.request(options, (response) => {
      response.on('data', (chunk) => { tokenData += chunk })
      response.on('end', () => resolve(JSON.parse(tokenData)))
      response.on('error', (err) => reject(err))
    })
    req.write(postData)
    req.end()
  })
}
