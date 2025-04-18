import eq2 from "../unoptimized/eq.js";
function assocIndexOf(array, key) {
  var length = array.length;
  while (length--) {
    if (eq2(array[length][0], key)) {
      return length;
    }
  }
  return -1;
}
var __VIRTUAL_FILE = assocIndexOf;
export default __VIRTUAL_FILE;
