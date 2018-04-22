'use strict'

const fs = require('fs')
const diff = require('diff')

const patch = `
--- a/lib/utils/resolve-url.html
+++ b/lib/utils/resolve-url.html
@@ -16,6 +16,7 @@
 
     let CSS_URL_RX = /(url\\()([^)]*)(\\))/g;
     let ABS_URL = /(^\\/)|(^#)|(^[\\w-\\d]*:)/;
+    let DATA_URI = /data:/;
     let workingURL;
     let resolveDoc;
     /**
@@ -31,6 +32,9 @@
      * @return {string} resolved URL
      */
     function resolveUrl(url, baseURI) {
+      if (baseURI && DATA_URI.test(baseURI)) {
+        return url;
+      }
       if (url && ABS_URL.test(url)) {
         return url;
       }
`
const filepath = 'bower_components/polymer/lib/utils/resolve-url.html'
const input = fs.readFileSync(filepath).toString()
const output = diff.applyPatch(input, patch)
if (output) fs.writeFileSync(filepath, output)
