import assignValue2 from "../unoptimized/_assignValue.js";
import baseAssignValue2 from "../unoptimized/_baseAssignValue.js";
function copyObject(source, props, object, customizer) {
  var isNew = !object;
  object || (object = {});
  var index = -1, length = props.length;
  while (++index < length) {
    var key = props[index];
    var newValue = customizer ? customizer(object[key], source[key], key, object, source) : void 0;
    if (newValue === void 0) {
      newValue = source[key];
    }
    if (isNew) {
      baseAssignValue2(object, key, newValue);
    } else {
      assignValue2(object, key, newValue);
    }
  }
  return object;
}
var __VIRTUAL_FILE = copyObject;
export default __VIRTUAL_FILE;
