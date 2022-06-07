import getMapData2 from "../unoptimized/_getMapData.js";
function mapCacheSet(key, value) {
  var data = getMapData2(this, key), size = data.size;
  data.set(key, value);
  this.size += data.size == size ? 0 : 1;
  return this;
}
var __VIRTUAL_FILE = mapCacheSet;
export default __VIRTUAL_FILE;
