import arrayPush2 from "../unoptimized/_arrayPush.js";
import isArray2 from "../unoptimized/isArray.js";
function baseGetAllKeys(object, keysFunc, symbolsFunc) {
  var result = keysFunc(object);
  return isArray2(object) ? result : arrayPush2(result, symbolsFunc(object));
}
var __VIRTUAL_FILE = baseGetAllKeys;
export default __VIRTUAL_FILE;
