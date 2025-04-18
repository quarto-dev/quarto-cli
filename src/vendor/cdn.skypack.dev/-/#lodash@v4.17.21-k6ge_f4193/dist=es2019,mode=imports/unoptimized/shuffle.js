import arrayShuffle2 from "../unoptimized/_arrayShuffle.js";
import baseShuffle2 from "../unoptimized/_baseShuffle.js";
import isArray2 from "../unoptimized/isArray.js";
function shuffle(collection) {
  var func = isArray2(collection) ? arrayShuffle2 : baseShuffle2;
  return func(collection);
}
var __VIRTUAL_FILE = shuffle;
export default __VIRTUAL_FILE;
