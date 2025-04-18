import baseGet2 from "../unoptimized/_baseGet.js";
function basePropertyDeep(path) {
  return function(object) {
    return baseGet2(object, path);
  };
}
var __VIRTUAL_FILE = basePropertyDeep;
export default __VIRTUAL_FILE;
