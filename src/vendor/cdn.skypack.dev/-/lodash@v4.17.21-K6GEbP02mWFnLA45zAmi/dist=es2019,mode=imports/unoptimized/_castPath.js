import isArray2 from "../unoptimized/isArray.js";
import isKey2 from "../unoptimized/_isKey.js";
import stringToPath2 from "../unoptimized/_stringToPath.js";
import toString2 from "../unoptimized/toString.js";
function castPath(value, object) {
  if (isArray2(value)) {
    return value;
  }
  return isKey2(value, object) ? [value] : stringToPath2(toString2(value));
}
var __VIRTUAL_FILE = castPath;
export default __VIRTUAL_FILE;
