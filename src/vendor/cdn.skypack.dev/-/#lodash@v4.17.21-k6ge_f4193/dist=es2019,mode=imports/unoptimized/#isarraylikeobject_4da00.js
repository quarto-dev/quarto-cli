import isArrayLike2 from "../unoptimized/isArrayLike.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
function isArrayLikeObject(value) {
  return isObjectLike2(value) && isArrayLike2(value);
}
var __VIRTUAL_FILE = isArrayLikeObject;
export default __VIRTUAL_FILE;
