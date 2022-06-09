import arrayMap2 from "../unoptimized/_arrayMap.js";
import baseGet2 from "../unoptimized/_baseGet.js";
import baseIteratee2 from "../unoptimized/_baseIteratee.js";
import baseMap2 from "../unoptimized/_baseMap.js";
import baseSortBy2 from "../unoptimized/_baseSortBy.js";
import baseUnary2 from "../unoptimized/_baseUnary.js";
import compareMultiple2 from "../unoptimized/_compareMultiple.js";
import identity2 from "../unoptimized/identity.js";
import isArray2 from "../unoptimized/isArray.js";
function baseOrderBy(collection, iteratees, orders) {
  if (iteratees.length) {
    iteratees = arrayMap2(iteratees, function(iteratee) {
      if (isArray2(iteratee)) {
        return function(value) {
          return baseGet2(value, iteratee.length === 1 ? iteratee[0] : iteratee);
        };
      }
      return iteratee;
    });
  } else {
    iteratees = [identity2];
  }
  var index = -1;
  iteratees = arrayMap2(iteratees, baseUnary2(baseIteratee2));
  var result = baseMap2(collection, function(value, key, collection2) {
    var criteria = arrayMap2(iteratees, function(iteratee) {
      return iteratee(value);
    });
    return {criteria, index: ++index, value};
  });
  return baseSortBy2(result, function(object, other) {
    return compareMultiple2(object, other, orders);
  });
}
var __VIRTUAL_FILE = baseOrderBy;
export default __VIRTUAL_FILE;
