import isStrictComparable2 from "../unoptimized/_isStrictComparable.js";
import keys2 from "../unoptimized/keys.js";
function getMatchData(object) {
  var result = keys2(object), length = result.length;
  while (length--) {
    var key = result[length], value = object[key];
    result[length] = [key, value, isStrictComparable2(value)];
  }
  return result;
}
var __VIRTUAL_FILE = getMatchData;
export default __VIRTUAL_FILE;
