import getMapData2 from "../unoptimized/_getMapData.js";
function mapCacheGet(key) {
  return getMapData2(this, key).get(key);
}
var __VIRTUAL_FILE = mapCacheGet;
export default __VIRTUAL_FILE;
