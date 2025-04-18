import nativeCreate2 from "../unoptimized/_nativeCreate.js";
var HASH_UNDEFINED = "__lodash_hash_undefined__";
function hashSet(key, value) {
  var data = this.__data__;
  this.size += this.has(key) ? 0 : 1;
  data[key] = nativeCreate2 && value === void 0 ? HASH_UNDEFINED : value;
  return this;
}
var __VIRTUAL_FILE = hashSet;
export default __VIRTUAL_FILE;
