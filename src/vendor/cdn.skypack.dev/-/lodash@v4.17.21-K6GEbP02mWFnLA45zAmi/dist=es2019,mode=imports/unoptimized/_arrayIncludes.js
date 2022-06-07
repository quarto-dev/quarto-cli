import baseIndexOf2 from "../unoptimized/_baseIndexOf.js";
function arrayIncludes(array, value) {
  var length = array == null ? 0 : array.length;
  return !!length && baseIndexOf2(array, value, 0) > -1;
}
var __VIRTUAL_FILE = arrayIncludes;
export default __VIRTUAL_FILE;
