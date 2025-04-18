import Uint8Array2 from "../unoptimized/_Uint8Array.js";
function cloneArrayBuffer(arrayBuffer) {
  var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
  new Uint8Array2(result).set(new Uint8Array2(arrayBuffer));
  return result;
}
var __VIRTUAL_FILE = cloneArrayBuffer;
export default __VIRTUAL_FILE;
