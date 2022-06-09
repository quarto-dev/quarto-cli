import isObject2 from "../unoptimized/isObject.js";
function isStrictComparable(value) {
  return value === value && !isObject2(value);
}
var __VIRTUAL_FILE = isStrictComparable;
export default __VIRTUAL_FILE;
