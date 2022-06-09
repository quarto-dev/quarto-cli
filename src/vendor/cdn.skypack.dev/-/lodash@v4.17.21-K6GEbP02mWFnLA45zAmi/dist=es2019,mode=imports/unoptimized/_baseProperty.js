function baseProperty(key) {
  return function(object) {
    return object == null ? void 0 : object[key];
  };
}
var __VIRTUAL_FILE = baseProperty;
export default __VIRTUAL_FILE;
