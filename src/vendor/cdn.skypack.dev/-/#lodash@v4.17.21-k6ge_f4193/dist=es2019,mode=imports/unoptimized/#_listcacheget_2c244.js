import assocIndexOf2 from "../unoptimized/_assocIndexOf.js";
function listCacheGet(key) {
  var data = this.__data__, index = assocIndexOf2(data, key);
  return index < 0 ? void 0 : data[index][1];
}
var __VIRTUAL_FILE = listCacheGet;
export default __VIRTUAL_FILE;
