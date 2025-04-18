import baseIsEqualDeep2 from "../unoptimized/_baseIsEqualDeep.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
function baseIsEqual(value, other, bitmask, customizer, stack) {
  if (value === other) {
    return true;
  }
  if (value == null || other == null || !isObjectLike2(value) && !isObjectLike2(other)) {
    return value !== value && other !== other;
  }
  return baseIsEqualDeep2(value, other, bitmask, customizer, baseIsEqual, stack);
}
var __VIRTUAL_FILE = baseIsEqual;
export default __VIRTUAL_FILE;
