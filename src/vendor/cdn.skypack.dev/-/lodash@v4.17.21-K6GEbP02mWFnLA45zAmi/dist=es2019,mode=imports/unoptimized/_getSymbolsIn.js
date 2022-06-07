import arrayPush2 from "../unoptimized/_arrayPush.js";
import getPrototype2 from "../unoptimized/_getPrototype.js";
import getSymbols2 from "../unoptimized/_getSymbols.js";
import stubArray2 from "../unoptimized/stubArray.js";
var nativeGetSymbols = Object.getOwnPropertySymbols;
var getSymbolsIn = !nativeGetSymbols ? stubArray2 : function(object) {
  var result = [];
  while (object) {
    arrayPush2(result, getSymbols2(object));
    object = getPrototype2(object);
  }
  return result;
};
var __VIRTUAL_FILE = getSymbolsIn;
export default __VIRTUAL_FILE;
