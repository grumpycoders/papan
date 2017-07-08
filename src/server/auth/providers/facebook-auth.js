const FacebookStrategy = require('passport-facebook').Strategy
const Provider = require('./provider.js').Provider

exports.register = (passport, users, config) => {
  const provider = new Provider('facebook', 'facebook-connect', 'facebook')
  provider.registerStrategies(users, (strategyName, dbCallback) => {
    passport.use(strategyName, new FacebookStrategy(
      {
        callbackURL: config.httpConfig.baseURL.concat('/auth/facebook/callback'),
        clientID: config.facebookAuthConfig.clientID,
        clientSecret: config.facebookAuthConfig.clientSecret
      },
      (accessToken, refreshToken, profile, done) => {
        const user = {
          provider: 'facebook',
          id: profile.id,
          screenName: profile.displayName
        }
        dbCallback(user).then(user => done(null, user)).catch(err => done(err, false))
      }
    ))
  })

  return Promise.resolve(provider)
}
