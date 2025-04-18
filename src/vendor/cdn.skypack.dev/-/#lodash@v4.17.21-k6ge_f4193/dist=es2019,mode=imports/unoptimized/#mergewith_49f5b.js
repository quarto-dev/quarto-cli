import baseMerge2 from "../unoptimized/_baseMerge.js";
import createAssigner2 from "../unoptimized/_createAssigner.js";
var mergeWith = createAssigner2(function(object, source, srcIndex, customizer) {
  baseMerge2(object, source, srcIndex, customizer);
});
var __VIRTUAL_FILE = mergeWith;
export default __VIRTUAL_FILE;
