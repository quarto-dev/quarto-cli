import {g as getLoad, s as staticMethods, a as getParse} from "./common/load-4922a70c.js";
export {h as html, t as text, x as xml} from "./common/load-4922a70c.js";
import {isDocument} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
import {parse as parse$1, parseFragment, serializeOuter} from "/-/parse5@v7.0.0-4AUKIZfwEPUbwYAbyTrt/dist=es2019,mode=imports/optimized/parse5.js";
import {adapter} from "/-/parse5-htmlparser2-tree-adapter@v7.0.0-Yds3pDou8tm4yIHAlVGV/dist=es2019,mode=imports/optimized/parse5-htmlparser2-tree-adapter.js";
import renderWithHtmlparser2 from "/-/dom-serializer@v2.0.0-0QgVINP0DwZRFE7238Nk/dist=es2019,mode=imports/optimized/dom-serializer.js";
import {parseDocument} from "/-/htmlparser2@v8.0.1-5ZdnwUWrSTqKCARDEeGB/dist=es2019,mode=imports/optimized/htmlparser2.js";
import "/-/domutils@v3.0.1-AxLWD9jG78wB01z8Pizf/dist=es2019,mode=imports/optimized/domutils.js";
import "./cheerio/lib/utils.js";
import "/-/cheerio-select@v2.1.0-3jQ9aaXMWR0anNb0rdBs/dist=es2019,mode=imports/optimized/cheerio-select.js";
function parseWithParse5(content, options, isDocument2, context) {
  const opts = {
    scriptingEnabled: typeof options.scriptingEnabled === "boolean" ? options.scriptingEnabled : true,
    treeAdapter: adapter,
    sourceCodeLocationInfo: options.sourceCodeLocationInfo
  };
  return isDocument2 ? parse$1(content, opts) : parseFragment(context, content, opts);
}
const renderOpts = {treeAdapter: adapter};
function renderWithParse5(dom) {
  const nodes = "length" in dom ? dom : [dom];
  for (let index2 = 0; index2 < nodes.length; index2 += 1) {
    const node = nodes[index2];
    if (isDocument(node)) {
      Array.prototype.splice.call(nodes, index2, 1, ...node.children);
    }
  }
  let result = "";
  for (let index2 = 0; index2 < nodes.length; index2 += 1) {
    const node = nodes[index2];
    result += serializeOuter(node, renderOpts);
  }
  return result;
}
const parse = getParse((content, options, isDocument2, context) => options.xmlMode || options._useHtmlParser2 ? parseDocument(content, options) : parseWithParse5(content, options, isDocument2, context));
const load = getLoad(parse, (dom, options) => options.xmlMode || options._useHtmlParser2 ? renderWithHtmlparser2(dom, options) : renderWithParse5(dom));
var index = load([]);
const {contains} = staticMethods;
const {merge} = staticMethods;
const {parseHTML} = staticMethods;
const {root} = staticMethods;
export default index;
export {contains, load, merge, parseHTML, root};
