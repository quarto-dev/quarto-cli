import copyObject2 from "../unoptimized/_copyObject.js";
import keysIn2 from "../unoptimized/keysIn.js";
function baseAssignIn(object, source) {
  return object && copyObject2(source, keysIn2(source), object);
}
var __VIRTUAL_FILE = baseAssignIn;
export default __VIRTUAL_FILE;
