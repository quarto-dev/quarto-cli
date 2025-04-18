import getMapData2 from "../unoptimized/_getMapData.js";
function mapCacheHas(key) {
  return getMapData2(this, key).has(key);
}
var __VIRTUAL_FILE = mapCacheHas;
export default __VIRTUAL_FILE;
