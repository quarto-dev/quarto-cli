import copyArray2 from "../unoptimized/_copyArray.js";
import shuffleSelf2 from "../unoptimized/_shuffleSelf.js";
function arrayShuffle(array) {
  return shuffleSelf2(copyArray2(array));
}
var __VIRTUAL_FILE = arrayShuffle;
export default __VIRTUAL_FILE;
