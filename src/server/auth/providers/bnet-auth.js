const BNetStrategy = require('passport-bnet').Strategy
const Provider = require('./provider.js').Provider

exports.register = (passport, users, config) => {
  return new Promise((resolve, reject) => {
    const provider = new Provider('bnet', 'bnet-connect', 'bnet')
    provider.registerStrategies(users, (strategyName, dbCallback) => {
      passport.use(strategyName, new BNetStrategy(
        {
          callbackURL: config.httpConfig.baseURL.concat('/auth/bnet/callback'),
          region: config.bnetAuthConfig.region || 'us',
          clientID: config.bnetAuthConfig.clientID,
          clientSecret: config.bnetAuthConfig.clientSecret,
          apiKey: config.steamAuthConfig.apiKey
        },
        (accessToken, refreshToken, profile, done) => {
          const user = {
            provider: 'bnet',
            id: profile.id,
            screenName: profile.battletag
          }
          dbCallback(user).then(user => done(null, user)).catch(err => done(err, false))
        }
      ))
    })

    resolve(provider)
  })
}
