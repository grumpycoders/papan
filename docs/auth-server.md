The Auth server (on https://auth.papan.online) is the only piece that isn't going to work in a distributed fashion. The point is still to make it optional in the process. One shouldn't have to authenticate to use Papan. But a lobby server might request that its users are authenticated. A lobby server that isn't requiering its users to be authenticated wouldn't need the auth server at all. It'd simply accept usernames blindly. That single server, with its SSL certificate, is to be trusted by the clients using it.

We would still distribute the code for the auth server, if anyone wants to create an alternative authoritative source for the authentication on their own separate network.

The idea is to have a registry of registered users. We would use a strong relational database (such as postgres on top of sequelize and a strong migration story with umzug) to insure its integrity. This would be in contrast with the database used by the lobby and game servers (something noSQL ala MongoDB or NeDB), which would only be used to store serialized game status and replays.

We would begin with two big types of users. Actual registrations on the website, where we would be responsible for keeping the users' passwords, and the Google sign in mechanism. Both mechanisms aren't mutually exclusive.

Both would still get unique usernames across the system. Users probably shouldn't be allowed to change their usernames once created. We might ask for their e-mail address to be able to reset their passwords. The Google sign in would give us the additional benefit of storing things into their account - basically using their Google Drive - for things like replays or so. A user might be able to upgrade their account later to a Google sign in account.

The Papan registration screen would request a username, an e-mail, a password, and a captcha, probably provided by reCAPTCHA. The login process would require the username or e-mail, and the password.

The Google sign in would both be the account creation and the login process. If the Google account has been seen in the past, keyed on the e-mail address, then this a simple log in; if the account didn't previously had a google auth jwt token associated with it, then it's an upgrade. If it hasn't been seen before, then it's a new account. Finalizing the Google account creation basically means asking the user for a username. Only after a successful unique username entry would we be able to call the google sign in account creation process done.

Being signed in means simply having a session cookie. The auth server would keep several session cookies up for each signed in device or application. We would then need to support an oauth-like mechanism. When a lobby server wants to authenticate a user, he'd need to redirect that user to the auth website, having the user handing over a token, that the lobby can then later exchange for the user information to the auth server.

Most (only the auth callbacks (papan and Google) would be the exceptions, which would only trigger redirects with some cookies being sent) of the Auth server actions would be AJAX-based, so that they can work as iron-ajax forms from the web page, or work from inside the Desktop client.

The database schema for the users table would be something along these lines:

- username: string - PK
- email: string - nullable - UNIQUE INDEX
- auth: string - nullable - an /etc/shadow-style hash in the form $method$salt$digest
- googleauth: string - nullable - The jwt token for that user

We could add more information later on, such as the URL to the user's avatar.

The database schema for the sessions table would be:
- session: string - PK
- username: string - not null

We could also add more information to that table later on to store more useful facts about that session, such as the IP address, user agent, etc.

The auth website would also be responsible for making changes to the user account, such as changing the e-mail address or password.
