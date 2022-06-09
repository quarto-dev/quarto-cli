import getTag2 from "../unoptimized/_getTag.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var setTag = "[object Set]";
function baseIsSet(value) {
  return isObjectLike2(value) && getTag2(value) == setTag;
}
var __VIRTUAL_FILE = baseIsSet;
export default __VIRTUAL_FILE;
