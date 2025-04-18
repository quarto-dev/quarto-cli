import nativeCreate2 from "../unoptimized/_nativeCreate.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function hashHas(key) {
  var data = this.__data__;
  return nativeCreate2 ? data[key] !== void 0 : hasOwnProperty.call(data, key);
}
var __VIRTUAL_FILE = hashHas;
export default __VIRTUAL_FILE;
