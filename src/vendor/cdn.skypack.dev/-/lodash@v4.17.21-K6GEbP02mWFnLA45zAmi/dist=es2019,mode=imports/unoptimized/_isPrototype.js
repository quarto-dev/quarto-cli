var objectProto = Object.prototype;
function isPrototype(value) {
  var Ctor = value && value.constructor, proto = typeof Ctor == "function" && Ctor.prototype || objectProto;
  return value === proto;
}
var __VIRTUAL_FILE = isPrototype;
export default __VIRTUAL_FILE;
