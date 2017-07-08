const TwitterStrategy = require('passport-twitter').Strategy
const Provider = require('./provider.js').Provider

exports.register = (passport, users, config) => {
  const provider = new Provider('twitter', 'twitter-connect', 'twitter')
  provider.registerStrategies(users, (strategyName, dbCallback) => {
    passport.use(strategyName, new TwitterStrategy(
      {
        callbackURL: config.httpConfig.baseURL.concat('/auth/twitter/callback'),
        consumerKey: config.twitterAuthConfig.consumerKey,
        consumerSecret: config.twitterAuthConfig.consumerSecret
      },
      (token, tokenSecret, profile, done) => {
        const user = {
          provider: 'twitter',
          id: profile.id,
          screenName: profile.displayName,
          avatarURL: profile.photos[0].value
        }
        dbCallback(user).then(user => done(null, user)).catch(err => done(err, false))
      }
    ))
  })

  return Promise.resolve(provider)
}
