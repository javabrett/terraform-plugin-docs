package serve

import _ "embed"

//go:embed serve.js
var serveJs string

//go:embed menu.html.tmpl
var menuTemplate string

//go:embed header.html.tmpl
var headerTemplate string
