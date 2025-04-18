import baseRandom2 from "../unoptimized/_baseRandom.js";
function shuffleSelf(array, size) {
  var index = -1, length = array.length, lastIndex = length - 1;
  size = size === void 0 ? length : size;
  while (++index < size) {
    var rand = baseRandom2(index, lastIndex), value = array[rand];
    array[rand] = array[index];
    array[index] = value;
  }
  array.length = size;
  return array;
}
var __VIRTUAL_FILE = shuffleSelf;
export default __VIRTUAL_FILE;
