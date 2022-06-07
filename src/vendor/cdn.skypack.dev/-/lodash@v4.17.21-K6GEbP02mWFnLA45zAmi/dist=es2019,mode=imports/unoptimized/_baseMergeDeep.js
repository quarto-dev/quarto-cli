import assignMergeValue2 from "../unoptimized/_assignMergeValue.js";
import cloneBuffer2 from "../unoptimized/_cloneBuffer.js";
import cloneTypedArray2 from "../unoptimized/_cloneTypedArray.js";
import copyArray2 from "../unoptimized/_copyArray.js";
import initCloneObject2 from "../unoptimized/_initCloneObject.js";
import isArguments2 from "../unoptimized/isArguments.js";
import isArray2 from "../unoptimized/isArray.js";
import isArrayLikeObject2 from "../unoptimized/isArrayLikeObject.js";
import isBuffer2 from "../unoptimized/isBuffer.js";
import isFunction2 from "../unoptimized/isFunction.js";
import isObject2 from "../unoptimized/isObject.js";
import isPlainObject2 from "../unoptimized/isPlainObject.js";
import isTypedArray2 from "../unoptimized/isTypedArray.js";
import safeGet2 from "../unoptimized/_safeGet.js";
import toPlainObject2 from "../unoptimized/toPlainObject.js";
function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
  var objValue = safeGet2(object, key), srcValue = safeGet2(source, key), stacked = stack.get(srcValue);
  if (stacked) {
    assignMergeValue2(object, key, stacked);
    return;
  }
  var newValue = customizer ? customizer(objValue, srcValue, key + "", object, source, stack) : void 0;
  var isCommon = newValue === void 0;
  if (isCommon) {
    var isArr = isArray2(srcValue), isBuff = !isArr && isBuffer2(srcValue), isTyped = !isArr && !isBuff && isTypedArray2(srcValue);
    newValue = srcValue;
    if (isArr || isBuff || isTyped) {
      if (isArray2(objValue)) {
        newValue = objValue;
      } else if (isArrayLikeObject2(objValue)) {
        newValue = copyArray2(objValue);
      } else if (isBuff) {
        isCommon = false;
        newValue = cloneBuffer2(srcValue, true);
      } else if (isTyped) {
        isCommon = false;
        newValue = cloneTypedArray2(srcValue, true);
      } else {
        newValue = [];
      }
    } else if (isPlainObject2(srcValue) || isArguments2(srcValue)) {
      newValue = objValue;
      if (isArguments2(objValue)) {
        newValue = toPlainObject2(objValue);
      } else if (!isObject2(objValue) || isFunction2(objValue)) {
        newValue = initCloneObject2(srcValue);
      }
    } else {
      isCommon = false;
    }
  }
  if (isCommon) {
    stack.set(srcValue, newValue);
    mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
    stack["delete"](srcValue);
  }
  assignMergeValue2(object, key, newValue);
}
var __VIRTUAL_FILE = baseMergeDeep;
export default __VIRTUAL_FILE;
