'use strict'

const grpc = require('grpc')

module.exports = (fields, handlerClass) => {
  const handlers = {}
  Object.keys(fields).forEach(field => {
    const type = 'PapanLobby.' + fields[field].type
    if (typeof handlerClass[type] !== 'function') throw Error('Unimplemented handler for ' + type)
    handlers[field] = handlerClass[type]
  })

  return (call, data) => {
    const handler = handlers[data.action]
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
    const pendingPromise = handler.call(handlerClass, call, data[data.action])
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
