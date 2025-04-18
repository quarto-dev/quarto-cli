import coreJsData2 from "../unoptimized/_coreJsData.js";
var maskSrcKey = function() {
  var uid = /[^.]+$/.exec(coreJsData2 && coreJsData2.keys && coreJsData2.keys.IE_PROTO || "");
  return uid ? "Symbol(src)_1." + uid : "";
}();
function isMasked(func) {
  return !!maskSrcKey && maskSrcKey in func;
}
var __VIRTUAL_FILE = isMasked;
export default __VIRTUAL_FILE;
