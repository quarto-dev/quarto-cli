import Symbol2 from "../unoptimized/_Symbol.js";
import arrayMap2 from "../unoptimized/_arrayMap.js";
import isArray2 from "../unoptimized/isArray.js";
import isSymbol2 from "../unoptimized/isSymbol.js";
var INFINITY = 1 / 0;
var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolToString = symbolProto ? symbolProto.toString : void 0;
function baseToString(value) {
  if (typeof value == "string") {
    return value;
  }
  if (isArray2(value)) {
    return arrayMap2(value, baseToString) + "";
  }
  if (isSymbol2(value)) {
    return symbolToString ? symbolToString.call(value) : "";
  }
  var result = value + "";
  return result == "0" && 1 / value == -INFINITY ? "-0" : result;
}
var __VIRTUAL_FILE = baseToString;
export default __VIRTUAL_FILE;
