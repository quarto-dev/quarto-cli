import baseValues2 from "../unoptimized/_baseValues.js";
import keys2 from "../unoptimized/keys.js";
function values(object) {
  return object == null ? [] : baseValues2(object, keys2(object));
}
var __VIRTUAL_FILE = values;
export default __VIRTUAL_FILE;
