import baseGetAllKeys2 from "../unoptimized/_baseGetAllKeys.js";
import getSymbols2 from "../unoptimized/_getSymbols.js";
import keys2 from "../unoptimized/keys.js";
function getAllKeys(object) {
  return baseGetAllKeys2(object, keys2, getSymbols2);
}
var __VIRTUAL_FILE = getAllKeys;
export default __VIRTUAL_FILE;
