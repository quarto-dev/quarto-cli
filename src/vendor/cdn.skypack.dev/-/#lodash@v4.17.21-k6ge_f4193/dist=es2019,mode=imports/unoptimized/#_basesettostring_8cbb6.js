import constant2 from "../unoptimized/constant.js";
import defineProperty2 from "../unoptimized/_defineProperty.js";
import identity2 from "../unoptimized/identity.js";
var baseSetToString = !defineProperty2 ? identity2 : function(func, string) {
  return defineProperty2(func, "toString", {
    configurable: true,
    enumerable: false,
    value: constant2(string),
    writable: true
  });
};
var __VIRTUAL_FILE = baseSetToString;
export default __VIRTUAL_FILE;
