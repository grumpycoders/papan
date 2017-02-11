- Client/Server architecture.
  - Probably using gRPC.
  - Nice to have: webcams headshots.
  - Desktop / web browser / Android / iOS clients.
    - Native "clients" could just be running web view for the actual game.
    - The native client would help connecting to a lobby.
    - Using [SSPD](https://en.wikipedia.org/wiki/Simple_Service_Discovery_Protocol), a Desktop server could advertize its URLs to the clients.

- Notion of Global / Local scenes.
  - Global = the board visible by everyone, including spectators.
  - Local = player's hands and UI.
  - A scene should be a collection of actors.
    - Actors should have basic properties such as unique id, a collection of classes, a collection of remote method names that actor allows and that the client can call, and attributes in key values pairs.
    - There shouldn't be parameters to the calls; game logic should be handled with a series of actors interactions.
    - We would send the delta between two "frames" of a scene every few milliseconds
      - Allows the server to go crazy with updates without flooding the client.
      - Allows for very easy replay management.
      - Allows for restoring the game client state between disconnections, but the client should really, really just be a renderer and input forwarder, nothing else.
    - Potentially allows for custom game clients for specific games.
  - Should have the notion of having a proper overlay for the Local view into the Global.
    - Clients should be able to select which view to display.
    - Some Local views should be "private", some others not. Poker vs Chess.
    - Clients should adapt to the number of layers, depending on the situation.
  - Global board should still be interactive, but only on each player's "turn".
    - Preemptivity of turns to allow interruptions.
    - Clients can be remote input for the Global board
  - Option to have public or private games.
    - Spectator mode

- Server in node.js.
  - May be a REST / Websocket gateway for web clients.
  - Possibility to run it as an electron app for Desktops.
  - Spawns game instances (only one in electron).
    - Needs to be scalable, potentially on more than one machine. Docker for better ressource management ?
    - Lobby server plays the role of the gateway.
    - gRPC uds sockets between the two, if possible ?
    - Heartbeats to check server health.

- Clients
  - Configurable user interface
    - Templates, themes

- Game logic in Javascript.
  - Maybe have an example using emscripten to demonstrate that Javascript isn't necessarily the only programming language available.
    - Maybe create a Lua framework for people who prefer Lua over Javascript ? But not at first.
  - The game logic should be server-side only. The client only renders. We should offer no communication method between the client and the server other than:
    - Actor property updates from server to client.
    - Actor action calls from client to server.

- Game "packages" containing server JS code, client JS code, and assets.
  - Means we can't really trust the packages. Should warn users about that.
  - Packages should only be installed by server admins.
  - Basic common logic distributed as npm packages. Ex: card decks, card shuffling, RNGs, dices, ...
    - Packages should then specify the list of npm dependencies to install.
  - We probably don't want to run a "main" game lobby for everyone, for cost and copyright reasons (if anyone uploads copyrighted material - we don't want to need a DMCA response team).
    - We could provide a default one, but clients should be allowed to store their preferred game servers somehow.
    - The default lobby we'd run should only have basic games (Poker, Game of the Goose, etc...) to get people to play on other servers.

- User accounts.
  - Simply using Google auth for login maybe ? Or have pluggable auth, with a default on Google auth.
  - Favorite servers stored in the Google account ? Or do we keep that in each game clients ?
  - Limited persistent storage per game package ? A bit like Steam Cloud.
  - Achievements.
    - Global achievements: across all servers.
    - Local achievements: customizable on each server.
  - User profile, game history.
  - User stats: win/loss, high scores, etc.
  - Provide user configuration (preferences).
  - Administration interface.
    - Add game packages.
    - Manage users.
    - Configuration.

- Not really different from any typical node.js app. The key to success is probably going to be in the provided libraries.
  - Good and strong framework. Let's make sure our architecture is sane.
  - Strong base libraries for dealing with very common things like cards, decks, hands, dices, tokens, etc...

- Storage
  - Store game data somewhere for replays (Provide option to save a game to replay it later).

- Potential list of games:
  - Poker (with variations)
  - Chess
  - Checkers
  - Game of the Goose
  - Belotte
  - https://boardgamegeek.com/geeklist/33151/creative-commonsopen-source-games
  - https://boardgamegeek.com/geeklist/1061/top-20-public-domain-games-quotinternet-top-100-ga
  - http://mentalfloss.com/article/67181/15-centuries-old-board-games
