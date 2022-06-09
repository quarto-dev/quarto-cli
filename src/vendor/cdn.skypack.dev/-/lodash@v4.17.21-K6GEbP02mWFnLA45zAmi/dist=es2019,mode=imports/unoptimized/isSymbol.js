import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var symbolTag = "[object Symbol]";
function isSymbol(value) {
  return typeof value == "symbol" || isObjectLike2(value) && baseGetTag2(value) == symbolTag;
}
var __VIRTUAL_FILE = isSymbol;
export default __VIRTUAL_FILE;
