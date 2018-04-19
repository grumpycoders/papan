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
    const pendingPromise = handlers[data.action].call(handlerClass, call, data[data.action])
    if (pendingPromise) {
      pendingPromise.catch(err => {
        console.error('Dispatcher error caught:')
        console.error(err)
        let error = {
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
