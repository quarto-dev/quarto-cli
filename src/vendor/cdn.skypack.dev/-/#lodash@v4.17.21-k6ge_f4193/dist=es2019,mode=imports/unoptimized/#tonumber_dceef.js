import baseTrim2 from "../unoptimized/_baseTrim.js";
import isObject2 from "../unoptimized/isObject.js";
import isSymbol2 from "../unoptimized/isSymbol.js";
var NAN = 0 / 0;
var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;
var reIsBinary = /^0b[01]+$/i;
var reIsOctal = /^0o[0-7]+$/i;
var freeParseInt = parseInt;
function toNumber(value) {
  if (typeof value == "number") {
    return value;
  }
  if (isSymbol2(value)) {
    return NAN;
  }
  if (isObject2(value)) {
    var other = typeof value.valueOf == "function" ? value.valueOf() : value;
    value = isObject2(other) ? other + "" : other;
  }
  if (typeof value != "string") {
    return value === 0 ? value : +value;
  }
  value = baseTrim2(value);
  var isBinary = reIsBinary.test(value);
  return isBinary || reIsOctal.test(value) ? freeParseInt(value.slice(2), isBinary ? 2 : 8) : reIsBadHex.test(value) ? NAN : +value;
}
var __VIRTUAL_FILE = toNumber;
export default __VIRTUAL_FILE;
