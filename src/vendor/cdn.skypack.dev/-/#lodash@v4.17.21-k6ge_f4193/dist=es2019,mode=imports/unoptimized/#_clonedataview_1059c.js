import cloneArrayBuffer2 from "../unoptimized/_cloneArrayBuffer.js";
function cloneDataView(dataView, isDeep) {
  var buffer = isDeep ? cloneArrayBuffer2(dataView.buffer) : dataView.buffer;
  return new dataView.constructor(buffer, dataView.byteOffset, dataView.byteLength);
}
var __VIRTUAL_FILE = cloneDataView;
export default __VIRTUAL_FILE;
