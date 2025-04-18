import baseFor2 from "../unoptimized/_baseFor.js";
import keys2 from "../unoptimized/keys.js";
function baseForOwn(object, iteratee) {
  return object && baseFor2(object, iteratee, keys2);
}
var __VIRTUAL_FILE = baseForOwn;
export default __VIRTUAL_FILE;
