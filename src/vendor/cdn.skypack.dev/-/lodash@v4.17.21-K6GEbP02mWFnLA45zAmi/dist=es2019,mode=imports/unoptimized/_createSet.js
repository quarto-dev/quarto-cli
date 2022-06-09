import Set2 from "../unoptimized/_Set.js";
import noop2 from "../unoptimized/noop.js";
import setToArray2 from "../unoptimized/_setToArray.js";
var INFINITY = 1 / 0;
var createSet = !(Set2 && 1 / setToArray2(new Set2([, -0]))[1] == INFINITY) ? noop2 : function(values) {
  return new Set2(values);
};
var __VIRTUAL_FILE = createSet;
export default __VIRTUAL_FILE;
