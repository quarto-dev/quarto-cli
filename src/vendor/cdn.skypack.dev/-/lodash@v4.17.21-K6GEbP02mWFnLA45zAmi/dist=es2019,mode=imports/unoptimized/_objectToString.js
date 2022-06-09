var objectProto = Object.prototype;
var nativeObjectToString = objectProto.toString;
function objectToString(value) {
  return nativeObjectToString.call(value);
}
var __VIRTUAL_FILE = objectToString;
export default __VIRTUAL_FILE;
