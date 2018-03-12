'use strict'

const fs = require('fs')
const caCert = fs.readFileSync('certs/localhost-ca.crt')

module.exports.test = () => {
  const grpc = require('grpc')
  const lobbyProto = grpc.load({ file: 'lobby.proto', root: 'protos' })
  const sslCreds = grpc.credentials.createSsl(caCert)
  const callCreds = grpc.credentials.createFromMetadataGenerator((args, callback) => {
    var metadata = new grpc.Metadata()
    metadata.add('xxxx', 'yyyy')
    callback(null, metadata)
  })
  const creds = grpc.credentials.combineChannelCredentials(sslCreds, callCreds)

  let client = new lobbyProto.PapanLobby.PlayerLobbyService('localhost:5051', creds)
  let call = client.Subscribe()
  let msg = {
    create_lobby: {
      lobby_name: 'test'
    }
  }

  call.write(msg)
  call.end()
}
