import baseIsArguments2 from "../unoptimized/_baseIsArguments.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
var propertyIsEnumerable = objectProto.propertyIsEnumerable;
var isArguments = baseIsArguments2(function() {
  return arguments;
}()) ? baseIsArguments2 : function(value) {
  return isObjectLike2(value) && hasOwnProperty.call(value, "callee") && !propertyIsEnumerable.call(value, "callee");
};
var __VIRTUAL_FILE = isArguments;
export default __VIRTUAL_FILE;
