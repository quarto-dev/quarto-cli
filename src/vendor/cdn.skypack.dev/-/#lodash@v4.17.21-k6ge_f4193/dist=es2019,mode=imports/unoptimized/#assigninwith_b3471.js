import copyObject2 from "../unoptimized/_copyObject.js";
import createAssigner2 from "../unoptimized/_createAssigner.js";
import keysIn2 from "../unoptimized/keysIn.js";
var assignInWith = createAssigner2(function(object, source, srcIndex, customizer) {
  copyObject2(source, keysIn2(source), object, customizer);
});
var __VIRTUAL_FILE = assignInWith;
export default __VIRTUAL_FILE;
