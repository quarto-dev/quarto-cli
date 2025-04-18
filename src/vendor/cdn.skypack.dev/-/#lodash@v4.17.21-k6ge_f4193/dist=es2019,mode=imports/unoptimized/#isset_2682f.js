import baseIsSet2 from "../unoptimized/_baseIsSet.js";
import baseUnary2 from "../unoptimized/_baseUnary.js";
import nodeUtil2 from "../unoptimized/_nodeUtil.js";
var nodeIsSet = nodeUtil2 && nodeUtil2.isSet;
var isSet = nodeIsSet ? baseUnary2(nodeIsSet) : baseIsSet2;
var __VIRTUAL_FILE = isSet;
export default __VIRTUAL_FILE;
