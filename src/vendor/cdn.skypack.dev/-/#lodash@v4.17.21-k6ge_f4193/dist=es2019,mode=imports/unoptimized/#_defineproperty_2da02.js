import getNative2 from "../unoptimized/_getNative.js";
var defineProperty = function() {
  try {
    var func = getNative2(Object, "defineProperty");
    func({}, "", {});
    return func;
  } catch (e) {
  }
}();
var __VIRTUAL_FILE = defineProperty;
export default __VIRTUAL_FILE;
