((that, register) => {
  'use strict'

  if (typeof (exports) === 'object') {
    register(module.exports)
  } else {
    that.PapanUtils = {}
    register(that.PapanUtils)
  }
})(this, (that) => {
  'use strict'

  that.isElectron = () => {
    let p = typeof (process) !== 'undefined' && process
    return !!p && !!p.versions && !!p.versions.electron
  }
})
