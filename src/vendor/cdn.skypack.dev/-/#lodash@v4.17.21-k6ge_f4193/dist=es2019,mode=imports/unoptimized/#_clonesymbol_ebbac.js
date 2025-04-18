import Symbol2 from "../unoptimized/_Symbol.js";
var symbolProto = Symbol2 ? Symbol2.prototype : void 0, symbolValueOf = symbolProto ? symbolProto.valueOf : void 0;
function cloneSymbol(symbol) {
  return symbolValueOf ? Object(symbolValueOf.call(symbol)) : {};
}
var __VIRTUAL_FILE = cloneSymbol;
export default __VIRTUAL_FILE;
