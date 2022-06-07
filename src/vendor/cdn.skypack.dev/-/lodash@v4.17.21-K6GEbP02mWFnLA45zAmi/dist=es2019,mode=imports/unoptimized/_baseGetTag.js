import Symbol2 from "../unoptimized/_Symbol.js";
import getRawTag2 from "../unoptimized/_getRawTag.js";
import objectToString2 from "../unoptimized/_objectToString.js";
var nullTag = "[object Null]", undefinedTag = "[object Undefined]";
var symToStringTag = Symbol2 ? Symbol2.toStringTag : void 0;
function baseGetTag(value) {
  if (value == null) {
    return value === void 0 ? undefinedTag : nullTag;
  }
  return symToStringTag && symToStringTag in Object(value) ? getRawTag2(value) : objectToString2(value);
}
var __VIRTUAL_FILE = baseGetTag;
export default __VIRTUAL_FILE;
