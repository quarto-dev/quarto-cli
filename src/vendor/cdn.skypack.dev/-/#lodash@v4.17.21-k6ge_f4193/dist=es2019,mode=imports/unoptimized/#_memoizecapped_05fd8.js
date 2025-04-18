import memoize2 from "../unoptimized/memoize.js";
var MAX_MEMOIZE_SIZE = 500;
function memoizeCapped(func) {
  var result = memoize2(func, function(key) {
    if (cache.size === MAX_MEMOIZE_SIZE) {
      cache.clear();
    }
    return key;
  });
  var cache = result.cache;
  return result;
}
var __VIRTUAL_FILE = memoizeCapped;
export default __VIRTUAL_FILE;
