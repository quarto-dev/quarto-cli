import ListCache2 from "../unoptimized/_ListCache.js";
import Map2 from "../unoptimized/_Map.js";
import MapCache2 from "../unoptimized/_MapCache.js";
var LARGE_ARRAY_SIZE = 200;
function stackSet(key, value) {
  var data = this.__data__;
  if (data instanceof ListCache2) {
    var pairs = data.__data__;
    if (!Map2 || pairs.length < LARGE_ARRAY_SIZE - 1) {
      pairs.push([key, value]);
      this.size = ++data.size;
      return this;
    }
    data = this.__data__ = new MapCache2(pairs);
  }
  data.set(key, value);
  this.size = data.size;
  return this;
}
var __VIRTUAL_FILE = stackSet;
export default __VIRTUAL_FILE;
