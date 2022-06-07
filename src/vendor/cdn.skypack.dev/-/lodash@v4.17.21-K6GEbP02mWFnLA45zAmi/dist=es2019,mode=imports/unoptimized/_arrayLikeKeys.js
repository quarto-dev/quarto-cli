import baseTimes2 from "../unoptimized/_baseTimes.js";
import isArguments2 from "../unoptimized/isArguments.js";
import isArray2 from "../unoptimized/isArray.js";
import isBuffer2 from "../unoptimized/isBuffer.js";
import isIndex2 from "../unoptimized/_isIndex.js";
import isTypedArray2 from "../unoptimized/isTypedArray.js";
var objectProto = Object.prototype;
var hasOwnProperty = objectProto.hasOwnProperty;
function arrayLikeKeys(value, inherited) {
  var isArr = isArray2(value), isArg = !isArr && isArguments2(value), isBuff = !isArr && !isArg && isBuffer2(value), isType = !isArr && !isArg && !isBuff && isTypedArray2(value), skipIndexes = isArr || isArg || isBuff || isType, result = skipIndexes ? baseTimes2(value.length, String) : [], length = result.length;
  for (var key in value) {
    if ((inherited || hasOwnProperty.call(value, key)) && !(skipIndexes && (key == "length" || isBuff && (key == "offset" || key == "parent") || isType && (key == "buffer" || key == "byteLength" || key == "byteOffset") || isIndex2(key, length)))) {
      result.push(key);
    }
  }
  return result;
}
var __VIRTUAL_FILE = arrayLikeKeys;
export default __VIRTUAL_FILE;
