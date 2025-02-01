import {cloneNode, Document} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
export {isTag} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
function isCheerio(maybeCheerio) {
  return maybeCheerio.cheerio != null;
}
function camelCase(str) {
  return str.replace(/[_.-](\w|$)/g, (_, x) => x.toUpperCase());
}
function cssCase(str) {
  return str.replace(/[A-Z]/g, "-$&").toLowerCase();
}
function domEach(array, fn) {
  const len = array.length;
  for (let i = 0; i < len; i++)
    fn(array[i], i);
  return array;
}
function cloneDom(dom) {
  const clone = "length" in dom ? Array.prototype.map.call(dom, (el) => cloneNode(el, true)) : [cloneNode(dom, true)];
  const root = new Document(clone);
  clone.forEach((node) => {
    node.parent = root;
  });
  return clone;
}
var CharacterCodes;
(function(CharacterCodes2) {
  CharacterCodes2[CharacterCodes2["LowerA"] = 97] = "LowerA";
  CharacterCodes2[CharacterCodes2["LowerZ"] = 122] = "LowerZ";
  CharacterCodes2[CharacterCodes2["UpperA"] = 65] = "UpperA";
  CharacterCodes2[CharacterCodes2["UpperZ"] = 90] = "UpperZ";
  CharacterCodes2[CharacterCodes2["Exclamation"] = 33] = "Exclamation";
})(CharacterCodes || (CharacterCodes = {}));
function isHtml(str) {
  const tagStart = str.indexOf("<");
  if (tagStart < 0 || tagStart > str.length - 3)
    return false;
  const tagChar = str.charCodeAt(tagStart + 1);
  return (tagChar >= CharacterCodes.LowerA && tagChar <= CharacterCodes.LowerZ || tagChar >= CharacterCodes.UpperA && tagChar <= CharacterCodes.UpperZ || tagChar === CharacterCodes.Exclamation) && str.includes(">", tagStart + 2);
}
export {camelCase, cloneDom, cssCase, domEach, isCheerio, isHtml};
export default null;
