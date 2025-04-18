import isFunction2 from "../unoptimized/isFunction.js";
import isLength2 from "../unoptimized/isLength.js";
function isArrayLike(value) {
  return value != null && isLength2(value.length) && !isFunction2(value);
}
var __VIRTUAL_FILE = isArrayLike;
export default __VIRTUAL_FILE;
