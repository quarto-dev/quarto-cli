import baseIsTypedArray2 from "../unoptimized/_baseIsTypedArray.js";
import baseUnary2 from "../unoptimized/_baseUnary.js";
import nodeUtil2 from "../unoptimized/_nodeUtil.js";
var nodeIsTypedArray = nodeUtil2 && nodeUtil2.isTypedArray;
var isTypedArray = nodeIsTypedArray ? baseUnary2(nodeIsTypedArray) : baseIsTypedArray2;
var __VIRTUAL_FILE = isTypedArray;
export default __VIRTUAL_FILE;
