import nativeCreate2 from "../unoptimized/_nativeCreate.js";
var HASH_UNDEFINED = "__lodash_hash_undefined__";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function hashGet(key) {
  var data = this.__data__;
  if (nativeCreate2) {
    var result = data[key];
    return result === HASH_UNDEFINED ? void 0 : result;
  }
  return hasOwnProperty.call(data, key) ? data[key] : void 0;
}
var __VIRTUAL_FILE = hashGet;
export default __VIRTUAL_FILE;
