import getMapData2 from "../unoptimized/_getMapData.js";
function mapCacheDelete(key) {
  var result = getMapData2(this, key)["delete"](key);
  this.size -= result ? 1 : 0;
  return result;
}
var __VIRTUAL_FILE = mapCacheDelete;
export default __VIRTUAL_FILE;
