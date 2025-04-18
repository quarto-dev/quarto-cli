import baseIsMap2 from "../unoptimized/_baseIsMap.js";
import baseUnary2 from "../unoptimized/_baseUnary.js";
import nodeUtil2 from "../unoptimized/_nodeUtil.js";
var nodeIsMap = nodeUtil2 && nodeUtil2.isMap;
var isMap = nodeIsMap ? baseUnary2(nodeIsMap) : baseIsMap2;
var __VIRTUAL_FILE = isMap;
export default __VIRTUAL_FILE;
