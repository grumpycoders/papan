const SteamStrategy = require('passport-steam').Strategy
const Provider = require('./provider.js').Provider

exports.register = (passport, users, config) => {
  const provider = new Provider('steam', 'steam-connect', 'steam')
  provider.registerStrategies(users, (strategyName, dbCallback) => {
    passport.use(strategyName, new SteamStrategy(
      {
        returnURL: config.httpConfig.baseURL.concat('/auth/steam/callback'),
        realm: config.httpConfig.baseURL.concat('/'),
        apiKey: config.steamAuthConfig.apiKey
      },
      (identifier, profile, done) => {
        const user = {
          provider: 'steam',
          id: profile.id,
          screenName: profile.displayName,
          avatarURL: profile.photos[2].value
        }
        dbCallback(user).then(user => done(null, user)).catch(err => done(err, false))
      }
    ))
  })

  return Promise.resolve(provider)
}
