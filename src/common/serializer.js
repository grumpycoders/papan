((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    register(module.exports)
  } else {
    that.PapanProto = {}
    register(that.PapanProto)
  }
})(this, that => {
  'use strict'

  class Serializer {
    constructor (proto) {
      this.proto = proto
    }

    deserialize (event, data) {
      const MessageType = this.proto.lookupType(event)
      if (!MessageType) throw Error('Message type ' + event + ' not found')
      const message = MessageType.decode(data)
      if (!message) throw Error('Unable to decode message ' + event)
      const obj = MessageType.toObject(message, {
        enums: String,
        defaults: true,
        oneofs: true
      })
      return obj
    }

    serialize (event, message) {
      const MessageType = this.proto.lookupType(event)
      if (!MessageType) throw Error('Message type ' + event + ' not found')
      const obj = MessageType.fromObject(message)
      if (!obj) throw Error('Unable to create message ' + event)
      return MessageType.encode(obj).finish()
    }
  }

  that.createSerializer = proto => new Serializer(proto)
})
