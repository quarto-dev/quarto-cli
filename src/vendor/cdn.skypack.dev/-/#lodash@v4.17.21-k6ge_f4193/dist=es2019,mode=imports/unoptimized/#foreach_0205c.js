import arrayEach2 from "../unoptimized/_arrayEach.js";
import baseEach2 from "../unoptimized/_baseEach.js";
import castFunction2 from "../unoptimized/_castFunction.js";
import isArray2 from "../unoptimized/isArray.js";
function forEach(collection, iteratee) {
  var func = isArray2(collection) ? arrayEach2 : baseEach2;
  return func(collection, castFunction2(iteratee));
}
var __VIRTUAL_FILE = forEach;
export default __VIRTUAL_FILE;
