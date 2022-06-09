import isObject2 from "../unoptimized/isObject.js";
var objectCreate = Object.create;
var baseCreate = function() {
  function object() {
  }
  return function(proto) {
    if (!isObject2(proto)) {
      return {};
    }
    if (objectCreate) {
      return objectCreate(proto);
    }
    object.prototype = proto;
    var result = new object();
    object.prototype = void 0;
    return result;
  };
}();
var __VIRTUAL_FILE = baseCreate;
export default __VIRTUAL_FILE;
