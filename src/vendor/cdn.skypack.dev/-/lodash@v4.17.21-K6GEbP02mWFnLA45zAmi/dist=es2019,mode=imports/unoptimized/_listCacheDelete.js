import assocIndexOf2 from "../unoptimized/_assocIndexOf.js";
var arrayProto = Array.prototype;
var splice = arrayProto.splice;
function listCacheDelete(key) {
  var data = this.__data__, index = assocIndexOf2(data, key);
  if (index < 0) {
    return false;
  }
  var lastIndex = data.length - 1;
  if (index == lastIndex) {
    data.pop();
  } else {
    splice.call(data, index, 1);
  }
  --this.size;
  return true;
}
var __VIRTUAL_FILE = listCacheDelete;
export default __VIRTUAL_FILE;
