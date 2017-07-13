const openidClient = require('openid-client')
const Provider = require('./provider.js').Provider

exports.register = (passport, users, config) => {
  openidClient.Issuer.defaultHttpOptions = { timeout: 10000 }
  return openidClient.Issuer.discover('https://accounts.google.com').then(googleIssuer => {
    const client = new googleIssuer.Client(config.googleAuthConfig)
    client.CLOCK_TOLERANCE = 20

    const provider = new Provider('oidc-google', 'oidc-google-connect', 'google')
    provider.registerStrategies(users, (strategyName, dbCallback) => {
      passport.use(strategyName, new openidClient.Strategy({
        client: client,
        params: {
          redirect_uri: config.httpConfig.baseURL.concat('/auth/google/callback'),
          scope: 'openid profile'
        }
      },
      (tokenset, userinfo, done) => {
        const user = {
          provider: 'google',
          id: userinfo.sub,
          avatarURL: userinfo.picture,
          screenName: userinfo.name
        }
        dbCallback(user).then(user => done(null, user)).catch(err => done(err, false))
      }))
    })

    return Promise.resolve(provider)
  })
}
