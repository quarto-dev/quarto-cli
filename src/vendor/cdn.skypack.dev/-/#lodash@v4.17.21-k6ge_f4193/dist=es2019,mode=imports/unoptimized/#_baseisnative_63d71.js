import isFunction2 from "../unoptimized/isFunction.js";
import isMasked2 from "../unoptimized/_isMasked.js";
import isObject2 from "../unoptimized/isObject.js";
import toSource2 from "../unoptimized/_toSource.js";
var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;
var reIsHostCtor = /^\[object .+?Constructor\]$/;
var funcProto = Function.prototype, objectProto = Object.prototype;
var funcToString = funcProto.toString;
var hasOwnProperty = objectProto.hasOwnProperty;
var reIsNative = RegExp("^" + funcToString.call(hasOwnProperty).replace(reRegExpChar, "\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, "$1.*?") + "$");
function baseIsNative(value) {
  if (!isObject2(value) || isMasked2(value)) {
    return false;
  }
  var pattern = isFunction2(value) ? reIsNative : reIsHostCtor;
  return pattern.test(toSource2(value));
}
var __VIRTUAL_FILE = baseIsNative;
export default __VIRTUAL_FILE;
