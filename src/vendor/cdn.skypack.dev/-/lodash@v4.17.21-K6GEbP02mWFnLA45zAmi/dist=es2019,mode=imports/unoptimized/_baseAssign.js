import copyObject2 from "../unoptimized/_copyObject.js";
import keys2 from "../unoptimized/keys.js";
function baseAssign(object, source) {
  return object && copyObject2(source, keys2(source), object);
}
var __VIRTUAL_FILE = baseAssign;
export default __VIRTUAL_FILE;
