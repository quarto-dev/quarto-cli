import baseEach2 from "../unoptimized/_baseEach.js";
import isArrayLike2 from "../unoptimized/isArrayLike.js";
function baseMap(collection, iteratee) {
  var index = -1, result = isArrayLike2(collection) ? Array(collection.length) : [];
  baseEach2(collection, function(value, key, collection2) {
    result[++index] = iteratee(value, key, collection2);
  });
  return result;
}
var __VIRTUAL_FILE = baseMap;
export default __VIRTUAL_FILE;
