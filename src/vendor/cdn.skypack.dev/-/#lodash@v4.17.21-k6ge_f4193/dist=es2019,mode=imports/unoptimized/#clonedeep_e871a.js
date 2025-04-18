import baseClone2 from "../unoptimized/_baseClone.js";
var CLONE_DEEP_FLAG = 1, CLONE_SYMBOLS_FLAG = 4;
function cloneDeep(value) {
  return baseClone2(value, CLONE_DEEP_FLAG | CLONE_SYMBOLS_FLAG);
}
var __VIRTUAL_FILE = cloneDeep;
export default __VIRTUAL_FILE;
