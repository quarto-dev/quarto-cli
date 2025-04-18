import identity2 from "../unoptimized/identity.js";
function castFunction(value) {
  return typeof value == "function" ? value : identity2;
}
var __VIRTUAL_FILE = castFunction;
export default __VIRTUAL_FILE;
