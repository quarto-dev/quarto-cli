import mapCacheClear2 from "../unoptimized/_mapCacheClear.js";
import mapCacheDelete2 from "../unoptimized/_mapCacheDelete.js";
import mapCacheGet2 from "../unoptimized/_mapCacheGet.js";
import mapCacheHas2 from "../unoptimized/_mapCacheHas.js";
import mapCacheSet2 from "../unoptimized/_mapCacheSet.js";
function MapCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
MapCache.prototype.clear = mapCacheClear2;
MapCache.prototype["delete"] = mapCacheDelete2;
MapCache.prototype.get = mapCacheGet2;
MapCache.prototype.has = mapCacheHas2;
MapCache.prototype.set = mapCacheSet2;
var __VIRTUAL_FILE = MapCache;
export default __VIRTUAL_FILE;
