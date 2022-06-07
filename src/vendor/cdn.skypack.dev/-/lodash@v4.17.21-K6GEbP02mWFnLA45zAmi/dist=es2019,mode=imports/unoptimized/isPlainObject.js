import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import getPrototype2 from "../unoptimized/_getPrototype.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var objectTag = "[object Object]";
var funcProto = Function.prototype, objectProto = Object.prototype;
var funcToString = funcProto.toString;
var hasOwnProperty = objectProto.hasOwnProperty;
var objectCtorString = funcToString.call(Object);
function isPlainObject(value) {
  if (!isObjectLike2(value) || baseGetTag2(value) != objectTag) {
    return false;
  }
  var proto = getPrototype2(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, "constructor") && proto.constructor;
  return typeof Ctor == "function" && Ctor instanceof Ctor && funcToString.call(Ctor) == objectCtorString;
}
var __VIRTUAL_FILE = isPlainObject;
export default __VIRTUAL_FILE;
