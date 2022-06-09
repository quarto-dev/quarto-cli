import hashClear2 from "../unoptimized/_hashClear.js";
import hashDelete2 from "../unoptimized/_hashDelete.js";
import hashGet2 from "../unoptimized/_hashGet.js";
import hashHas2 from "../unoptimized/_hashHas.js";
import hashSet2 from "../unoptimized/_hashSet.js";
function Hash(entries) {
  var index = -1, length = entries == null ? 0 : entries.length;
  this.clear();
  while (++index < length) {
    var entry = entries[index];
    this.set(entry[0], entry[1]);
  }
}
Hash.prototype.clear = hashClear2;
Hash.prototype["delete"] = hashDelete2;
Hash.prototype.get = hashGet2;
Hash.prototype.has = hashHas2;
Hash.prototype.set = hashSet2;
var __VIRTUAL_FILE = Hash;
export default __VIRTUAL_FILE;
