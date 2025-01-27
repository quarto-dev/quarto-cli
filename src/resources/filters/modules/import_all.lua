-- import_all.lua
-- imports all modules into _quarto.modules

_quarto.modules = {
  astshortcode = require("modules/astshortcode"),
  authors = require("modules/authors"),
  brand = require("modules/brand/brand"),
  callouts = require("modules/callouts"),
  classpredicates = require("modules/classpredicates"),
  constants = require("modules/constants"),
  dashboard = require("modules/dashboard"),
  filenames = require("modules/filenames"),
  filters = require("modules/filters"),
  jog = require("modules/jog"),
  license = require("modules/license"),
  lightbox = require("modules/lightbox"),
  mediabag = require("modules/mediabag"),
  openxml = require("modules/openxml"),
  patterns = require("modules/patterns"),
  scope = require("modules/scope"),
  string = require("modules/string"),
  tablecolwidths = require("modules/tablecolwidths"),
  typst = require("modules/typst")
}
