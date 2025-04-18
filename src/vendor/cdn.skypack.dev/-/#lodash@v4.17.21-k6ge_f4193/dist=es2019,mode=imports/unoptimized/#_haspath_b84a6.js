import castPath2 from "../unoptimized/_castPath.js";
import isArguments2 from "../unoptimized/isArguments.js";
import isArray2 from "../unoptimized/isArray.js";
import isIndex2 from "../unoptimized/_isIndex.js";
import isLength2 from "../unoptimized/isLength.js";
import toKey2 from "../unoptimized/_toKey.js";
function hasPath(object, path, hasFunc) {
  path = castPath2(path, object);
  var index = -1, length = path.length, result = false;
  while (++index < length) {
    var key = toKey2(path[index]);
    if (!(result = object != null && hasFunc(object, key))) {
      break;
    }
    object = object[key];
  }
  if (result || ++index != length) {
    return result;
  }
  length = object == null ? 0 : object.length;
  return !!length && isLength2(length) && isIndex2(key, length) && (isArray2(object) || isArguments2(object));
}
var __VIRTUAL_FILE = hasPath;
export default __VIRTUAL_FILE;
