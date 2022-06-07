import baseAssignValue2 from "../unoptimized/_baseAssignValue.js";
import eq2 from "../unoptimized/eq.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function assignValue(object, key, value) {
  var objValue = object[key];
  if (!(hasOwnProperty.call(object, key) && eq2(objValue, value)) || value === void 0 && !(key in object)) {
    baseAssignValue2(object, key, value);
  }
}
var __VIRTUAL_FILE = assignValue;
export default __VIRTUAL_FILE;
