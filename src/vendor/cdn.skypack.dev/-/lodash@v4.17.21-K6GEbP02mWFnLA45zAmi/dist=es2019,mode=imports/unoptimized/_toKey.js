import isSymbol2 from "../unoptimized/isSymbol.js";
var INFINITY = 1 / 0;
function toKey(value) {
  if (typeof value == "string" || isSymbol2(value)) {
    return value;
  }
  var result = value + "";
  return result == "0" && 1 / value == -INFINITY ? "-0" : result;
}
var __VIRTUAL_FILE = toKey;
export default __VIRTUAL_FILE;
