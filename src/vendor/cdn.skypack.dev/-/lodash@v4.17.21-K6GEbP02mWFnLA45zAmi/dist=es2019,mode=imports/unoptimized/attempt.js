import apply2 from "../unoptimized/_apply.js";
import baseRest2 from "../unoptimized/_baseRest.js";
import isError2 from "../unoptimized/isError.js";
var attempt = baseRest2(function(func, args) {
  try {
    return apply2(func, void 0, args);
  } catch (e) {
    return isError2(e) ? e : new Error(e);
  }
});
var __VIRTUAL_FILE = attempt;
export default __VIRTUAL_FILE;
