import arrayLikeKeys2 from "../unoptimized/_arrayLikeKeys.js";
import baseKeysIn2 from "../unoptimized/_baseKeysIn.js";
import isArrayLike2 from "../unoptimized/isArrayLike.js";
function keysIn(object) {
  return isArrayLike2(object) ? arrayLikeKeys2(object, true) : baseKeysIn2(object);
}
var __VIRTUAL_FILE = keysIn;
export default __VIRTUAL_FILE;
