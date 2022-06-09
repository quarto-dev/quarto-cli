import baseGetTag2 from "../unoptimized/_baseGetTag.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var argsTag = "[object Arguments]";
function baseIsArguments(value) {
  return isObjectLike2(value) && baseGetTag2(value) == argsTag;
}
var __VIRTUAL_FILE = baseIsArguments;
export default __VIRTUAL_FILE;
