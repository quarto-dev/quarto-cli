import freeGlobal2 from "../unoptimized/_freeGlobal.js";
var freeSelf = typeof self == "object" && self && self.Object === Object && self;
var root = freeGlobal2 || freeSelf || Function("return this")();
var __VIRTUAL_FILE = root;
export default __VIRTUAL_FILE;
