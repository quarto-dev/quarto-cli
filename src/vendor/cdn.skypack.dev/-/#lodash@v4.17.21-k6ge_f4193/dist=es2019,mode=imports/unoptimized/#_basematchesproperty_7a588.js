import baseIsEqual2 from "../unoptimized/_baseIsEqual.js";
import get2 from "../unoptimized/get.js";
import hasIn2 from "../unoptimized/hasIn.js";
import isKey2 from "../unoptimized/_isKey.js";
import isStrictComparable2 from "../unoptimized/_isStrictComparable.js";
import matchesStrictComparable2 from "../unoptimized/_matchesStrictComparable.js";
import toKey2 from "../unoptimized/_toKey.js";
var COMPARE_PARTIAL_FLAG = 1, COMPARE_UNORDERED_FLAG = 2;
function baseMatchesProperty(path, srcValue) {
  if (isKey2(path) && isStrictComparable2(srcValue)) {
    return matchesStrictComparable2(toKey2(path), srcValue);
  }
  return function(object) {
    var objValue = get2(object, path);
    return objValue === void 0 && objValue === srcValue ? hasIn2(object, path) : baseIsEqual2(srcValue, objValue, COMPARE_PARTIAL_FLAG | COMPARE_UNORDERED_FLAG);
  };
}
var __VIRTUAL_FILE = baseMatchesProperty;
export default __VIRTUAL_FILE;
