import arrayPush2 from "../unoptimized/_arrayPush.js";
import isFlattenable2 from "../unoptimized/_isFlattenable.js";
function baseFlatten(array, depth, predicate, isStrict, result) {
  var index = -1, length = array.length;
  predicate || (predicate = isFlattenable2);
  result || (result = []);
  while (++index < length) {
    var value = array[index];
    if (depth > 0 && predicate(value)) {
      if (depth > 1) {
        baseFlatten(value, depth - 1, predicate, isStrict, result);
      } else {
        arrayPush2(result, value);
      }
    } else if (!isStrict) {
      result[result.length] = value;
    }
  }
  return result;
}
var __VIRTUAL_FILE = baseFlatten;
export default __VIRTUAL_FILE;
