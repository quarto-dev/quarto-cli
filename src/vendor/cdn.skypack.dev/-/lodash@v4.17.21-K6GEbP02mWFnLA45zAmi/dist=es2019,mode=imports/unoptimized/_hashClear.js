import nativeCreate2 from "../unoptimized/_nativeCreate.js";
function hashClear() {
  this.__data__ = nativeCreate2 ? nativeCreate2(null) : {};
  this.size = 0;
}
var __VIRTUAL_FILE = hashClear;
export default __VIRTUAL_FILE;
