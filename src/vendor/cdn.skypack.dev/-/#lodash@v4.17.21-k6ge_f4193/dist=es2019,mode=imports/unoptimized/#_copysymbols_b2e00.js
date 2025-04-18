import copyObject2 from "../unoptimized/_copyObject.js";
import getSymbols2 from "../unoptimized/_getSymbols.js";
function copySymbols(source, object) {
  return copyObject2(source, getSymbols2(source), object);
}
var __VIRTUAL_FILE = copySymbols;
export default __VIRTUAL_FILE;
