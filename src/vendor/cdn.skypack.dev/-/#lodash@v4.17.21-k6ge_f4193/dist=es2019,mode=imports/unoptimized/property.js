import baseProperty2 from "../unoptimized/_baseProperty.js";
import basePropertyDeep2 from "../unoptimized/_basePropertyDeep.js";
import isKey2 from "../unoptimized/_isKey.js";
import toKey2 from "../unoptimized/_toKey.js";
function property(path) {
  return isKey2(path) ? baseProperty2(toKey2(path)) : basePropertyDeep2(path);
}
var __VIRTUAL_FILE = property;
export default __VIRTUAL_FILE;
