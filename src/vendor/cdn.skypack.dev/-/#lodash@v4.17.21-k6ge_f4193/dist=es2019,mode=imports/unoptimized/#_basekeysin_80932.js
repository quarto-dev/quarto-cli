import isObject2 from "../unoptimized/isObject.js";
import isPrototype2 from "../unoptimized/_isPrototype.js";
import nativeKeysIn2 from "../unoptimized/_nativeKeysIn.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function baseKeysIn(object) {
  if (!isObject2(object)) {
    return nativeKeysIn2(object);
  }
  var isProto = isPrototype2(object), result = [];
  for (var key in object) {
    if (!(key == "constructor" && (isProto || !hasOwnProperty.call(object, key)))) {
      result.push(key);
    }
  }
  return result;
}
var __VIRTUAL_FILE = baseKeysIn;
export default __VIRTUAL_FILE;
