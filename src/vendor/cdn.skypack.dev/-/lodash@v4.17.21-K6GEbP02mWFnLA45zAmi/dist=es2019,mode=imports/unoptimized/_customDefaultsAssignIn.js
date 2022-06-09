import eq2 from "../unoptimized/eq.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function customDefaultsAssignIn(objValue, srcValue, key, object) {
  if (objValue === void 0 || eq2(objValue, objectProto[key]) && !hasOwnProperty.call(object, key)) {
    return srcValue;
  }
  return objValue;
}
var __VIRTUAL_FILE = customDefaultsAssignIn;
export default __VIRTUAL_FILE;
