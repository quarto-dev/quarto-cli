import castPath2 from "../unoptimized/_castPath.js";
import toKey2 from "../unoptimized/_toKey.js";
function baseGet(object, path) {
  path = castPath2(path, object);
  var index = 0, length = path.length;
  while (object != null && index < length) {
    object = object[toKey2(path[index++])];
  }
  return index && index == length ? object : void 0;
}
var __VIRTUAL_FILE = baseGet;
export default __VIRTUAL_FILE;
