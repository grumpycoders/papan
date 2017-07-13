The Auth server (on https://auth.papan.online) is the only piece that isn't going to work in a distributed fashion. The point is still to make it optional in the process. One shouldn't have to authenticate to use Papan. But a lobby server might request that its users are authenticated. A lobby server that isn't requiering its users to be authenticated wouldn't need the auth server at all. It'd simply accept usernames blindly. That single server, with its SSL certificate, is to be trusted by the clients using it.

We still distribute the code for the auth server, if anyone wants to create an alternative authoritative source for the authentication on their own separate network.

Starting the auth server can be done in two ways. Either by running the main application using --auth_server, or by using the project as a library and invoking the auth server from another application.

In all cases, the auth server requires postgresql with a writable database.

If you want to run the auth server through the main application, you need to provide a config directory with the following files in there at a minimum:

```
config/pg-config.json
config/http-config.json
```

Their format should be:

pg-config:
```
{
  "user": "username",
  "database": "database name",
  "password": "password",
  "host": "postgres hostname",
  "port": 5432,
  "max": 10,
  "idleTimeoutMillis": 30000
}
```

http-config:
```
{
  "secret": "foobar", // apg -m 64
  "baseURL": "http://localhost:8081",
  "port": 8081
}
```

Then you need one configuration file per built-in provider you want to enable. Here's the full list:

facebook-auth-config:
```
{
  "clientID": "your app ID",
  "clientSecret": "your app secret"
  // callback will be /auth/facebook/callback
}
```

google-auth-config:
```
{
  "client_id": "your crediential's id",
  "client_secret": "your credential secret"
  // callback will be /auth/google/callback
}
```

steam-auth-config:
```
{
  "apiKey": "your steam's API key"
}
```

twitter-auth-config:
```
{
  "consumerKey": "OvEmDBWtgukQ4woYyNoS6HhBV",
  "consumerSecret": "XNpGunbsEYJIo1jFVLyPebZ4ZmlQLu1JJWLqP4Ybf6o7jaOfsF"
  // callback will be /auth/twitter/callback
}
```

You can also specify more auth providers using passportjs' strategies. Follow the pattern from `builtInAuthProviders` in `src/server/auth/server.js` to implement more.

If you want to use the auth server as a library in your own app, follow the code in `main.js` to see how you can do that.
