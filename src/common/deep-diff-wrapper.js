((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    const PapanUtils = require('./utils.js')
    register(module.exports, PapanUtils)
  } else {
    that.DeepDiffWrapper = {}
    register(that.DeepDiffWrapper, that.PapanUtils)
  }
})(global, (that, PapanUtils) => {
  'use strict'

  function wrapElement (value) {
    return PapanUtils.JSON.stringify(value)
  }

  function unwrapElement (element) {
    return PapanUtils.JSON.parse(element)
  }

  function wrapOne (delta) {
    const path = delta.path ? {
      items: delta.path.map(item => {
        switch (typeof item) {
          case 'string':
            return { key: item }
          case 'number':
            return { index: item }
        }
      })
    } : undefined
    switch (delta.kind) {
      case 'N': return {
        path,
        new: {
          rhs: wrapElement(delta.rhs)
        }
      }
      case 'D': return {
        path,
        delete: {
          lhs: wrapElement(delta.lhs)
        }
      }
      case 'E': return {
        path,
        edit: {
          lhs: wrapElement(delta.lhs),
          rhs: wrapElement(delta.rhs)
        }
      }
      case 'A': return {
        path,
        array: {
          index: delta.index,
          item: wrapOne(delta.item)
        }
      }
    }
  }

  function unwrapOne (delta) {
    const path = delta.path ? delta.path.items.map(item => {
      switch (item.item) {
        case 'key': return item.key
        case 'index': return item.index
      }
    }) : undefined
    switch (delta.element) {
      case 'new': return {
        kind: 'N',
        path,
        rhs: unwrapElement(delta.new.rhs)
      }
      case 'delete': return {
        kind: 'D',
        path,
        lhs: unwrapElement(delta.delete.lhs)
      }
      case 'edit': return {
        kind: 'E',
        path,
        lhs: unwrapElement(delta.edit.lhs),
        rhs: unwrapElement(delta.edit.rhs)
      }
      case 'array': return {
        kind: 'A',
        path,
        index: delta.array.index,
        item: unwrapOne(delta.array.item)
      }
    }
  }

  that.wrap = deltas => ({ elements: deltas.map(wrapOne) })
  that.unwrap = object => (object.elements.map(unwrapOne))
})
