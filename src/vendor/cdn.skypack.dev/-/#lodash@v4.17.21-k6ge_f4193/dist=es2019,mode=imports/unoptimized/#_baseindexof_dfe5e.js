import baseFindIndex2 from "../unoptimized/_baseFindIndex.js";
import baseIsNaN2 from "../unoptimized/_baseIsNaN.js";
import strictIndexOf2 from "../unoptimized/_strictIndexOf.js";
function baseIndexOf(array, value, fromIndex) {
  return value === value ? strictIndexOf2(array, value, fromIndex) : baseFindIndex2(array, baseIsNaN2, fromIndex);
}
var __VIRTUAL_FILE = baseIndexOf;
export default __VIRTUAL_FILE;
