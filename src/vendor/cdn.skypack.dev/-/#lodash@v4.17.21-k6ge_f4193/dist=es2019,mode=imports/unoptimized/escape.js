import escapeHtmlChar2 from "../unoptimized/_escapeHtmlChar.js";
import toString2 from "../unoptimized/toString.js";
var reUnescapedHtml = /[&<>"']/g, reHasUnescapedHtml = RegExp(reUnescapedHtml.source);
function escape(string) {
  string = toString2(string);
  return string && reHasUnescapedHtml.test(string) ? string.replace(reUnescapedHtml, escapeHtmlChar2) : string;
}
var __VIRTUAL_FILE = escape;
export default __VIRTUAL_FILE;
