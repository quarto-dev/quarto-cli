import SetCache2 from "../unoptimized/_SetCache.js";
import arrayIncludes2 from "../unoptimized/_arrayIncludes.js";
import arrayIncludesWith2 from "../unoptimized/_arrayIncludesWith.js";
import cacheHas2 from "../unoptimized/_cacheHas.js";
import createSet2 from "../unoptimized/_createSet.js";
import setToArray2 from "../unoptimized/_setToArray.js";
var LARGE_ARRAY_SIZE = 200;
function baseUniq(array, iteratee, comparator) {
  var index = -1, includes = arrayIncludes2, length = array.length, isCommon = true, result = [], seen = result;
  if (comparator) {
    isCommon = false;
    includes = arrayIncludesWith2;
  } else if (length >= LARGE_ARRAY_SIZE) {
    var set = iteratee ? null : createSet2(array);
    if (set) {
      return setToArray2(set);
    }
    isCommon = false;
    includes = cacheHas2;
    seen = new SetCache2();
  } else {
    seen = iteratee ? [] : result;
  }
  outer:
    while (++index < length) {
      var value = array[index], computed = iteratee ? iteratee(value) : value;
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var seenIndex = seen.length;
        while (seenIndex--) {
          if (seen[seenIndex] === computed) {
            continue outer;
          }
        }
        if (iteratee) {
          seen.push(computed);
        }
        result.push(value);
      } else if (!includes(seen, computed, comparator)) {
        if (seen !== result) {
          seen.push(computed);
        }
        result.push(value);
      }
    }
  return result;
}
var __VIRTUAL_FILE = baseUniq;
export default __VIRTUAL_FILE;
