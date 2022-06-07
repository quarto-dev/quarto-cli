import arrayMap2 from "../unoptimized/_arrayMap.js";
function baseValues(object, props) {
  return arrayMap2(props, function(key) {
    return object[key];
  });
}
var __VIRTUAL_FILE = baseValues;
export default __VIRTUAL_FILE;
