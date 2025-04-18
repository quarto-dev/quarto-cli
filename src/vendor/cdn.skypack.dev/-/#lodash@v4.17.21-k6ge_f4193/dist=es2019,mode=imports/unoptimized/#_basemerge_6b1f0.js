import Stack2 from "../unoptimized/_Stack.js";
import assignMergeValue2 from "../unoptimized/_assignMergeValue.js";
import baseFor2 from "../unoptimized/_baseFor.js";
import baseMergeDeep2 from "../unoptimized/_baseMergeDeep.js";
import isObject2 from "../unoptimized/isObject.js";
import keysIn2 from "../unoptimized/keysIn.js";
import safeGet2 from "../unoptimized/_safeGet.js";
function baseMerge(object, source, srcIndex, customizer, stack) {
  if (object === source) {
    return;
  }
  baseFor2(source, function(srcValue, key) {
    stack || (stack = new Stack2());
    if (isObject2(srcValue)) {
      baseMergeDeep2(object, source, key, srcIndex, baseMerge, customizer, stack);
    } else {
      var newValue = customizer ? customizer(safeGet2(object, key), srcValue, key + "", object, source, stack) : void 0;
      if (newValue === void 0) {
        newValue = srcValue;
      }
      assignMergeValue2(object, key, newValue);
    }
  }, keysIn2);
}
var __VIRTUAL_FILE = baseMerge;
export default __VIRTUAL_FILE;
