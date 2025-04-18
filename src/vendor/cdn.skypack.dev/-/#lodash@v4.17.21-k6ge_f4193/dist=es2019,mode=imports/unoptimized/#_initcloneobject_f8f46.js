import baseCreate2 from "../unoptimized/_baseCreate.js";
import getPrototype2 from "../unoptimized/_getPrototype.js";
import isPrototype2 from "../unoptimized/_isPrototype.js";
function initCloneObject(object) {
  return typeof object.constructor == "function" && !isPrototype2(object) ? baseCreate2(getPrototype2(object)) : {};
}
var __VIRTUAL_FILE = initCloneObject;
export default __VIRTUAL_FILE;
