import ListCache2 from "../unoptimized/_ListCache.js";
import stackClear2 from "../unoptimized/_stackClear.js";
import stackDelete2 from "../unoptimized/_stackDelete.js";
import stackGet2 from "../unoptimized/_stackGet.js";
import stackHas2 from "../unoptimized/_stackHas.js";
import stackSet2 from "../unoptimized/_stackSet.js";
function Stack(entries) {
  var data = this.__data__ = new ListCache2(entries);
  this.size = data.size;
}
Stack.prototype.clear = stackClear2;
Stack.prototype["delete"] = stackDelete2;
Stack.prototype.get = stackGet2;
Stack.prototype.has = stackHas2;
Stack.prototype.set = stackSet2;
var __VIRTUAL_FILE = Stack;
export default __VIRTUAL_FILE;
