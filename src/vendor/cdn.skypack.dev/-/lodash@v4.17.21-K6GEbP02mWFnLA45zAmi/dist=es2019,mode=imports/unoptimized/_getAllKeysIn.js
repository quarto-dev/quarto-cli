import baseGetAllKeys2 from "../unoptimized/_baseGetAllKeys.js";
import getSymbolsIn2 from "../unoptimized/_getSymbolsIn.js";
import keysIn2 from "../unoptimized/keysIn.js";
function getAllKeysIn(object) {
  return baseGetAllKeys2(object, keysIn2, getSymbolsIn2);
}
var __VIRTUAL_FILE = getAllKeysIn;
export default __VIRTUAL_FILE;
