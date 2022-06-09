import baseAssignValue2 from "../unoptimized/_baseAssignValue.js";
import eq2 from "../unoptimized/eq.js";
function assignMergeValue(object, key, value) {
  if (value !== void 0 && !eq2(object[key], value) || value === void 0 && !(key in object)) {
    baseAssignValue2(object, key, value);
  }
}
var __VIRTUAL_FILE = assignMergeValue;
export default __VIRTUAL_FILE;
