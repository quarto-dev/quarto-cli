import getTag2 from "../unoptimized/_getTag.js";
import isObjectLike2 from "../unoptimized/isObjectLike.js";
var mapTag = "[object Map]";
function baseIsMap(value) {
  return isObjectLike2(value) && getTag2(value) == mapTag;
}
var __VIRTUAL_FILE = baseIsMap;
export default __VIRTUAL_FILE;
