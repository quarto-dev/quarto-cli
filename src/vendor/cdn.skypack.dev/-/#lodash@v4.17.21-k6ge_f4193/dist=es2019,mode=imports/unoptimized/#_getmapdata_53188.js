import isKeyable2 from "../unoptimized/_isKeyable.js";
function getMapData(map, key) {
  var data = map.__data__;
  return isKeyable2(key) ? data[typeof key == "string" ? "string" : "hash"] : data.map;
}
var __VIRTUAL_FILE = getMapData;
export default __VIRTUAL_FILE;
