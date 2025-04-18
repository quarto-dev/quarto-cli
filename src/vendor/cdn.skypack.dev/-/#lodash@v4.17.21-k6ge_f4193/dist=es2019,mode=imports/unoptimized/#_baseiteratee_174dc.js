import baseMatches2 from "../unoptimized/_baseMatches.js";
import baseMatchesProperty2 from "../unoptimized/_baseMatchesProperty.js";
import identity2 from "../unoptimized/identity.js";
import isArray2 from "../unoptimized/isArray.js";
import property2 from "../unoptimized/property.js";
function baseIteratee(value) {
  if (typeof value == "function") {
    return value;
  }
  if (value == null) {
    return identity2;
  }
  if (typeof value == "object") {
    return isArray2(value) ? baseMatchesProperty2(value[0], value[1]) : baseMatches2(value);
  }
  return property2(value);
}
var __VIRTUAL_FILE = baseIteratee;
export default __VIRTUAL_FILE;
