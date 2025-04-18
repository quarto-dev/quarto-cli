import eq2 from "../unoptimized/eq.js";
import isArrayLike2 from "../unoptimized/isArrayLike.js";
import isIndex2 from "../unoptimized/_isIndex.js";
import isObject2 from "../unoptimized/isObject.js";
function isIterateeCall(value, index, object) {
  if (!isObject2(object)) {
    return false;
  }
  var type = typeof index;
  if (type == "number" ? isArrayLike2(object) && isIndex2(index, object.length) : type == "string" && index in object) {
    return eq2(object[index], value);
  }
  return false;
}
var __VIRTUAL_FILE = isIterateeCall;
export default __VIRTUAL_FILE;
