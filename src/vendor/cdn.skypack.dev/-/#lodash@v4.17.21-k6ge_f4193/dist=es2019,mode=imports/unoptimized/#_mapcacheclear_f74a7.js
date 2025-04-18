import Hash2 from "../unoptimized/_Hash.js";
import ListCache2 from "../unoptimized/_ListCache.js";
import Map2 from "../unoptimized/_Map.js";
function mapCacheClear() {
  this.size = 0;
  this.__data__ = {
    hash: new Hash2(),
    map: new (Map2 || ListCache2)(),
    string: new Hash2()
  };
}
var __VIRTUAL_FILE = mapCacheClear;
export default __VIRTUAL_FILE;
