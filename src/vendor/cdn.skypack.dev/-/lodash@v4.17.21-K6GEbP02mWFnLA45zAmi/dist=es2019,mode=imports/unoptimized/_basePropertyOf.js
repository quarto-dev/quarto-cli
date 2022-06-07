function basePropertyOf(object) {
  return function(key) {
    return object == null ? void 0 : object[key];
  };
}
var __VIRTUAL_FILE = basePropertyOf;
export default __VIRTUAL_FILE;
