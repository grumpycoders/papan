The Auth server (on https://auth.papan.online) is the only piece that isn't distributable. The point is still to make it optional in the process. One shouldn't have to authenticate to use Papan. But a lobby server might request that its users are authenticated. A lobby server that isn't requiering its users to be authenticated wouldn't need the auth server at all. It'd simply accept usernames blindly. That single server, with its SSL certificate, is to be trusted by the clients using it.

We would still distribute the code for the auth server, if anyone wants to create an alternative authoritative source for the authentication on their own separate network.

The idea is to have a registry of registered users. We would use a strong relational database (such as postgres on top of sequelize and a strong migration story with umzug) to insure its integrity. This would be in contrast with the database used by the lobby and game servers (something noSQL ala MongoDB or NeDB).

We would begin with two big types of users. Actual registrations on the website, where we would be responsible for keeping the users' passwords, and the Google sign in mechanism.

Both would still get unique usernames across the system. Users aren't allowed to change their usernames once created. We might ask for their e-mail address to be able to reset their passwords. The Google sign in would give us the additional benefit of storing things into their account - basically using their Google Drive - for things like replays or so. A user might be able to upgrade their account later to a Google sign in account.

The Papan registration screen would request a username, an e-mail, and a password. Account creation would be done through an AJAX request, so that either the website or the static app could submit an account creation request.

The Google sign in would both be the account creation, and the login process. If the Google account has been seen in the past, this is a simple log in. If it has been seen before, then it's a normal login.

Finalizing the Google account creation basically means asking the user for a username.

In all cases, creating an account means generating one secure private token. The username, and the public tokens would be sent to the clients for local storage, as cookies (for a normal web browser) or as local configuration (for the desktop app). These two pieces of information are enough to keep a user logged in into the auth server. The point of staying logged in to the auth server would only be to be able to do changes to the account, such as changing the e-mail address, or deleting the account. "Logging in" basically means receiving that secret token.

When a lobby server wants to authenticate a user, the lobby server sends a proof request to the user, which is basically a cryptographically-secure nonce. The user replies with its username, and a HMAC::256 of the nonce using its private token. As a final step, the lobby server sends a request to the auth server to verify the user. Since only the auth server knows about the secret token, it can achieve the verification, and return a single boolean.

Most (only the Google auth callback would be the exception) of the Auth server actions would be AJAX-based, so that they can work as iron-ajax forms from the web page, or work from inside the Desktop client.

The database schema would be something along these lines:

username: string - PK
email: string - not null
auth: string - not null - piece of json (or serialized proto... ?) from
```
enum PapanPasswordMethod {
  // Mapping the methods to the same as /etc/shadow (or the crypt() function basically)
  ...
}
message PapanPassword {
  PapanPasswordMethod method = 1;
  string salt = 2;
  string digest = 3;
}
message GoogleAuth {
  string jwt_token = 1;
}
message PapanAuth {
  oneof auth {
    PapanPassword password = 1;
    GoogleAuth google_auth = 2;
  }
}
```
secret: string - not null
