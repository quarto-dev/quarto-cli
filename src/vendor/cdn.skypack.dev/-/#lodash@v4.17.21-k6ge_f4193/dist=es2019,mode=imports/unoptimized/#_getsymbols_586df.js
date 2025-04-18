import arrayFilter2 from "../unoptimized/_arrayFilter.js";
import stubArray2 from "../unoptimized/stubArray.js";
var objectProto = Object.prototype;
var propertyIsEnumerable = objectProto.propertyIsEnumerable;
var nativeGetSymbols = Object.getOwnPropertySymbols;
var getSymbols = !nativeGetSymbols ? stubArray2 : function(object) {
  if (object == null) {
    return [];
  }
  object = Object(object);
  return arrayFilter2(nativeGetSymbols(object), function(symbol) {
    return propertyIsEnumerable.call(object, symbol);
  });
};
var __VIRTUAL_FILE = getSymbols;
export default __VIRTUAL_FILE;
