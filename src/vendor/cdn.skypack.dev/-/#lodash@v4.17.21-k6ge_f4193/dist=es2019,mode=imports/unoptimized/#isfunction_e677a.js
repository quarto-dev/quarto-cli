import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import isObject2 from "../unoptimized/isObject.js";
var asyncTag = "[object AsyncFunction]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", proxyTag = "[object Proxy]";
function isFunction(value) {
  if (!isObject2(value)) {
    return false;
  }
  var tag = baseGetTag2(value);
  return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
}
var __VIRTUAL_FILE = isFunction;
export default __VIRTUAL_FILE;
