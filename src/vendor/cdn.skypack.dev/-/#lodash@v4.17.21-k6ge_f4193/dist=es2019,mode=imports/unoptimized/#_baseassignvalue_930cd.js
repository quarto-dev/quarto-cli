import defineProperty2 from "../unoptimized/_defineProperty.js";
function baseAssignValue(object, key, value) {
  if (key == "__proto__" && defineProperty2) {
    defineProperty2(object, key, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    object[key] = value;
  }
}
var __VIRTUAL_FILE = baseAssignValue;
export default __VIRTUAL_FILE;
