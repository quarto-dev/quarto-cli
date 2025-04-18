import SetCache2 from "../unoptimized/_SetCache.js";
import arrayIncludes2 from "../unoptimized/_arrayIncludes.js";
import arrayIncludesWith2 from "../unoptimized/_arrayIncludesWith.js";
import arrayMap2 from "../unoptimized/_arrayMap.js";
import baseUnary2 from "../unoptimized/_baseUnary.js";
import cacheHas2 from "../unoptimized/_cacheHas.js";
var LARGE_ARRAY_SIZE = 200;
function baseDifference(array, values, iteratee, comparator) {
  var index = -1, includes = arrayIncludes2, isCommon = true, length = array.length, result = [], valuesLength = values.length;
  if (!length) {
    return result;
  }
  if (iteratee) {
    values = arrayMap2(values, baseUnary2(iteratee));
  }
  if (comparator) {
    includes = arrayIncludesWith2;
    isCommon = false;
  } else if (values.length >= LARGE_ARRAY_SIZE) {
    includes = cacheHas2;
    isCommon = false;
    values = new SetCache2(values);
  }
  outer:
    while (++index < length) {
      var value = array[index], computed = iteratee == null ? value : iteratee(value);
      value = comparator || value !== 0 ? value : 0;
      if (isCommon && computed === computed) {
        var valuesIndex = valuesLength;
        while (valuesIndex--) {
          if (values[valuesIndex] === computed) {
            continue outer;
          }
        }
        result.push(value);
      } else if (!includes(values, computed, comparator)) {
        result.push(value);
      }
    }
  return result;
}
var __VIRTUAL_FILE = baseDifference;
export default __VIRTUAL_FILE;
