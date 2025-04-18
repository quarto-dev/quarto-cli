import isPrototype2 from "../unoptimized/_isPrototype.js";
import nativeKeys2 from "../unoptimized/_nativeKeys.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function baseKeys(object) {
  if (!isPrototype2(object)) {
    return nativeKeys2(object);
  }
  var result = [];
  for (var key in Object(object)) {
    if (hasOwnProperty.call(object, key) && key != "constructor") {
      result.push(key);
    }
  }
  return result;
}
var __VIRTUAL_FILE = baseKeys;
export default __VIRTUAL_FILE;
