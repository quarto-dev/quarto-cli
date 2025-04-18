import Symbol2 from "../unoptimized/_Symbol.js";
import isArguments2 from "../unoptimized/isArguments.js";
import isArray2 from "../unoptimized/isArray.js";
var spreadableSymbol = Symbol2 ? Symbol2.isConcatSpreadable : void 0;
function isFlattenable(value) {
  return isArray2(value) || isArguments2(value) || !!(spreadableSymbol && value && value[spreadableSymbol]);
}
var __VIRTUAL_FILE = isFlattenable;
export default __VIRTUAL_FILE;
