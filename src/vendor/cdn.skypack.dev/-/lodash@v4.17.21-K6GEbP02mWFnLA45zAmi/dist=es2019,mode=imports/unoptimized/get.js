import baseGet2 from "../unoptimized/_baseGet.js";
function get(object, path, defaultValue) {
  var result = object == null ? void 0 : baseGet2(object, path);
  return result === void 0 ? defaultValue : result;
}
var __VIRTUAL_FILE = get;
export default __VIRTUAL_FILE;
