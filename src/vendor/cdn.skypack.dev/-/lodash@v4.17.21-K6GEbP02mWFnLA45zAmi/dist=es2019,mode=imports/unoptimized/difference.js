import baseDifference2 from "../unoptimized/_baseDifference.js";
import baseFlatten2 from "../unoptimized/_baseFlatten.js";
import baseRest2 from "../unoptimized/_baseRest.js";
import isArrayLikeObject2 from "../unoptimized/isArrayLikeObject.js";
var difference = baseRest2(function(array, values) {
  return isArrayLikeObject2(array) ? baseDifference2(array, baseFlatten2(values, 1, isArrayLikeObject2, true)) : [];
});
var __VIRTUAL_FILE = difference;
export default __VIRTUAL_FILE;
