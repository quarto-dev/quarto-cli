import listCacheClear2 from "../unoptimized/_listCacheClear.js";
import listCacheDelete2 from "../unoptimized/_listCacheDelete.js";
import listCacheGet2 from "../unoptimized/_listCacheGet.js";
import listCacheHas2 from "../unoptimized/_listCacheHas.js";
import listCacheSet2 from "../unoptimized/_listCacheSet.js";
function ListCache(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
ListCache.prototype.clear = listCacheClear2;
ListCache.prototype["delete"] = listCacheDelete2;
ListCache.prototype.get = listCacheGet2;
ListCache.prototype.has = listCacheHas2;
ListCache.prototype.set = listCacheSet2;
var __VIRTUAL_FILE = ListCache;
export default __VIRTUAL_FILE;
