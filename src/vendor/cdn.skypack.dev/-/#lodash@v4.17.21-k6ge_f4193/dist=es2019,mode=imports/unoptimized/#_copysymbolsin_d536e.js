import copyObject2 from "../unoptimized/_copyObject.js";
import getSymbolsIn2 from "../unoptimized/_getSymbolsIn.js";
function copySymbolsIn(source, object) {
  return copyObject2(source, getSymbolsIn2(source), object);
}
var __VIRTUAL_FILE = copySymbolsIn;
export default __VIRTUAL_FILE;
