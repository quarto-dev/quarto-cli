import MapCache2 from "../unoptimized/_MapCache.js";
import setCacheAdd2 from "../unoptimized/_setCacheAdd.js";
import setCacheHas2 from "../unoptimized/_setCacheHas.js";
function SetCache(values) {
  var index = -1, length = values == null ? 0 : values.length;
  this.__data__ = new MapCache2();
  while (++index < length) {
    this.add(values[index]);
  }
}
SetCache.prototype.add = SetCache.prototype.push = setCacheAdd2;
SetCache.prototype.has = setCacheHas2;
var __VIRTUAL_FILE = SetCache;
export default __VIRTUAL_FILE;
