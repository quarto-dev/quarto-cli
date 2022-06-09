import Stack2 from "../unoptimized/_Stack.js";
import arrayEach2 from "../unoptimized/_arrayEach.js";
import assignValue2 from "../unoptimized/_assignValue.js";
import baseAssign2 from "../unoptimized/_baseAssign.js";
import baseAssignIn2 from "../unoptimized/_baseAssignIn.js";
import cloneBuffer2 from "../unoptimized/_cloneBuffer.js";
import copyArray2 from "../unoptimized/_copyArray.js";
import copySymbols2 from "../unoptimized/_copySymbols.js";
import copySymbolsIn2 from "../unoptimized/_copySymbolsIn.js";
import getAllKeys2 from "../unoptimized/_getAllKeys.js";
import getAllKeysIn2 from "../unoptimized/_getAllKeysIn.js";
import getTag2 from "../unoptimized/_getTag.js";
import initCloneArray2 from "../unoptimized/_initCloneArray.js";
import initCloneByTag2 from "../unoptimized/_initCloneByTag.js";
import initCloneObject2 from "../unoptimized/_initCloneObject.js";
import isArray2 from "../unoptimized/isArray.js";
import isBuffer2 from "../unoptimized/isBuffer.js";
import isMap2 from "../unoptimized/isMap.js";
import isObject2 from "../unoptimized/isObject.js";
import isSet2 from "../unoptimized/isSet.js";
import keys2 from "../unoptimized/keys.js";
import keysIn2 from "../unoptimized/keysIn.js";
var CLONE_DEEP_FLAG = 1, CLONE_FLAT_FLAG = 2, CLONE_SYMBOLS_FLAG = 4;
var argsTag = "[object Arguments]", arrayTag = "[object Array]", boolTag = "[object Boolean]", dateTag = "[object Date]", errorTag = "[object Error]", funcTag = "[object Function]", genTag = "[object GeneratorFunction]", mapTag = "[object Map]", numberTag = "[object Number]", objectTag = "[object Object]", regexpTag = "[object RegExp]", setTag = "[object Set]", stringTag = "[object String]", symbolTag = "[object Symbol]", weakMapTag = "[object WeakMap]";
var arrayBufferTag = "[object ArrayBuffer]", dataViewTag = "[object DataView]", float32Tag = "[object Float32Array]", float64Tag = "[object Float64Array]", int8Tag = "[object Int8Array]", int16Tag = "[object Int16Array]", int32Tag = "[object Int32Array]", uint8Tag = "[object Uint8Array]", uint8ClampedTag = "[object Uint8ClampedArray]", uint16Tag = "[object Uint16Array]", uint32Tag = "[object Uint32Array]";
var cloneableTags = {};
cloneableTags[argsTag] = cloneableTags[arrayTag] = cloneableTags[arrayBufferTag] = cloneableTags[dataViewTag] = cloneableTags[boolTag] = cloneableTags[dateTag] = cloneableTags[float32Tag] = cloneableTags[float64Tag] = cloneableTags[int8Tag] = cloneableTags[int16Tag] = cloneableTags[int32Tag] = cloneableTags[mapTag] = cloneableTags[numberTag] = cloneableTags[objectTag] = cloneableTags[regexpTag] = cloneableTags[setTag] = cloneableTags[stringTag] = cloneableTags[symbolTag] = cloneableTags[uint8Tag] = cloneableTags[uint8ClampedTag] = cloneableTags[uint16Tag] = cloneableTags[uint32Tag] = true;
cloneableTags[errorTag] = cloneableTags[funcTag] = cloneableTags[weakMapTag] = false;
function baseClone(value, bitmask, customizer, key, object, stack) {
  var result, isDeep = bitmask & CLONE_DEEP_FLAG, isFlat = bitmask & CLONE_FLAT_FLAG, isFull = bitmask & CLONE_SYMBOLS_FLAG;
  if (customizer) {
    result = object ? customizer(value, key, object, stack) : customizer(value);
  }
  if (result !== void 0) {
    return result;
  }
  if (!isObject2(value)) {
    return value;
  }
  var isArr = isArray2(value);
  if (isArr) {
    result = initCloneArray2(value);
    if (!isDeep) {
      return copyArray2(value, result);
    }
  } else {
    var tag = getTag2(value), isFunc = tag == funcTag || tag == genTag;
    if (isBuffer2(value)) {
      return cloneBuffer2(value, isDeep);
    }
    if (tag == objectTag || tag == argsTag || isFunc && !object) {
      result = isFlat || isFunc ? {} : initCloneObject2(value);
      if (!isDeep) {
        return isFlat ? copySymbolsIn2(value, baseAssignIn2(result, value)) : copySymbols2(value, baseAssign2(result, value));
      }
    } else {
      if (!cloneableTags[tag]) {
        return object ? value : {};
      }
      result = initCloneByTag2(value, tag, isDeep);
    }
  }
  stack || (stack = new Stack2());
  var stacked = stack.get(value);
  if (stacked) {
    return stacked;
  }
  stack.set(value, result);
  if (isSet2(value)) {
    value.forEach(function(subValue) {
      result.add(baseClone(subValue, bitmask, customizer, subValue, value, stack));
    });
  } else if (isMap2(value)) {
    value.forEach(function(subValue, key2) {
      result.set(key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
    });
  }
  var keysFunc = isFull ? isFlat ? getAllKeysIn2 : getAllKeys2 : isFlat ? keysIn2 : keys2;
  var props = isArr ? void 0 : keysFunc(value);
  arrayEach2(props || value, function(subValue, key2) {
    if (props) {
      key2 = subValue;
      subValue = value[key2];
    }
    assignValue2(result, key2, baseClone(subValue, bitmask, customizer, key2, value, stack));
  });
  return result;
}
var __VIRTUAL_FILE = baseClone;
export default __VIRTUAL_FILE;
