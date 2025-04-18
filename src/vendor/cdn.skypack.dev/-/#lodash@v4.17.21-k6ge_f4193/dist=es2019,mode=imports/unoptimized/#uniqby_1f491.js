import baseIteratee2 from "../unoptimized/_baseIteratee.js";
import baseUniq2 from "../unoptimized/_baseUniq.js";
function uniqBy(array, iteratee) {
  return array && array.length ? baseUniq2(array, baseIteratee2(iteratee, 2)) : [];
}
var __VIRTUAL_FILE = uniqBy;
export default __VIRTUAL_FILE;
