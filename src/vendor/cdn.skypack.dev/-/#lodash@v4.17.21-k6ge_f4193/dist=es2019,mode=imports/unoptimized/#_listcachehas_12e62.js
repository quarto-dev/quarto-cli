import assocIndexOf2 from "../unoptimized/_assocIndexOf.js";
function listCacheHas(key) {
  return assocIndexOf2(this.__data__, key) > -1;
}
var __VIRTUAL_FILE = listCacheHas;
export default __VIRTUAL_FILE;
