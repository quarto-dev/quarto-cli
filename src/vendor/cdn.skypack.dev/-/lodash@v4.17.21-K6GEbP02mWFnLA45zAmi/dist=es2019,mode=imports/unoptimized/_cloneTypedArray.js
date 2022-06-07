import cloneArrayBuffer2 from "../unoptimized/_cloneArrayBuffer.js";
function cloneTypedArray(typedArray, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer2(typedArray.buffer) : typedArray.buffer;
  return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
}
var __VIRTUAL_FILE = cloneTypedArray;
export default __VIRTUAL_FILE;
