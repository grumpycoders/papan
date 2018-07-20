'use strict'

const grpc = require('grpc')

module.exports = (messageType, handlerClass) => {
  const fields = messageType.fields
  const handlers = {}
  if (messageType.oneofsArray.length !== 1) throw Error('Wrong message type (should be a single oneofs)')
  const oneofName = messageType.oneofsArray[0].name
  Object.keys(fields).forEach(field => {
    const type = 'PapanLobby.' + fields[field].type
    if (typeof handlerClass[type] !== 'function') throw Error('Unimplemented handler for ' + type)
    handlers[field] = handlerClass[type]
  })

  return (call, data) => {
    const messageName = data[oneofName]
    const handler = handlers[messageName]
    if (typeof handler !== 'function') {
      console.error('Malformed message sent')
      const error = {
        code: grpc.status.INVALID_ARGUMENT,
        details: 'Malformed message sent',
        metadata: new grpc.Metadata()
      }
      call.emit('error', error)
      call.end()
      return
    }
    const message = data[messageName]
    const pendingPromise = handler.call(handlerClass, call, message)
    if (pendingPromise) {
      pendingPromise.catch(err => {
        console.error('Dispatcher error caught:')
        console.error(err)
        const error = {
          code: grpc.status.UNKNOWN,
          details: err.message,
          metadata: new grpc.Metadata()
        }
        call.emit('error', error)
        call.end()
      })
    }
  }
}
