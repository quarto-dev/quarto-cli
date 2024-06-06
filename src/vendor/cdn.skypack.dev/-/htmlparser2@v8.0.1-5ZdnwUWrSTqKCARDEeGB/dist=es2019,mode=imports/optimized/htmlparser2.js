import {P as Parser} from "./common/Parser-5b65a52d.js";
export {P as Parser, T as Tokenizer} from "./common/Parser-5b65a52d.js";
import {DomHandler} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
export {DomHandler as DefaultHandler, DomHandler} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
import * as domelementtype from "/-/domelementtype@v2.3.0-PrmNUNoEHMqortEMiiky/dist=es2019,mode=imports/optimized/domelementtype.js";
export {domelementtype as ElementType};
import {getFeed} from "/-/domutils@v3.0.1-AxLWD9jG78wB01z8Pizf/dist=es2019,mode=imports/optimized/domutils.js";
import * as domutils2 from "/-/domutils@v3.0.1-AxLWD9jG78wB01z8Pizf/dist=es2019,mode=imports/optimized/domutils.js";
export {domutils2 as DomUtils};
export {getFeed} from "/-/domutils@v3.0.1-AxLWD9jG78wB01z8Pizf/dist=es2019,mode=imports/optimized/domutils.js";
import "/-/entities@v4.3.0-V4vIlnoYfSBRg1gj9BOL/dist=es2019,mode=imports/optimized/entities/lib/decode.js";
function parseDocument(data, options) {
  const handler = new DomHandler(void 0, options);
  new Parser(handler, options).end(data);
  return handler.root;
}
function parseDOM(data, options) {
  return parseDocument(data, options).children;
}
function createDomStream(cb, options, elementCb) {
  const handler = new DomHandler(cb, options, elementCb);
  return new Parser(handler, options);
}
function parseFeed(feed, options = {xmlMode: true}) {
  return getFeed(parseDOM(feed, options));
}
export {createDomStream, parseDOM, parseDocument, parseFeed};
export default null;
