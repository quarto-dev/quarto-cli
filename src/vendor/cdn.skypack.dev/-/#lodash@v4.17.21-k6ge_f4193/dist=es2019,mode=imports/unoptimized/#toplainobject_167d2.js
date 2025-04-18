import copyObject2 from "../unoptimized/_copyObject.js";
import keysIn2 from "../unoptimized/keysIn.js";
function toPlainObject(value) {
  return copyObject2(value, keysIn2(value));
}
var __VIRTUAL_FILE = toPlainObject;
export default __VIRTUAL_FILE;
