if (typeof(process.versions.electron) !== "undefined") {
  const main_electron = require('./main-electron.js')
  main_electron.main()
} else {
  const main_node = require('./main-node.js')
  main_node.main()
}
