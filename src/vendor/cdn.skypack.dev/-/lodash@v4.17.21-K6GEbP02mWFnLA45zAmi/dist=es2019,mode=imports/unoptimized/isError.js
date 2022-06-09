import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
import isPlainObject2 from "../unoptimized/isPlainObject.js";
var domExcTag = "[object DOMException]", errorTag = "[object Error]";
function isError(value) {
  if (!isObjectLike2(value)) {
    return false;
  }
  var tag = baseGetTag2(value);
  return tag == errorTag || tag == domExcTag || typeof value.message == "string" && typeof value.name == "string" && !isPlainObject2(value);
}
var __VIRTUAL_FILE = isError;
export default __VIRTUAL_FILE;
