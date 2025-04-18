import baseHasIn2 from "../unoptimized/_baseHasIn.js";
import hasPath2 from "../unoptimized/_hasPath.js";
function hasIn(object, path) {
  return object != null && hasPath2(object, path, baseHasIn2);
}
var __VIRTUAL_FILE = hasIn;
export default __VIRTUAL_FILE;
