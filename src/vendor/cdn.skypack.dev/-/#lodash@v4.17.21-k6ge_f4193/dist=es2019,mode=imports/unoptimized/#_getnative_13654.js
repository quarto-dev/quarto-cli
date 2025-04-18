import baseIsNative2 from "../unoptimized/_baseIsNative.js";
import getValue2 from "../unoptimized/_getValue.js";
function getNative(object, key) {
  var value = getValue2(object, key);
  return baseIsNative2(value) ? value : void 0;
}
var __VIRTUAL_FILE = getNative;
export default __VIRTUAL_FILE;
