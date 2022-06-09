import baseOrderBy2 from "../unoptimized/_baseOrderBy.js";
import isArray2 from "../unoptimized/isArray.js";
function orderBy(collection, iteratees, orders, guard) {
  if (collection == null) {
    return [];
  }
  if (!isArray2(iteratees)) {
    iteratees = iteratees == null ? [] : [iteratees];
  }
  orders = guard ? void 0 : orders;
  if (!isArray2(orders)) {
    orders = orders == null ? [] : [orders];
  }
  return baseOrderBy2(collection, iteratees, orders);
}
var __VIRTUAL_FILE = orderBy;
export default __VIRTUAL_FILE;
