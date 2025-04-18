import trimmedEndIndex2 from "../unoptimized/_trimmedEndIndex.js";
var reTrimStart = /^\s+/;
function baseTrim(string) {
  return string ? string.slice(0, trimmedEndIndex2(string) + 1).replace(reTrimStart, "") : string;
}
var __VIRTUAL_FILE = baseTrim;
export default __VIRTUAL_FILE;
