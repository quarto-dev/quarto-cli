import assocIndexOf2 from "../unoptimized/_assocIndexOf.js";
function listCacheSet(key, value) {
  var data = this.__data__, index = assocIndexOf2(data, key);
  if (index < 0) {
    ++this.size;
    data.push([key, value]);
  } else {
    data[index][1] = value;
  }
  return this;
}
var __VIRTUAL_FILE = listCacheSet;
export default __VIRTUAL_FILE;
