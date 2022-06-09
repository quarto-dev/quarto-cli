import arrayLikeKeys2 from "../unoptimized/_arrayLikeKeys.js";
import baseKeys2 from "../unoptimized/_baseKeys.js";
import isArrayLike2 from "../unoptimized/isArrayLike.js";
function keys(object) {
  return isArrayLike2(object) ? arrayLikeKeys2(object) : baseKeys2(object);
}
var __VIRTUAL_FILE = keys;
export default __VIRTUAL_FILE;
