'use strict'


      function isElectron() {
        let p = typeof(process) !== "undefined" && process
        return !!p && !!p.versions && !!p.versions.electron
      }
