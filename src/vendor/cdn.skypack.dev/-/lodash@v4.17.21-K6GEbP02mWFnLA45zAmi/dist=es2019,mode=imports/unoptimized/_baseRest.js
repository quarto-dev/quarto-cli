import identity2 from "../unoptimized/identity.js";
import overRest2 from "../unoptimized/_overRest.js";
import setToString2 from "../unoptimized/_setToString.js";
function baseRest(func, start) {
  return setToString2(overRest2(func, start, identity2), func + "");
}
var __VIRTUAL_FILE = baseRest;
export default __VIRTUAL_FILE;
