import {textContent, innerText, uniqueSort, nextElementSibling, prevElementSibling, getSiblings, getChildren, removeElement} from "/-/domutils@v3.0.1-AxLWD9jG78wB01z8Pizf/dist=es2019,mode=imports/optimized/domutils.js";
import {domEach, camelCase, cssCase, isCheerio, cloneDom, isHtml} from "../cheerio/lib/utils.js";
import {isTag, isDocument, hasChildren, Document, Text} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
import {select, filter as filter$1, is as is$1, some} from "/-/cheerio-select@v2.1.0-3jQ9aaXMWR0anNb0rdBs/dist=es2019,mode=imports/optimized/cheerio-select.js";
const defaultOpts = {
  xml: false,
  decodeEntities: true
};
const xmlModeDefault = {
  _useHtmlParser2: true,
  xmlMode: true
};
function flatten(options) {
  return (options === null || options === void 0 ? void 0 : options.xml) ? typeof options.xml === "boolean" ? xmlModeDefault : {...xmlModeDefault, ...options.xml} : options !== null && options !== void 0 ? options : void 0;
}
function render(that, dom, options) {
  if (!that)
    return "";
  return that(dom !== null && dom !== void 0 ? dom : that._root.children, null, void 0, options).toString();
}
function isOptions(dom, options) {
  return !options && typeof dom === "object" && dom != null && !("length" in dom) && !("type" in dom);
}
function html(dom, options) {
  const toRender = isOptions(dom) ? (options = dom, void 0) : dom;
  const opts = {
    ...defaultOpts,
    ...this === null || this === void 0 ? void 0 : this._options,
    ...flatten(options !== null && options !== void 0 ? options : {})
  };
  return render(this, toRender, opts);
}
function xml(dom) {
  const options = {...this._options, xmlMode: true};
  return render(this, dom, options);
}
function text(elements) {
  const elems = elements ? elements : this ? this.root() : [];
  let ret = "";
  for (let i = 0; i < elems.length; i++) {
    ret += textContent(elems[i]);
  }
  return ret;
}
function parseHTML(data2, context, keepScripts = typeof context === "boolean" ? context : false) {
  if (!data2 || typeof data2 !== "string") {
    return null;
  }
  if (typeof context === "boolean") {
    keepScripts = context;
  }
  const parsed = this.load(data2, defaultOpts, false);
  if (!keepScripts) {
    parsed("script").remove();
  }
  return parsed.root()[0].children.slice();
}
function root() {
  return this(this._root);
}
function contains(container, contained) {
  if (contained === container) {
    return false;
  }
  let next2 = contained;
  while (next2 && next2 !== next2.parent) {
    next2 = next2.parent;
    if (next2 === container) {
      return true;
    }
  }
  return false;
}
function merge(arr1, arr2) {
  if (!isArrayLike(arr1) || !isArrayLike(arr2)) {
    return;
  }
  let newLength = arr1.length;
  const len = +arr2.length;
  for (let i = 0; i < len; i++) {
    arr1[newLength++] = arr2[i];
  }
  arr1.length = newLength;
  return arr1;
}
function isArrayLike(item) {
  if (Array.isArray(item)) {
    return true;
  }
  if (typeof item !== "object" || !Object.prototype.hasOwnProperty.call(item, "length") || typeof item.length !== "number" || item.length < 0) {
    return false;
  }
  for (let i = 0; i < item.length; i++) {
    if (!(i in item)) {
      return false;
    }
  }
  return true;
}
var staticMethods = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  html,
  xml,
  text,
  parseHTML,
  root,
  contains,
  merge
});
const hasOwn = Object.prototype.hasOwnProperty;
const rspace = /\s+/;
const dataAttrPrefix = "data-";
const primitives = {
  null: null,
  true: true,
  false: false
};
const rboolean = /^(?:autofocus|autoplay|async|checked|controls|defer|disabled|hidden|loop|multiple|open|readonly|required|scoped|selected)$/i;
const rbrace = /^{[^]*}$|^\[[^]*]$/;
function getAttr(elem, name, xmlMode) {
  var _a;
  if (!elem || !isTag(elem))
    return void 0;
  (_a = elem.attribs) !== null && _a !== void 0 ? _a : elem.attribs = {};
  if (!name) {
    return elem.attribs;
  }
  if (hasOwn.call(elem.attribs, name)) {
    return !xmlMode && rboolean.test(name) ? name : elem.attribs[name];
  }
  if (elem.name === "option" && name === "value") {
    return text(elem.children);
  }
  if (elem.name === "input" && (elem.attribs["type"] === "radio" || elem.attribs["type"] === "checkbox") && name === "value") {
    return "on";
  }
  return void 0;
}
function setAttr(el, name, value) {
  if (value === null) {
    removeAttribute(el, name);
  } else {
    el.attribs[name] = `${value}`;
  }
}
function attr(name, value) {
  if (typeof name === "object" || value !== void 0) {
    if (typeof value === "function") {
      if (typeof name !== "string") {
        {
          throw new Error("Bad combination of arguments.");
        }
      }
      return domEach(this, (el, i) => {
        if (isTag(el))
          setAttr(el, name, value.call(el, i, el.attribs[name]));
      });
    }
    return domEach(this, (el) => {
      if (!isTag(el))
        return;
      if (typeof name === "object") {
        Object.keys(name).forEach((objName) => {
          const objValue = name[objName];
          setAttr(el, objName, objValue);
        });
      } else {
        setAttr(el, name, value);
      }
    });
  }
  return arguments.length > 1 ? this : getAttr(this[0], name, this.options.xmlMode);
}
function getProp(el, name, xmlMode) {
  return name in el ? el[name] : !xmlMode && rboolean.test(name) ? getAttr(el, name, false) !== void 0 : getAttr(el, name, xmlMode);
}
function setProp(el, name, value, xmlMode) {
  if (name in el) {
    el[name] = value;
  } else {
    setAttr(el, name, !xmlMode && rboolean.test(name) ? value ? "" : null : `${value}`);
  }
}
function prop(name, value) {
  var _a;
  if (typeof name === "string" && value === void 0) {
    const el = this[0];
    if (!el || !isTag(el))
      return void 0;
    switch (name) {
      case "style": {
        const property = this.css();
        const keys = Object.keys(property);
        keys.forEach((p, i) => {
          property[i] = p;
        });
        property.length = keys.length;
        return property;
      }
      case "tagName":
      case "nodeName": {
        return el.name.toUpperCase();
      }
      case "href":
      case "src": {
        const prop2 = (_a = el.attribs) === null || _a === void 0 ? void 0 : _a[name];
        if (typeof URL !== "undefined" && (name === "href" && (el.tagName === "a" || el.name === "link") || name === "src" && (el.tagName === "img" || el.tagName === "iframe" || el.tagName === "audio" || el.tagName === "video" || el.tagName === "source")) && prop2 !== void 0 && this.options.baseURI) {
          return new URL(prop2, this.options.baseURI).href;
        }
        return prop2;
      }
      case "innerText": {
        return innerText(el);
      }
      case "textContent": {
        return textContent(el);
      }
      case "outerHTML":
        return this.clone().wrap("<container />").parent().html();
      case "innerHTML":
        return this.html();
      default:
        return getProp(el, name, this.options.xmlMode);
    }
  }
  if (typeof name === "object" || value !== void 0) {
    if (typeof value === "function") {
      if (typeof name === "object") {
        throw new Error("Bad combination of arguments.");
      }
      return domEach(this, (el, i) => {
        if (isTag(el)) {
          setProp(el, name, value.call(el, i, getProp(el, name, this.options.xmlMode)), this.options.xmlMode);
        }
      });
    }
    return domEach(this, (el) => {
      if (!isTag(el))
        return;
      if (typeof name === "object") {
        Object.keys(name).forEach((key) => {
          const val2 = name[key];
          setProp(el, key, val2, this.options.xmlMode);
        });
      } else {
        setProp(el, name, value, this.options.xmlMode);
      }
    });
  }
  return void 0;
}
function setData(el, name, value) {
  var _a;
  const elem = el;
  (_a = elem.data) !== null && _a !== void 0 ? _a : elem.data = {};
  if (typeof name === "object")
    Object.assign(elem.data, name);
  else if (typeof name === "string" && value !== void 0) {
    elem.data[name] = value;
  }
}
function readData(el, name) {
  let domNames;
  let jsNames;
  let value;
  if (name == null) {
    domNames = Object.keys(el.attribs).filter((attrName) => attrName.startsWith(dataAttrPrefix));
    jsNames = domNames.map((domName) => camelCase(domName.slice(dataAttrPrefix.length)));
  } else {
    domNames = [dataAttrPrefix + cssCase(name)];
    jsNames = [name];
  }
  for (let idx = 0; idx < domNames.length; ++idx) {
    const domName = domNames[idx];
    const jsName = jsNames[idx];
    if (hasOwn.call(el.attribs, domName) && !hasOwn.call(el.data, jsName)) {
      value = el.attribs[domName];
      if (hasOwn.call(primitives, value)) {
        value = primitives[value];
      } else if (value === String(Number(value))) {
        value = Number(value);
      } else if (rbrace.test(value)) {
        try {
          value = JSON.parse(value);
        } catch (e) {
        }
      }
      el.data[jsName] = value;
    }
  }
  return name == null ? el.data : value;
}
function data(name, value) {
  var _a;
  const elem = this[0];
  if (!elem || !isTag(elem))
    return;
  const dataEl = elem;
  (_a = dataEl.data) !== null && _a !== void 0 ? _a : dataEl.data = {};
  if (!name) {
    return readData(dataEl);
  }
  if (typeof name === "object" || value !== void 0) {
    domEach(this, (el) => {
      if (isTag(el)) {
        if (typeof name === "object")
          setData(el, name);
        else
          setData(el, name, value);
      }
    });
    return this;
  }
  if (hasOwn.call(dataEl.data, name)) {
    return dataEl.data[name];
  }
  return readData(dataEl, name);
}
function val(value) {
  const querying = arguments.length === 0;
  const element = this[0];
  if (!element || !isTag(element))
    return querying ? void 0 : this;
  switch (element.name) {
    case "textarea":
      return this.text(value);
    case "select": {
      const option = this.find("option:selected");
      if (!querying) {
        if (this.attr("multiple") == null && typeof value === "object") {
          return this;
        }
        this.find("option").removeAttr("selected");
        const values = typeof value !== "object" ? [value] : value;
        for (let i = 0; i < values.length; i++) {
          this.find(`option[value="${values[i]}"]`).attr("selected", "");
        }
        return this;
      }
      return this.attr("multiple") ? option.toArray().map((el) => text(el.children)) : option.attr("value");
    }
    case "input":
    case "option":
      return querying ? this.attr("value") : this.attr("value", value);
  }
  return void 0;
}
function removeAttribute(elem, name) {
  if (!elem.attribs || !hasOwn.call(elem.attribs, name))
    return;
  delete elem.attribs[name];
}
function splitNames(names) {
  return names ? names.trim().split(rspace) : [];
}
function removeAttr(name) {
  const attrNames = splitNames(name);
  for (let i = 0; i < attrNames.length; i++) {
    domEach(this, (elem) => {
      if (isTag(elem))
        removeAttribute(elem, attrNames[i]);
    });
  }
  return this;
}
function hasClass(className) {
  return this.toArray().some((elem) => {
    const clazz = isTag(elem) && elem.attribs["class"];
    let idx = -1;
    if (clazz && className.length) {
      while ((idx = clazz.indexOf(className, idx + 1)) > -1) {
        const end2 = idx + className.length;
        if ((idx === 0 || rspace.test(clazz[idx - 1])) && (end2 === clazz.length || rspace.test(clazz[end2]))) {
          return true;
        }
      }
    }
    return false;
  });
}
function addClass(value) {
  if (typeof value === "function") {
    return domEach(this, (el, i) => {
      if (isTag(el)) {
        const className = el.attribs["class"] || "";
        addClass.call([el], value.call(el, i, className));
      }
    });
  }
  if (!value || typeof value !== "string")
    return this;
  const classNames = value.split(rspace);
  const numElements = this.length;
  for (let i = 0; i < numElements; i++) {
    const el = this[i];
    if (!isTag(el))
      continue;
    const className = getAttr(el, "class", false);
    if (!className) {
      setAttr(el, "class", classNames.join(" ").trim());
    } else {
      let setClass = ` ${className} `;
      for (let j = 0; j < classNames.length; j++) {
        const appendClass = `${classNames[j]} `;
        if (!setClass.includes(` ${appendClass}`))
          setClass += appendClass;
      }
      setAttr(el, "class", setClass.trim());
    }
  }
  return this;
}
function removeClass(name) {
  if (typeof name === "function") {
    return domEach(this, (el, i) => {
      if (isTag(el)) {
        removeClass.call([el], name.call(el, i, el.attribs["class"] || ""));
      }
    });
  }
  const classes = splitNames(name);
  const numClasses = classes.length;
  const removeAll = arguments.length === 0;
  return domEach(this, (el) => {
    if (!isTag(el))
      return;
    if (removeAll) {
      el.attribs["class"] = "";
    } else {
      const elClasses = splitNames(el.attribs["class"]);
      let changed = false;
      for (let j = 0; j < numClasses; j++) {
        const index2 = elClasses.indexOf(classes[j]);
        if (index2 >= 0) {
          elClasses.splice(index2, 1);
          changed = true;
          j--;
        }
      }
      if (changed) {
        el.attribs["class"] = elClasses.join(" ");
      }
    }
  });
}
function toggleClass(value, stateVal) {
  if (typeof value === "function") {
    return domEach(this, (el, i) => {
      if (isTag(el)) {
        toggleClass.call([el], value.call(el, i, el.attribs["class"] || "", stateVal), stateVal);
      }
    });
  }
  if (!value || typeof value !== "string")
    return this;
  const classNames = value.split(rspace);
  const numClasses = classNames.length;
  const state = typeof stateVal === "boolean" ? stateVal ? 1 : -1 : 0;
  const numElements = this.length;
  for (let i = 0; i < numElements; i++) {
    const el = this[i];
    if (!isTag(el))
      continue;
    const elementClasses = splitNames(el.attribs["class"]);
    for (let j = 0; j < numClasses; j++) {
      const index2 = elementClasses.indexOf(classNames[j]);
      if (state >= 0 && index2 < 0) {
        elementClasses.push(classNames[j]);
      } else if (state <= 0 && index2 >= 0) {
        elementClasses.splice(index2, 1);
      }
    }
    el.attribs["class"] = elementClasses.join(" ");
  }
  return this;
}
var Attributes = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  attr,
  prop,
  data,
  val,
  removeAttr,
  hasClass,
  addClass,
  removeClass,
  toggleClass
});
const reSiblingSelector = /^\s*[~+]/;
function find(selectorOrHaystack) {
  var _a;
  if (!selectorOrHaystack) {
    return this._make([]);
  }
  const context = this.toArray();
  if (typeof selectorOrHaystack !== "string") {
    const haystack = isCheerio(selectorOrHaystack) ? selectorOrHaystack.toArray() : [selectorOrHaystack];
    return this._make(haystack.filter((elem) => context.some((node) => contains(node, elem))));
  }
  const elems = reSiblingSelector.test(selectorOrHaystack) ? context : this.children().toArray();
  const options = {
    context,
    root: (_a = this._root) === null || _a === void 0 ? void 0 : _a[0],
    xmlMode: this.options.xmlMode,
    lowerCaseTags: this.options.lowerCaseTags,
    lowerCaseAttributeNames: this.options.lowerCaseAttributeNames,
    pseudos: this.options.pseudos,
    quirksMode: this.options.quirksMode
  };
  return this._make(select(selectorOrHaystack, elems, options));
}
function _getMatcher(matchMap) {
  return function(fn, ...postFns) {
    return function(selector) {
      var _a;
      let matched = matchMap(fn, this);
      if (selector) {
        matched = filterArray(matched, selector, this.options.xmlMode, (_a = this._root) === null || _a === void 0 ? void 0 : _a[0]);
      }
      return this._make(this.length > 1 && matched.length > 1 ? postFns.reduce((elems, fn2) => fn2(elems), matched) : matched);
    };
  };
}
const _matcher = _getMatcher((fn, elems) => {
  const ret = [];
  for (let i = 0; i < elems.length; i++) {
    const value = fn(elems[i]);
    ret.push(value);
  }
  return new Array().concat(...ret);
});
const _singleMatcher = _getMatcher((fn, elems) => {
  const ret = [];
  for (let i = 0; i < elems.length; i++) {
    const value = fn(elems[i]);
    if (value !== null) {
      ret.push(value);
    }
  }
  return ret;
});
function _matchUntil(nextElem, ...postFns) {
  let matches = null;
  const innerMatcher = _getMatcher((nextElem2, elems) => {
    const matched = [];
    domEach(elems, (elem) => {
      for (let next2; next2 = nextElem2(elem); elem = next2) {
        if (matches === null || matches === void 0 ? void 0 : matches(next2, matched.length))
          break;
        matched.push(next2);
      }
    });
    return matched;
  })(nextElem, ...postFns);
  return function(selector, filterSelector) {
    matches = typeof selector === "string" ? (elem) => is$1(elem, selector, this.options) : selector ? getFilterFn(selector) : null;
    const ret = innerMatcher.call(this, filterSelector);
    matches = null;
    return ret;
  };
}
function _removeDuplicates(elems) {
  return Array.from(new Set(elems));
}
const parent = _singleMatcher(({parent: parent2}) => parent2 && !isDocument(parent2) ? parent2 : null, _removeDuplicates);
const parents = _matcher((elem) => {
  const matched = [];
  while (elem.parent && !isDocument(elem.parent)) {
    matched.push(elem.parent);
    elem = elem.parent;
  }
  return matched;
}, uniqueSort, (elems) => elems.reverse());
const parentsUntil = _matchUntil(({parent: parent2}) => parent2 && !isDocument(parent2) ? parent2 : null, uniqueSort, (elems) => elems.reverse());
function closest(selector) {
  var _a;
  const set = [];
  if (!selector) {
    return this._make(set);
  }
  const selectOpts = {
    xmlMode: this.options.xmlMode,
    root: (_a = this._root) === null || _a === void 0 ? void 0 : _a[0]
  };
  const selectFn = typeof selector === "string" ? (elem) => is$1(elem, selector, selectOpts) : getFilterFn(selector);
  domEach(this, (elem) => {
    while (elem && isTag(elem)) {
      if (selectFn(elem, 0)) {
        if (!set.includes(elem)) {
          set.push(elem);
        }
        break;
      }
      elem = elem.parent;
    }
  });
  return this._make(set);
}
const next = _singleMatcher((elem) => nextElementSibling(elem));
const nextAll = _matcher((elem) => {
  const matched = [];
  while (elem.next) {
    elem = elem.next;
    if (isTag(elem))
      matched.push(elem);
  }
  return matched;
}, _removeDuplicates);
const nextUntil = _matchUntil((el) => nextElementSibling(el), _removeDuplicates);
const prev = _singleMatcher((elem) => prevElementSibling(elem));
const prevAll = _matcher((elem) => {
  const matched = [];
  while (elem.prev) {
    elem = elem.prev;
    if (isTag(elem))
      matched.push(elem);
  }
  return matched;
}, _removeDuplicates);
const prevUntil = _matchUntil((el) => prevElementSibling(el), _removeDuplicates);
const siblings = _matcher((elem) => getSiblings(elem).filter((el) => isTag(el) && el !== elem), uniqueSort);
const children = _matcher((elem) => getChildren(elem).filter(isTag), _removeDuplicates);
function contents() {
  const elems = this.toArray().reduce((newElems, elem) => hasChildren(elem) ? newElems.concat(elem.children) : newElems, []);
  return this._make(elems);
}
function each(fn) {
  let i = 0;
  const len = this.length;
  while (i < len && fn.call(this[i], i, this[i]) !== false)
    ++i;
  return this;
}
function map(fn) {
  let elems = [];
  for (let i = 0; i < this.length; i++) {
    const el = this[i];
    const val2 = fn.call(el, i, el);
    if (val2 != null) {
      elems = elems.concat(val2);
    }
  }
  return this._make(elems);
}
function getFilterFn(match) {
  if (typeof match === "function") {
    return (el, i) => match.call(el, i, el);
  }
  if (isCheerio(match)) {
    return (el) => Array.prototype.includes.call(match, el);
  }
  return function(el) {
    return match === el;
  };
}
function filter(match) {
  var _a;
  return this._make(filterArray(this.toArray(), match, this.options.xmlMode, (_a = this._root) === null || _a === void 0 ? void 0 : _a[0]));
}
function filterArray(nodes, match, xmlMode, root2) {
  return typeof match === "string" ? filter$1(match, nodes, {xmlMode, root: root2}) : nodes.filter(getFilterFn(match));
}
function is(selector) {
  const nodes = this.toArray();
  return typeof selector === "string" ? some(nodes.filter(isTag), selector, this.options) : selector ? nodes.some(getFilterFn(selector)) : false;
}
function not(match) {
  let nodes = this.toArray();
  if (typeof match === "string") {
    const matches = new Set(filter$1(match, nodes, this.options));
    nodes = nodes.filter((el) => !matches.has(el));
  } else {
    const filterFn = getFilterFn(match);
    nodes = nodes.filter((el, i) => !filterFn(el, i));
  }
  return this._make(nodes);
}
function has(selectorOrHaystack) {
  return this.filter(typeof selectorOrHaystack === "string" ? `:has(${selectorOrHaystack})` : (_, el) => this._make(el).find(selectorOrHaystack).length > 0);
}
function first() {
  return this.length > 1 ? this._make(this[0]) : this;
}
function last() {
  return this.length > 0 ? this._make(this[this.length - 1]) : this;
}
function eq(i) {
  var _a;
  i = +i;
  if (i === 0 && this.length <= 1)
    return this;
  if (i < 0)
    i = this.length + i;
  return this._make((_a = this[i]) !== null && _a !== void 0 ? _a : []);
}
function get(i) {
  if (i == null) {
    return this.toArray();
  }
  return this[i < 0 ? this.length + i : i];
}
function toArray() {
  return Array.prototype.slice.call(this);
}
function index(selectorOrNeedle) {
  let $haystack;
  let needle;
  if (selectorOrNeedle == null) {
    $haystack = this.parent().children();
    needle = this[0];
  } else if (typeof selectorOrNeedle === "string") {
    $haystack = this._make(selectorOrNeedle);
    needle = this[0];
  } else {
    $haystack = this;
    needle = isCheerio(selectorOrNeedle) ? selectorOrNeedle[0] : selectorOrNeedle;
  }
  return Array.prototype.indexOf.call($haystack, needle);
}
function slice(start, end2) {
  return this._make(Array.prototype.slice.call(this, start, end2));
}
function end() {
  var _a;
  return (_a = this.prevObject) !== null && _a !== void 0 ? _a : this._make([]);
}
function add(other, context) {
  const selection = this._make(other, context);
  const contents2 = uniqueSort([...this.get(), ...selection.get()]);
  return this._make(contents2);
}
function addBack(selector) {
  return this.prevObject ? this.add(selector ? this.prevObject.filter(selector) : this.prevObject) : this;
}
var Traversing = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  find,
  parent,
  parents,
  parentsUntil,
  closest,
  next,
  nextAll,
  nextUntil,
  prev,
  prevAll,
  prevUntil,
  siblings,
  children,
  contents,
  each,
  map,
  filter,
  filterArray,
  is,
  not,
  has,
  first,
  last,
  eq,
  get,
  toArray,
  index,
  slice,
  end,
  add,
  addBack
});
var global$1 = typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};
var lookup = [];
var revLookup = [];
var Arr = typeof Uint8Array !== "undefined" ? Uint8Array : Array;
var inited = false;
function init() {
  inited = true;
  var code = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (var i = 0, len = code.length; i < len; ++i) {
    lookup[i] = code[i];
    revLookup[code.charCodeAt(i)] = i;
  }
  revLookup["-".charCodeAt(0)] = 62;
  revLookup["_".charCodeAt(0)] = 63;
}
function toByteArray(b64) {
  if (!inited) {
    init();
  }
  var i, j, l, tmp, placeHolders, arr;
  var len = b64.length;
  if (len % 4 > 0) {
    throw new Error("Invalid string. Length must be a multiple of 4");
  }
  placeHolders = b64[len - 2] === "=" ? 2 : b64[len - 1] === "=" ? 1 : 0;
  arr = new Arr(len * 3 / 4 - placeHolders);
  l = placeHolders > 0 ? len - 4 : len;
  var L = 0;
  for (i = 0, j = 0; i < l; i += 4, j += 3) {
    tmp = revLookup[b64.charCodeAt(i)] << 18 | revLookup[b64.charCodeAt(i + 1)] << 12 | revLookup[b64.charCodeAt(i + 2)] << 6 | revLookup[b64.charCodeAt(i + 3)];
    arr[L++] = tmp >> 16 & 255;
    arr[L++] = tmp >> 8 & 255;
    arr[L++] = tmp & 255;
  }
  if (placeHolders === 2) {
    tmp = revLookup[b64.charCodeAt(i)] << 2 | revLookup[b64.charCodeAt(i + 1)] >> 4;
    arr[L++] = tmp & 255;
  } else if (placeHolders === 1) {
    tmp = revLookup[b64.charCodeAt(i)] << 10 | revLookup[b64.charCodeAt(i + 1)] << 4 | revLookup[b64.charCodeAt(i + 2)] >> 2;
    arr[L++] = tmp >> 8 & 255;
    arr[L++] = tmp & 255;
  }
  return arr;
}
function tripletToBase64(num) {
  return lookup[num >> 18 & 63] + lookup[num >> 12 & 63] + lookup[num >> 6 & 63] + lookup[num & 63];
}
function encodeChunk(uint8, start, end2) {
  var tmp;
  var output = [];
  for (var i = start; i < end2; i += 3) {
    tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + uint8[i + 2];
    output.push(tripletToBase64(tmp));
  }
  return output.join("");
}
function fromByteArray(uint8) {
  if (!inited) {
    init();
  }
  var tmp;
  var len = uint8.length;
  var extraBytes = len % 3;
  var output = "";
  var parts = [];
  var maxChunkLength = 16383;
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, i + maxChunkLength > len2 ? len2 : i + maxChunkLength));
  }
  if (extraBytes === 1) {
    tmp = uint8[len - 1];
    output += lookup[tmp >> 2];
    output += lookup[tmp << 4 & 63];
    output += "==";
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1];
    output += lookup[tmp >> 10];
    output += lookup[tmp >> 4 & 63];
    output += lookup[tmp << 2 & 63];
    output += "=";
  }
  parts.push(output);
  return parts.join("");
}
function read(buffer, offset, isLE, mLen, nBytes) {
  var e, m;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var nBits = -7;
  var i = isLE ? nBytes - 1 : 0;
  var d = isLE ? -1 : 1;
  var s = buffer[offset + i];
  i += d;
  e = s & (1 << -nBits) - 1;
  s >>= -nBits;
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  m = e & (1 << -nBits) - 1;
  e >>= -nBits;
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {
  }
  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : (s ? -1 : 1) * Infinity;
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
}
function write(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c;
  var eLen = nBytes * 8 - mLen - 1;
  var eMax = (1 << eLen) - 1;
  var eBias = eMax >> 1;
  var rt = mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0;
  var i = isLE ? 0 : nBytes - 1;
  var d = isLE ? 1 : -1;
  var s = value < 0 || value === 0 && 1 / value < 0 ? 1 : 0;
  value = Math.abs(value);
  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }
    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }
  for (; mLen >= 8; buffer[offset + i] = m & 255, i += d, m /= 256, mLen -= 8) {
  }
  e = e << mLen | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 255, i += d, e /= 256, eLen -= 8) {
  }
  buffer[offset + i - d] |= s * 128;
}
var toString = {}.toString;
var isArray = Array.isArray || function(arr) {
  return toString.call(arr) == "[object Array]";
};
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */
var INSPECT_MAX_BYTES = 50;
Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== void 0 ? global$1.TYPED_ARRAY_SUPPORT : true;
function kMaxLength() {
  return Buffer.TYPED_ARRAY_SUPPORT ? 2147483647 : 1073741823;
}
function createBuffer(that, length) {
  if (kMaxLength() < length) {
    throw new RangeError("Invalid typed array length");
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    that = new Uint8Array(length);
    that.__proto__ = Buffer.prototype;
  } else {
    if (that === null) {
      that = new Buffer(length);
    }
    that.length = length;
  }
  return that;
}
function Buffer(arg, encodingOrOffset, length) {
  if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
    return new Buffer(arg, encodingOrOffset, length);
  }
  if (typeof arg === "number") {
    if (typeof encodingOrOffset === "string") {
      throw new Error("If encoding is specified then the first argument must be a string");
    }
    return allocUnsafe(this, arg);
  }
  return from(this, arg, encodingOrOffset, length);
}
Buffer.poolSize = 8192;
Buffer._augment = function(arr) {
  arr.__proto__ = Buffer.prototype;
  return arr;
};
function from(that, value, encodingOrOffset, length) {
  if (typeof value === "number") {
    throw new TypeError('"value" argument must not be a number');
  }
  if (typeof ArrayBuffer !== "undefined" && value instanceof ArrayBuffer) {
    return fromArrayBuffer(that, value, encodingOrOffset, length);
  }
  if (typeof value === "string") {
    return fromString(that, value, encodingOrOffset);
  }
  return fromObject(that, value);
}
Buffer.from = function(value, encodingOrOffset, length) {
  return from(null, value, encodingOrOffset, length);
};
if (Buffer.TYPED_ARRAY_SUPPORT) {
  Buffer.prototype.__proto__ = Uint8Array.prototype;
  Buffer.__proto__ = Uint8Array;
}
function assertSize(size) {
  if (typeof size !== "number") {
    throw new TypeError('"size" argument must be a number');
  } else if (size < 0) {
    throw new RangeError('"size" argument must not be negative');
  }
}
function alloc(that, size, fill2, encoding) {
  assertSize(size);
  if (size <= 0) {
    return createBuffer(that, size);
  }
  if (fill2 !== void 0) {
    return typeof encoding === "string" ? createBuffer(that, size).fill(fill2, encoding) : createBuffer(that, size).fill(fill2);
  }
  return createBuffer(that, size);
}
Buffer.alloc = function(size, fill2, encoding) {
  return alloc(null, size, fill2, encoding);
};
function allocUnsafe(that, size) {
  assertSize(size);
  that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < size; ++i) {
      that[i] = 0;
    }
  }
  return that;
}
Buffer.allocUnsafe = function(size) {
  return allocUnsafe(null, size);
};
Buffer.allocUnsafeSlow = function(size) {
  return allocUnsafe(null, size);
};
function fromString(that, string, encoding) {
  if (typeof encoding !== "string" || encoding === "") {
    encoding = "utf8";
  }
  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('"encoding" must be a valid string encoding');
  }
  var length = byteLength(string, encoding) | 0;
  that = createBuffer(that, length);
  var actual = that.write(string, encoding);
  if (actual !== length) {
    that = that.slice(0, actual);
  }
  return that;
}
function fromArrayLike(that, array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0;
  that = createBuffer(that, length);
  for (var i = 0; i < length; i += 1) {
    that[i] = array[i] & 255;
  }
  return that;
}
function fromArrayBuffer(that, array, byteOffset, length) {
  array.byteLength;
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError("'offset' is out of bounds");
  }
  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError("'length' is out of bounds");
  }
  if (byteOffset === void 0 && length === void 0) {
    array = new Uint8Array(array);
  } else if (length === void 0) {
    array = new Uint8Array(array, byteOffset);
  } else {
    array = new Uint8Array(array, byteOffset, length);
  }
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    that = array;
    that.__proto__ = Buffer.prototype;
  } else {
    that = fromArrayLike(that, array);
  }
  return that;
}
function fromObject(that, obj) {
  if (internalIsBuffer(obj)) {
    var len = checked(obj.length) | 0;
    that = createBuffer(that, len);
    if (that.length === 0) {
      return that;
    }
    obj.copy(that, 0, 0, len);
    return that;
  }
  if (obj) {
    if (typeof ArrayBuffer !== "undefined" && obj.buffer instanceof ArrayBuffer || "length" in obj) {
      if (typeof obj.length !== "number" || isnan(obj.length)) {
        return createBuffer(that, 0);
      }
      return fromArrayLike(that, obj);
    }
    if (obj.type === "Buffer" && isArray(obj.data)) {
      return fromArrayLike(that, obj.data);
    }
  }
  throw new TypeError("First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.");
}
function checked(length) {
  if (length >= kMaxLength()) {
    throw new RangeError("Attempt to allocate Buffer larger than maximum size: 0x" + kMaxLength().toString(16) + " bytes");
  }
  return length | 0;
}
Buffer.isBuffer = isBuffer;
function internalIsBuffer(b) {
  return !!(b != null && b._isBuffer);
}
Buffer.compare = function compare(a, b) {
  if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
    throw new TypeError("Arguments must be Buffers");
  }
  if (a === b)
    return 0;
  var x = a.length;
  var y = b.length;
  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i];
      y = b[i];
      break;
    }
  }
  if (x < y)
    return -1;
  if (y < x)
    return 1;
  return 0;
};
Buffer.isEncoding = function isEncoding(encoding) {
  switch (String(encoding).toLowerCase()) {
    case "hex":
    case "utf8":
    case "utf-8":
    case "ascii":
    case "latin1":
    case "binary":
    case "base64":
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return true;
    default:
      return false;
  }
};
Buffer.concat = function concat(list, length) {
  if (!isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers');
  }
  if (list.length === 0) {
    return Buffer.alloc(0);
  }
  var i;
  if (length === void 0) {
    length = 0;
    for (i = 0; i < list.length; ++i) {
      length += list[i].length;
    }
  }
  var buffer = Buffer.allocUnsafe(length);
  var pos = 0;
  for (i = 0; i < list.length; ++i) {
    var buf = list[i];
    if (!internalIsBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers');
    }
    buf.copy(buffer, pos);
    pos += buf.length;
  }
  return buffer;
};
function byteLength(string, encoding) {
  if (internalIsBuffer(string)) {
    return string.length;
  }
  if (typeof ArrayBuffer !== "undefined" && typeof ArrayBuffer.isView === "function" && (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
    return string.byteLength;
  }
  if (typeof string !== "string") {
    string = "" + string;
  }
  var len = string.length;
  if (len === 0)
    return 0;
  var loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "ascii":
      case "latin1":
      case "binary":
        return len;
      case "utf8":
      case "utf-8":
      case void 0:
        return utf8ToBytes(string).length;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return len * 2;
      case "hex":
        return len >>> 1;
      case "base64":
        return base64ToBytes(string).length;
      default:
        if (loweredCase)
          return utf8ToBytes(string).length;
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.byteLength = byteLength;
function slowToString(encoding, start, end2) {
  var loweredCase = false;
  if (start === void 0 || start < 0) {
    start = 0;
  }
  if (start > this.length) {
    return "";
  }
  if (end2 === void 0 || end2 > this.length) {
    end2 = this.length;
  }
  if (end2 <= 0) {
    return "";
  }
  end2 >>>= 0;
  start >>>= 0;
  if (end2 <= start) {
    return "";
  }
  if (!encoding)
    encoding = "utf8";
  while (true) {
    switch (encoding) {
      case "hex":
        return hexSlice(this, start, end2);
      case "utf8":
      case "utf-8":
        return utf8Slice(this, start, end2);
      case "ascii":
        return asciiSlice(this, start, end2);
      case "latin1":
      case "binary":
        return latin1Slice(this, start, end2);
      case "base64":
        return base64Slice(this, start, end2);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16leSlice(this, start, end2);
      default:
        if (loweredCase)
          throw new TypeError("Unknown encoding: " + encoding);
        encoding = (encoding + "").toLowerCase();
        loweredCase = true;
    }
  }
}
Buffer.prototype._isBuffer = true;
function swap(b, n, m) {
  var i = b[n];
  b[n] = b[m];
  b[m] = i;
}
Buffer.prototype.swap16 = function swap16() {
  var len = this.length;
  if (len % 2 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 16-bits");
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1);
  }
  return this;
};
Buffer.prototype.swap32 = function swap32() {
  var len = this.length;
  if (len % 4 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 32-bits");
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3);
    swap(this, i + 1, i + 2);
  }
  return this;
};
Buffer.prototype.swap64 = function swap64() {
  var len = this.length;
  if (len % 8 !== 0) {
    throw new RangeError("Buffer size must be a multiple of 64-bits");
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7);
    swap(this, i + 1, i + 6);
    swap(this, i + 2, i + 5);
    swap(this, i + 3, i + 4);
  }
  return this;
};
Buffer.prototype.toString = function toString2() {
  var length = this.length | 0;
  if (length === 0)
    return "";
  if (arguments.length === 0)
    return utf8Slice(this, 0, length);
  return slowToString.apply(this, arguments);
};
Buffer.prototype.equals = function equals(b) {
  if (!internalIsBuffer(b))
    throw new TypeError("Argument must be a Buffer");
  if (this === b)
    return true;
  return Buffer.compare(this, b) === 0;
};
Buffer.prototype.inspect = function inspect() {
  var str = "";
  var max = INSPECT_MAX_BYTES;
  if (this.length > 0) {
    str = this.toString("hex", 0, max).match(/.{2}/g).join(" ");
    if (this.length > max)
      str += " ... ";
  }
  return "<Buffer " + str + ">";
};
Buffer.prototype.compare = function compare2(target, start, end2, thisStart, thisEnd) {
  if (!internalIsBuffer(target)) {
    throw new TypeError("Argument must be a Buffer");
  }
  if (start === void 0) {
    start = 0;
  }
  if (end2 === void 0) {
    end2 = target ? target.length : 0;
  }
  if (thisStart === void 0) {
    thisStart = 0;
  }
  if (thisEnd === void 0) {
    thisEnd = this.length;
  }
  if (start < 0 || end2 > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError("out of range index");
  }
  if (thisStart >= thisEnd && start >= end2) {
    return 0;
  }
  if (thisStart >= thisEnd) {
    return -1;
  }
  if (start >= end2) {
    return 1;
  }
  start >>>= 0;
  end2 >>>= 0;
  thisStart >>>= 0;
  thisEnd >>>= 0;
  if (this === target)
    return 0;
  var x = thisEnd - thisStart;
  var y = end2 - start;
  var len = Math.min(x, y);
  var thisCopy = this.slice(thisStart, thisEnd);
  var targetCopy = target.slice(start, end2);
  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i];
      y = targetCopy[i];
      break;
    }
  }
  if (x < y)
    return -1;
  if (y < x)
    return 1;
  return 0;
};
function bidirectionalIndexOf(buffer, val2, byteOffset, encoding, dir) {
  if (buffer.length === 0)
    return -1;
  if (typeof byteOffset === "string") {
    encoding = byteOffset;
    byteOffset = 0;
  } else if (byteOffset > 2147483647) {
    byteOffset = 2147483647;
  } else if (byteOffset < -2147483648) {
    byteOffset = -2147483648;
  }
  byteOffset = +byteOffset;
  if (isNaN(byteOffset)) {
    byteOffset = dir ? 0 : buffer.length - 1;
  }
  if (byteOffset < 0)
    byteOffset = buffer.length + byteOffset;
  if (byteOffset >= buffer.length) {
    if (dir)
      return -1;
    else
      byteOffset = buffer.length - 1;
  } else if (byteOffset < 0) {
    if (dir)
      byteOffset = 0;
    else
      return -1;
  }
  if (typeof val2 === "string") {
    val2 = Buffer.from(val2, encoding);
  }
  if (internalIsBuffer(val2)) {
    if (val2.length === 0) {
      return -1;
    }
    return arrayIndexOf(buffer, val2, byteOffset, encoding, dir);
  } else if (typeof val2 === "number") {
    val2 = val2 & 255;
    if (Buffer.TYPED_ARRAY_SUPPORT && typeof Uint8Array.prototype.indexOf === "function") {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val2, byteOffset);
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val2, byteOffset);
      }
    }
    return arrayIndexOf(buffer, [val2], byteOffset, encoding, dir);
  }
  throw new TypeError("val must be string, number or Buffer");
}
function arrayIndexOf(arr, val2, byteOffset, encoding, dir) {
  var indexSize = 1;
  var arrLength = arr.length;
  var valLength = val2.length;
  if (encoding !== void 0) {
    encoding = String(encoding).toLowerCase();
    if (encoding === "ucs2" || encoding === "ucs-2" || encoding === "utf16le" || encoding === "utf-16le") {
      if (arr.length < 2 || val2.length < 2) {
        return -1;
      }
      indexSize = 2;
      arrLength /= 2;
      valLength /= 2;
      byteOffset /= 2;
    }
  }
  function read2(buf, i2) {
    if (indexSize === 1) {
      return buf[i2];
    } else {
      return buf.readUInt16BE(i2 * indexSize);
    }
  }
  var i;
  if (dir) {
    var foundIndex = -1;
    for (i = byteOffset; i < arrLength; i++) {
      if (read2(arr, i) === read2(val2, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1)
          foundIndex = i;
        if (i - foundIndex + 1 === valLength)
          return foundIndex * indexSize;
      } else {
        if (foundIndex !== -1)
          i -= i - foundIndex;
        foundIndex = -1;
      }
    }
  } else {
    if (byteOffset + valLength > arrLength)
      byteOffset = arrLength - valLength;
    for (i = byteOffset; i >= 0; i--) {
      var found = true;
      for (var j = 0; j < valLength; j++) {
        if (read2(arr, i + j) !== read2(val2, j)) {
          found = false;
          break;
        }
      }
      if (found)
        return i;
    }
  }
  return -1;
}
Buffer.prototype.includes = function includes(val2, byteOffset, encoding) {
  return this.indexOf(val2, byteOffset, encoding) !== -1;
};
Buffer.prototype.indexOf = function indexOf(val2, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val2, byteOffset, encoding, true);
};
Buffer.prototype.lastIndexOf = function lastIndexOf(val2, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val2, byteOffset, encoding, false);
};
function hexWrite(buf, string, offset, length) {
  offset = Number(offset) || 0;
  var remaining = buf.length - offset;
  if (!length) {
    length = remaining;
  } else {
    length = Number(length);
    if (length > remaining) {
      length = remaining;
    }
  }
  var strLen = string.length;
  if (strLen % 2 !== 0)
    throw new TypeError("Invalid hex string");
  if (length > strLen / 2) {
    length = strLen / 2;
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16);
    if (isNaN(parsed))
      return i;
    buf[offset + i] = parsed;
  }
  return i;
}
function utf8Write(buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length);
}
function asciiWrite(buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length);
}
function latin1Write(buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length);
}
function base64Write(buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length);
}
function ucs2Write(buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length);
}
Buffer.prototype.write = function write2(string, offset, length, encoding) {
  if (offset === void 0) {
    encoding = "utf8";
    length = this.length;
    offset = 0;
  } else if (length === void 0 && typeof offset === "string") {
    encoding = offset;
    length = this.length;
    offset = 0;
  } else if (isFinite(offset)) {
    offset = offset | 0;
    if (isFinite(length)) {
      length = length | 0;
      if (encoding === void 0)
        encoding = "utf8";
    } else {
      encoding = length;
      length = void 0;
    }
  } else {
    throw new Error("Buffer.write(string, encoding, offset[, length]) is no longer supported");
  }
  var remaining = this.length - offset;
  if (length === void 0 || length > remaining)
    length = remaining;
  if (string.length > 0 && (length < 0 || offset < 0) || offset > this.length) {
    throw new RangeError("Attempt to write outside buffer bounds");
  }
  if (!encoding)
    encoding = "utf8";
  var loweredCase = false;
  for (; ; ) {
    switch (encoding) {
      case "hex":
        return hexWrite(this, string, offset, length);
      case "utf8":
      case "utf-8":
        return utf8Write(this, string, offset, length);
      case "ascii":
        return asciiWrite(this, string, offset, length);
      case "latin1":
      case "binary":
        return latin1Write(this, string, offset, length);
      case "base64":
        return base64Write(this, string, offset, length);
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return ucs2Write(this, string, offset, length);
      default:
        if (loweredCase)
          throw new TypeError("Unknown encoding: " + encoding);
        encoding = ("" + encoding).toLowerCase();
        loweredCase = true;
    }
  }
};
Buffer.prototype.toJSON = function toJSON() {
  return {
    type: "Buffer",
    data: Array.prototype.slice.call(this._arr || this, 0)
  };
};
function base64Slice(buf, start, end2) {
  if (start === 0 && end2 === buf.length) {
    return fromByteArray(buf);
  } else {
    return fromByteArray(buf.slice(start, end2));
  }
}
function utf8Slice(buf, start, end2) {
  end2 = Math.min(buf.length, end2);
  var res = [];
  var i = start;
  while (i < end2) {
    var firstByte = buf[i];
    var codePoint = null;
    var bytesPerSequence = firstByte > 239 ? 4 : firstByte > 223 ? 3 : firstByte > 191 ? 2 : 1;
    if (i + bytesPerSequence <= end2) {
      var secondByte, thirdByte, fourthByte, tempCodePoint;
      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 128) {
            codePoint = firstByte;
          }
          break;
        case 2:
          secondByte = buf[i + 1];
          if ((secondByte & 192) === 128) {
            tempCodePoint = (firstByte & 31) << 6 | secondByte & 63;
            if (tempCodePoint > 127) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 3:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 12 | (secondByte & 63) << 6 | thirdByte & 63;
            if (tempCodePoint > 2047 && (tempCodePoint < 55296 || tempCodePoint > 57343)) {
              codePoint = tempCodePoint;
            }
          }
          break;
        case 4:
          secondByte = buf[i + 1];
          thirdByte = buf[i + 2];
          fourthByte = buf[i + 3];
          if ((secondByte & 192) === 128 && (thirdByte & 192) === 128 && (fourthByte & 192) === 128) {
            tempCodePoint = (firstByte & 15) << 18 | (secondByte & 63) << 12 | (thirdByte & 63) << 6 | fourthByte & 63;
            if (tempCodePoint > 65535 && tempCodePoint < 1114112) {
              codePoint = tempCodePoint;
            }
          }
      }
    }
    if (codePoint === null) {
      codePoint = 65533;
      bytesPerSequence = 1;
    } else if (codePoint > 65535) {
      codePoint -= 65536;
      res.push(codePoint >>> 10 & 1023 | 55296);
      codePoint = 56320 | codePoint & 1023;
    }
    res.push(codePoint);
    i += bytesPerSequence;
  }
  return decodeCodePointsArray(res);
}
var MAX_ARGUMENTS_LENGTH = 4096;
function decodeCodePointsArray(codePoints) {
  var len = codePoints.length;
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints);
  }
  var res = "";
  var i = 0;
  while (i < len) {
    res += String.fromCharCode.apply(String, codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH));
  }
  return res;
}
function asciiSlice(buf, start, end2) {
  var ret = "";
  end2 = Math.min(buf.length, end2);
  for (var i = start; i < end2; ++i) {
    ret += String.fromCharCode(buf[i] & 127);
  }
  return ret;
}
function latin1Slice(buf, start, end2) {
  var ret = "";
  end2 = Math.min(buf.length, end2);
  for (var i = start; i < end2; ++i) {
    ret += String.fromCharCode(buf[i]);
  }
  return ret;
}
function hexSlice(buf, start, end2) {
  var len = buf.length;
  if (!start || start < 0)
    start = 0;
  if (!end2 || end2 < 0 || end2 > len)
    end2 = len;
  var out = "";
  for (var i = start; i < end2; ++i) {
    out += toHex(buf[i]);
  }
  return out;
}
function utf16leSlice(buf, start, end2) {
  var bytes = buf.slice(start, end2);
  var res = "";
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
  }
  return res;
}
Buffer.prototype.slice = function slice2(start, end2) {
  var len = this.length;
  start = ~~start;
  end2 = end2 === void 0 ? len : ~~end2;
  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0;
  } else if (start > len) {
    start = len;
  }
  if (end2 < 0) {
    end2 += len;
    if (end2 < 0)
      end2 = 0;
  } else if (end2 > len) {
    end2 = len;
  }
  if (end2 < start)
    end2 = start;
  var newBuf;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = this.subarray(start, end2);
    newBuf.__proto__ = Buffer.prototype;
  } else {
    var sliceLen = end2 - start;
    newBuf = new Buffer(sliceLen, void 0);
    for (var i = 0; i < sliceLen; ++i) {
      newBuf[i] = this[i + start];
    }
  }
  return newBuf;
};
function checkOffset(offset, ext, length) {
  if (offset % 1 !== 0 || offset < 0)
    throw new RangeError("offset is not uint");
  if (offset + ext > length)
    throw new RangeError("Trying to access beyond buffer length");
}
Buffer.prototype.readUIntLE = function readUIntLE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var val2 = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val2 += this[offset + i] * mul;
  }
  return val2;
};
Buffer.prototype.readUIntBE = function readUIntBE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    checkOffset(offset, byteLength2, this.length);
  }
  var val2 = this[offset + --byteLength2];
  var mul = 1;
  while (byteLength2 > 0 && (mul *= 256)) {
    val2 += this[offset + --byteLength2] * mul;
  }
  return val2;
};
Buffer.prototype.readUInt8 = function readUInt8(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length);
  return this[offset];
};
Buffer.prototype.readUInt16LE = function readUInt16LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  return this[offset] | this[offset + 1] << 8;
};
Buffer.prototype.readUInt16BE = function readUInt16BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  return this[offset] << 8 | this[offset + 1];
};
Buffer.prototype.readUInt32LE = function readUInt32LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return (this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16) + this[offset + 3] * 16777216;
};
Buffer.prototype.readUInt32BE = function readUInt32BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] * 16777216 + (this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3]);
};
Buffer.prototype.readIntLE = function readIntLE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var val2 = this[offset];
  var mul = 1;
  var i = 0;
  while (++i < byteLength2 && (mul *= 256)) {
    val2 += this[offset + i] * mul;
  }
  mul *= 128;
  if (val2 >= mul)
    val2 -= Math.pow(2, 8 * byteLength2);
  return val2;
};
Buffer.prototype.readIntBE = function readIntBE(offset, byteLength2, noAssert) {
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert)
    checkOffset(offset, byteLength2, this.length);
  var i = byteLength2;
  var mul = 1;
  var val2 = this[offset + --i];
  while (i > 0 && (mul *= 256)) {
    val2 += this[offset + --i] * mul;
  }
  mul *= 128;
  if (val2 >= mul)
    val2 -= Math.pow(2, 8 * byteLength2);
  return val2;
};
Buffer.prototype.readInt8 = function readInt8(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length);
  if (!(this[offset] & 128))
    return this[offset];
  return (255 - this[offset] + 1) * -1;
};
Buffer.prototype.readInt16LE = function readInt16LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  var val2 = this[offset] | this[offset + 1] << 8;
  return val2 & 32768 ? val2 | 4294901760 : val2;
};
Buffer.prototype.readInt16BE = function readInt16BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length);
  var val2 = this[offset + 1] | this[offset] << 8;
  return val2 & 32768 ? val2 | 4294901760 : val2;
};
Buffer.prototype.readInt32LE = function readInt32LE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] | this[offset + 1] << 8 | this[offset + 2] << 16 | this[offset + 3] << 24;
};
Buffer.prototype.readInt32BE = function readInt32BE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return this[offset] << 24 | this[offset + 1] << 16 | this[offset + 2] << 8 | this[offset + 3];
};
Buffer.prototype.readFloatLE = function readFloatLE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return read(this, offset, true, 23, 4);
};
Buffer.prototype.readFloatBE = function readFloatBE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length);
  return read(this, offset, false, 23, 4);
};
Buffer.prototype.readDoubleLE = function readDoubleLE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length);
  return read(this, offset, true, 52, 8);
};
Buffer.prototype.readDoubleBE = function readDoubleBE(offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length);
  return read(this, offset, false, 52, 8);
};
function checkInt(buf, value, offset, ext, max, min) {
  if (!internalIsBuffer(buf))
    throw new TypeError('"buffer" argument must be a Buffer instance');
  if (value > max || value < min)
    throw new RangeError('"value" argument is out of bounds');
  if (offset + ext > buf.length)
    throw new RangeError("Index out of range");
}
Buffer.prototype.writeUIntLE = function writeUIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  var mul = 1;
  var i = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUIntBE = function writeUIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  byteLength2 = byteLength2 | 0;
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength2) - 1;
    checkInt(this, value, offset, byteLength2, maxBytes, 0);
  }
  var i = byteLength2 - 1;
  var mul = 1;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    this[offset + i] = value / mul & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeUInt8 = function writeUInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 1, 255, 0);
  if (!Buffer.TYPED_ARRAY_SUPPORT)
    value = Math.floor(value);
  this[offset] = value & 255;
  return offset + 1;
};
function objectWriteUInt16(buf, value, offset, littleEndian) {
  if (value < 0)
    value = 65535 + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
    buf[offset + i] = (value & 255 << 8 * (littleEndian ? i : 1 - i)) >>> (littleEndian ? i : 1 - i) * 8;
  }
}
Buffer.prototype.writeUInt16LE = function writeUInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 65535, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer.prototype.writeUInt16BE = function writeUInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 65535, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 255;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
function objectWriteUInt32(buf, value, offset, littleEndian) {
  if (value < 0)
    value = 4294967295 + value + 1;
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
    buf[offset + i] = value >>> (littleEndian ? i : 3 - i) * 8 & 255;
  }
}
Buffer.prototype.writeUInt32LE = function writeUInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 4294967295, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = value >>> 24;
    this[offset + 2] = value >>> 16;
    this[offset + 1] = value >>> 8;
    this[offset] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer.prototype.writeUInt32BE = function writeUInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 4294967295, 0);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
Buffer.prototype.writeIntLE = function writeIntLE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  var i = 0;
  var mul = 1;
  var sub = 0;
  this[offset] = value & 255;
  while (++i < byteLength2 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeIntBE = function writeIntBE(value, offset, byteLength2, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert) {
    var limit = Math.pow(2, 8 * byteLength2 - 1);
    checkInt(this, value, offset, byteLength2, limit - 1, -limit);
  }
  var i = byteLength2 - 1;
  var mul = 1;
  var sub = 0;
  this[offset + i] = value & 255;
  while (--i >= 0 && (mul *= 256)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1;
    }
    this[offset + i] = (value / mul >> 0) - sub & 255;
  }
  return offset + byteLength2;
};
Buffer.prototype.writeInt8 = function writeInt8(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 1, 127, -128);
  if (!Buffer.TYPED_ARRAY_SUPPORT)
    value = Math.floor(value);
  if (value < 0)
    value = 255 + value + 1;
  this[offset] = value & 255;
  return offset + 1;
};
Buffer.prototype.writeInt16LE = function writeInt16LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 32767, -32768);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
  } else {
    objectWriteUInt16(this, value, offset, true);
  }
  return offset + 2;
};
Buffer.prototype.writeInt16BE = function writeInt16BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 2, 32767, -32768);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 8;
    this[offset + 1] = value & 255;
  } else {
    objectWriteUInt16(this, value, offset, false);
  }
  return offset + 2;
};
Buffer.prototype.writeInt32LE = function writeInt32LE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 2147483647, -2147483648);
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value & 255;
    this[offset + 1] = value >>> 8;
    this[offset + 2] = value >>> 16;
    this[offset + 3] = value >>> 24;
  } else {
    objectWriteUInt32(this, value, offset, true);
  }
  return offset + 4;
};
Buffer.prototype.writeInt32BE = function writeInt32BE(value, offset, noAssert) {
  value = +value;
  offset = offset | 0;
  if (!noAssert)
    checkInt(this, value, offset, 4, 2147483647, -2147483648);
  if (value < 0)
    value = 4294967295 + value + 1;
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value >>> 24;
    this[offset + 1] = value >>> 16;
    this[offset + 2] = value >>> 8;
    this[offset + 3] = value & 255;
  } else {
    objectWriteUInt32(this, value, offset, false);
  }
  return offset + 4;
};
function checkIEEE754(buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length)
    throw new RangeError("Index out of range");
  if (offset < 0)
    throw new RangeError("Index out of range");
}
function writeFloat(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4);
  }
  write(buf, value, offset, littleEndian, 23, 4);
  return offset + 4;
}
Buffer.prototype.writeFloatLE = function writeFloatLE(value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert);
};
Buffer.prototype.writeFloatBE = function writeFloatBE(value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert);
};
function writeDouble(buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8);
  }
  write(buf, value, offset, littleEndian, 52, 8);
  return offset + 8;
}
Buffer.prototype.writeDoubleLE = function writeDoubleLE(value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert);
};
Buffer.prototype.writeDoubleBE = function writeDoubleBE(value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert);
};
Buffer.prototype.copy = function copy(target, targetStart, start, end2) {
  if (!start)
    start = 0;
  if (!end2 && end2 !== 0)
    end2 = this.length;
  if (targetStart >= target.length)
    targetStart = target.length;
  if (!targetStart)
    targetStart = 0;
  if (end2 > 0 && end2 < start)
    end2 = start;
  if (end2 === start)
    return 0;
  if (target.length === 0 || this.length === 0)
    return 0;
  if (targetStart < 0) {
    throw new RangeError("targetStart out of bounds");
  }
  if (start < 0 || start >= this.length)
    throw new RangeError("sourceStart out of bounds");
  if (end2 < 0)
    throw new RangeError("sourceEnd out of bounds");
  if (end2 > this.length)
    end2 = this.length;
  if (target.length - targetStart < end2 - start) {
    end2 = target.length - targetStart + start;
  }
  var len = end2 - start;
  var i;
  if (this === target && start < targetStart && targetStart < end2) {
    for (i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start];
    }
  } else if (len < 1e3 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (i = 0; i < len; ++i) {
      target[i + targetStart] = this[i + start];
    }
  } else {
    Uint8Array.prototype.set.call(target, this.subarray(start, start + len), targetStart);
  }
  return len;
};
Buffer.prototype.fill = function fill(val2, start, end2, encoding) {
  if (typeof val2 === "string") {
    if (typeof start === "string") {
      encoding = start;
      start = 0;
      end2 = this.length;
    } else if (typeof end2 === "string") {
      encoding = end2;
      end2 = this.length;
    }
    if (val2.length === 1) {
      var code = val2.charCodeAt(0);
      if (code < 256) {
        val2 = code;
      }
    }
    if (encoding !== void 0 && typeof encoding !== "string") {
      throw new TypeError("encoding must be a string");
    }
    if (typeof encoding === "string" && !Buffer.isEncoding(encoding)) {
      throw new TypeError("Unknown encoding: " + encoding);
    }
  } else if (typeof val2 === "number") {
    val2 = val2 & 255;
  }
  if (start < 0 || this.length < start || this.length < end2) {
    throw new RangeError("Out of range index");
  }
  if (end2 <= start) {
    return this;
  }
  start = start >>> 0;
  end2 = end2 === void 0 ? this.length : end2 >>> 0;
  if (!val2)
    val2 = 0;
  var i;
  if (typeof val2 === "number") {
    for (i = start; i < end2; ++i) {
      this[i] = val2;
    }
  } else {
    var bytes = internalIsBuffer(val2) ? val2 : utf8ToBytes(new Buffer(val2, encoding).toString());
    var len = bytes.length;
    for (i = 0; i < end2 - start; ++i) {
      this[i + start] = bytes[i % len];
    }
  }
  return this;
};
var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;
function base64clean(str) {
  str = stringtrim(str).replace(INVALID_BASE64_RE, "");
  if (str.length < 2)
    return "";
  while (str.length % 4 !== 0) {
    str = str + "=";
  }
  return str;
}
function stringtrim(str) {
  if (str.trim)
    return str.trim();
  return str.replace(/^\s+|\s+$/g, "");
}
function toHex(n) {
  if (n < 16)
    return "0" + n.toString(16);
  return n.toString(16);
}
function utf8ToBytes(string, units) {
  units = units || Infinity;
  var codePoint;
  var length = string.length;
  var leadSurrogate = null;
  var bytes = [];
  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i);
    if (codePoint > 55295 && codePoint < 57344) {
      if (!leadSurrogate) {
        if (codePoint > 56319) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        } else if (i + 1 === length) {
          if ((units -= 3) > -1)
            bytes.push(239, 191, 189);
          continue;
        }
        leadSurrogate = codePoint;
        continue;
      }
      if (codePoint < 56320) {
        if ((units -= 3) > -1)
          bytes.push(239, 191, 189);
        leadSurrogate = codePoint;
        continue;
      }
      codePoint = (leadSurrogate - 55296 << 10 | codePoint - 56320) + 65536;
    } else if (leadSurrogate) {
      if ((units -= 3) > -1)
        bytes.push(239, 191, 189);
    }
    leadSurrogate = null;
    if (codePoint < 128) {
      if ((units -= 1) < 0)
        break;
      bytes.push(codePoint);
    } else if (codePoint < 2048) {
      if ((units -= 2) < 0)
        break;
      bytes.push(codePoint >> 6 | 192, codePoint & 63 | 128);
    } else if (codePoint < 65536) {
      if ((units -= 3) < 0)
        break;
      bytes.push(codePoint >> 12 | 224, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else if (codePoint < 1114112) {
      if ((units -= 4) < 0)
        break;
      bytes.push(codePoint >> 18 | 240, codePoint >> 12 & 63 | 128, codePoint >> 6 & 63 | 128, codePoint & 63 | 128);
    } else {
      throw new Error("Invalid code point");
    }
  }
  return bytes;
}
function asciiToBytes(str) {
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    byteArray.push(str.charCodeAt(i) & 255);
  }
  return byteArray;
}
function utf16leToBytes(str, units) {
  var c, hi, lo;
  var byteArray = [];
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0)
      break;
    c = str.charCodeAt(i);
    hi = c >> 8;
    lo = c % 256;
    byteArray.push(lo);
    byteArray.push(hi);
  }
  return byteArray;
}
function base64ToBytes(str) {
  return toByteArray(base64clean(str));
}
function blitBuffer(src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if (i + offset >= dst.length || i >= src.length)
      break;
    dst[i + offset] = src[i];
  }
  return i;
}
function isnan(val2) {
  return val2 !== val2;
}
function isBuffer(obj) {
  return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj));
}
function isFastBuffer(obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === "function" && obj.constructor.isBuffer(obj);
}
function isSlowBuffer(obj) {
  return typeof obj.readFloatLE === "function" && typeof obj.slice === "function" && isFastBuffer(obj.slice(0, 0));
}
function getParse(parser) {
  return function parse2(content, options, isDocument$1, context) {
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(content)) {
      content = content.toString();
    }
    if (typeof content === "string") {
      return parser(content, options, isDocument$1, context);
    }
    const doc = content;
    if (!Array.isArray(doc) && isDocument(doc)) {
      return doc;
    }
    const root2 = new Document([]);
    update(doc, root2);
    return root2;
  };
}
function update(newChilds, parent2) {
  const arr = Array.isArray(newChilds) ? newChilds : [newChilds];
  if (parent2) {
    parent2.children = arr;
  } else {
    parent2 = null;
  }
  for (let i = 0; i < arr.length; i++) {
    const node = arr[i];
    if (node.parent && node.parent.children !== arr) {
      removeElement(node);
    }
    if (parent2) {
      node.prev = arr[i - 1] || null;
      node.next = arr[i + 1] || null;
    } else {
      node.prev = node.next = null;
    }
    node.parent = parent2;
  }
  return parent2;
}
function _makeDomArray(elem, clone2) {
  if (elem == null) {
    return [];
  }
  if (isCheerio(elem)) {
    return clone2 ? cloneDom(elem.get()) : elem.get();
  }
  if (Array.isArray(elem)) {
    return elem.reduce((newElems, el) => newElems.concat(this._makeDomArray(el, clone2)), []);
  }
  if (typeof elem === "string") {
    return this._parse(elem, this.options, false, null).children;
  }
  return clone2 ? cloneDom([elem]) : [elem];
}
function _insert(concatenator) {
  return function(...elems) {
    const lastIdx = this.length - 1;
    return domEach(this, (el, i) => {
      if (!hasChildren(el))
        return;
      const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
      const dom = this._makeDomArray(domSrc, i < lastIdx);
      concatenator(dom, el.children, el);
    });
  };
}
function uniqueSplice(array, spliceIdx, spliceCount, newElems, parent2) {
  var _a, _b;
  const spliceArgs = [
    spliceIdx,
    spliceCount,
    ...newElems
  ];
  const prev2 = spliceIdx === 0 ? null : array[spliceIdx - 1];
  const next2 = spliceIdx + spliceCount >= array.length ? null : array[spliceIdx + spliceCount];
  for (let idx = 0; idx < newElems.length; ++idx) {
    const node = newElems[idx];
    const oldParent = node.parent;
    if (oldParent) {
      const oldSiblings = oldParent.children;
      const prevIdx = oldSiblings.indexOf(node);
      if (prevIdx > -1) {
        oldParent.children.splice(prevIdx, 1);
        if (parent2 === oldParent && spliceIdx > prevIdx) {
          spliceArgs[0]--;
        }
      }
    }
    node.parent = parent2;
    if (node.prev) {
      node.prev.next = (_a = node.next) !== null && _a !== void 0 ? _a : null;
    }
    if (node.next) {
      node.next.prev = (_b = node.prev) !== null && _b !== void 0 ? _b : null;
    }
    node.prev = idx === 0 ? prev2 : newElems[idx - 1];
    node.next = idx === newElems.length - 1 ? next2 : newElems[idx + 1];
  }
  if (prev2) {
    prev2.next = newElems[0];
  }
  if (next2) {
    next2.prev = newElems[newElems.length - 1];
  }
  return array.splice(...spliceArgs);
}
function appendTo(target) {
  const appendTarget = isCheerio(target) ? target : this._make(target);
  appendTarget.append(this);
  return this;
}
function prependTo(target) {
  const prependTarget = isCheerio(target) ? target : this._make(target);
  prependTarget.prepend(this);
  return this;
}
const append = _insert((dom, children2, parent2) => {
  uniqueSplice(children2, children2.length, 0, dom, parent2);
});
const prepend = _insert((dom, children2, parent2) => {
  uniqueSplice(children2, 0, 0, dom, parent2);
});
function _wrap(insert) {
  return function(wrapper) {
    const lastIdx = this.length - 1;
    const lastParent = this.parents().last();
    for (let i = 0; i < this.length; i++) {
      const el = this[i];
      const wrap2 = typeof wrapper === "function" ? wrapper.call(el, i, el) : typeof wrapper === "string" && !isHtml(wrapper) ? lastParent.find(wrapper).clone() : wrapper;
      const [wrapperDom] = this._makeDomArray(wrap2, i < lastIdx);
      if (!wrapperDom || !hasChildren(wrapperDom))
        continue;
      let elInsertLocation = wrapperDom;
      let j = 0;
      while (j < elInsertLocation.children.length) {
        const child = elInsertLocation.children[j];
        if (isTag(child)) {
          elInsertLocation = child;
          j = 0;
        } else {
          j++;
        }
      }
      insert(el, elInsertLocation, [wrapperDom]);
    }
    return this;
  };
}
const wrap = _wrap((el, elInsertLocation, wrapperDom) => {
  const {parent: parent2} = el;
  if (!parent2)
    return;
  const siblings2 = parent2.children;
  const index2 = siblings2.indexOf(el);
  update([el], elInsertLocation);
  uniqueSplice(siblings2, index2, 0, wrapperDom, parent2);
});
const wrapInner = _wrap((el, elInsertLocation, wrapperDom) => {
  if (!hasChildren(el))
    return;
  update(el.children, elInsertLocation);
  update(wrapperDom, el);
});
function unwrap(selector) {
  this.parent(selector).not("body").each((_, el) => {
    this._make(el).replaceWith(el.children);
  });
  return this;
}
function wrapAll(wrapper) {
  const el = this[0];
  if (el) {
    const wrap2 = this._make(typeof wrapper === "function" ? wrapper.call(el, 0, el) : wrapper).insertBefore(el);
    let elInsertLocation;
    for (let i = 0; i < wrap2.length; i++) {
      if (wrap2[i].type === "tag")
        elInsertLocation = wrap2[i];
    }
    let j = 0;
    while (elInsertLocation && j < elInsertLocation.children.length) {
      const child = elInsertLocation.children[j];
      if (child.type === "tag") {
        elInsertLocation = child;
        j = 0;
      } else {
        j++;
      }
    }
    if (elInsertLocation)
      this._make(elInsertLocation).append(this);
  }
  return this;
}
function after(...elems) {
  const lastIdx = this.length - 1;
  return domEach(this, (el, i) => {
    const {parent: parent2} = el;
    if (!hasChildren(el) || !parent2) {
      return;
    }
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    if (index2 < 0)
      return;
    const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
    const dom = this._makeDomArray(domSrc, i < lastIdx);
    uniqueSplice(siblings2, index2 + 1, 0, dom, parent2);
  });
}
function insertAfter(target) {
  if (typeof target === "string") {
    target = this._make(target);
  }
  this.remove();
  const clones = [];
  this._makeDomArray(target).forEach((el) => {
    const clonedSelf = this.clone().toArray();
    const {parent: parent2} = el;
    if (!parent2) {
      return;
    }
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    if (index2 < 0)
      return;
    uniqueSplice(siblings2, index2 + 1, 0, clonedSelf, parent2);
    clones.push(...clonedSelf);
  });
  return this._make(clones);
}
function before(...elems) {
  const lastIdx = this.length - 1;
  return domEach(this, (el, i) => {
    const {parent: parent2} = el;
    if (!hasChildren(el) || !parent2) {
      return;
    }
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    if (index2 < 0)
      return;
    const domSrc = typeof elems[0] === "function" ? elems[0].call(el, i, this._render(el.children)) : elems;
    const dom = this._makeDomArray(domSrc, i < lastIdx);
    uniqueSplice(siblings2, index2, 0, dom, parent2);
  });
}
function insertBefore(target) {
  const targetArr = this._make(target);
  this.remove();
  const clones = [];
  domEach(targetArr, (el) => {
    const clonedSelf = this.clone().toArray();
    const {parent: parent2} = el;
    if (!parent2) {
      return;
    }
    const siblings2 = parent2.children;
    const index2 = siblings2.indexOf(el);
    if (index2 < 0)
      return;
    uniqueSplice(siblings2, index2, 0, clonedSelf, parent2);
    clones.push(...clonedSelf);
  });
  return this._make(clones);
}
function remove(selector) {
  const elems = selector ? this.filter(selector) : this;
  domEach(elems, (el) => {
    removeElement(el);
    el.prev = el.next = el.parent = null;
  });
  return this;
}
function replaceWith(content) {
  return domEach(this, (el, i) => {
    const {parent: parent2} = el;
    if (!parent2) {
      return;
    }
    const siblings2 = parent2.children;
    const cont = typeof content === "function" ? content.call(el, i, el) : content;
    const dom = this._makeDomArray(cont);
    update(dom, null);
    const index2 = siblings2.indexOf(el);
    uniqueSplice(siblings2, index2, 1, dom, parent2);
    if (!dom.includes(el)) {
      el.parent = el.prev = el.next = null;
    }
  });
}
function empty() {
  return domEach(this, (el) => {
    if (!hasChildren(el))
      return;
    el.children.forEach((child) => {
      child.next = child.prev = child.parent = null;
    });
    el.children.length = 0;
  });
}
function html$1(str) {
  if (str === void 0) {
    const el = this[0];
    if (!el || !hasChildren(el))
      return null;
    return this._render(el.children);
  }
  return domEach(this, (el) => {
    if (!hasChildren(el))
      return;
    el.children.forEach((child) => {
      child.next = child.prev = child.parent = null;
    });
    const content = isCheerio(str) ? str.toArray() : this._parse(`${str}`, this.options, false, el).children;
    update(content, el);
  });
}
function toString$1() {
  return this._render(this);
}
function text$1(str) {
  if (str === void 0) {
    return text(this);
  }
  if (typeof str === "function") {
    return domEach(this, (el, i) => this._make(el).text(str.call(el, i, text([el]))));
  }
  return domEach(this, (el) => {
    if (!hasChildren(el))
      return;
    el.children.forEach((child) => {
      child.next = child.prev = child.parent = null;
    });
    const textNode = new Text(`${str}`);
    update(textNode, el);
  });
}
function clone() {
  return this._make(cloneDom(this.get()));
}
var Manipulation = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  _makeDomArray,
  appendTo,
  prependTo,
  append,
  prepend,
  wrap,
  wrapInner,
  unwrap,
  wrapAll,
  after,
  insertAfter,
  before,
  insertBefore,
  remove,
  replaceWith,
  empty,
  html: html$1,
  toString: toString$1,
  text: text$1,
  clone
});
function css(prop2, val2) {
  if (prop2 != null && val2 != null || typeof prop2 === "object" && !Array.isArray(prop2)) {
    return domEach(this, (el, i) => {
      if (isTag(el)) {
        setCss(el, prop2, val2, i);
      }
    });
  }
  if (this.length === 0) {
    return void 0;
  }
  return getCss(this[0], prop2);
}
function setCss(el, prop2, value, idx) {
  if (typeof prop2 === "string") {
    const styles = getCss(el);
    const val2 = typeof value === "function" ? value.call(el, idx, styles[prop2]) : value;
    if (val2 === "") {
      delete styles[prop2];
    } else if (val2 != null) {
      styles[prop2] = val2;
    }
    el.attribs["style"] = stringify(styles);
  } else if (typeof prop2 === "object") {
    Object.keys(prop2).forEach((k, i) => {
      setCss(el, k, prop2[k], i);
    });
  }
}
function getCss(el, prop2) {
  if (!el || !isTag(el))
    return;
  const styles = parse(el.attribs["style"]);
  if (typeof prop2 === "string") {
    return styles[prop2];
  }
  if (Array.isArray(prop2)) {
    const newStyles = {};
    prop2.forEach((item) => {
      if (styles[item] != null) {
        newStyles[item] = styles[item];
      }
    });
    return newStyles;
  }
  return styles;
}
function stringify(obj) {
  return Object.keys(obj).reduce((str, prop2) => `${str}${str ? " " : ""}${prop2}: ${obj[prop2]};`, "");
}
function parse(styles) {
  styles = (styles || "").trim();
  if (!styles)
    return {};
  const obj = {};
  let key;
  for (const str of styles.split(";")) {
    const n = str.indexOf(":");
    if (n < 1 || n === str.length - 1) {
      const trimmed = str.trimEnd();
      if (trimmed.length > 0 && key !== void 0) {
        obj[key] += `;${trimmed}`;
      }
    } else {
      key = str.slice(0, n).trim();
      obj[key] = str.slice(n + 1).trim();
    }
  }
  return obj;
}
var Css = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  css
});
const submittableSelector = "input,select,textarea,keygen";
const r20 = /%20/g;
const rCRLF = /\r?\n/g;
function serialize() {
  const arr = this.serializeArray();
  const retArr = arr.map((data2) => `${encodeURIComponent(data2.name)}=${encodeURIComponent(data2.value)}`);
  return retArr.join("&").replace(r20, "+");
}
function serializeArray() {
  return this.map((_, elem) => {
    const $elem = this._make(elem);
    if (isTag(elem) && elem.name === "form") {
      return $elem.find(submittableSelector).toArray();
    }
    return $elem.filter(submittableSelector).toArray();
  }).filter('[name!=""]:enabled:not(:submit, :button, :image, :reset, :file):matches([checked], :not(:checkbox, :radio))').map((_, elem) => {
    var _a;
    const $elem = this._make(elem);
    const name = $elem.attr("name");
    const value = (_a = $elem.val()) !== null && _a !== void 0 ? _a : "";
    if (Array.isArray(value)) {
      return value.map((val2) => ({name, value: val2.replace(rCRLF, "\r\n")}));
    }
    return {name, value: value.replace(rCRLF, "\r\n")};
  }).toArray();
}
var Forms = /* @__PURE__ */ Object.freeze({
  __proto__: null,
  serialize,
  serializeArray
});
class Cheerio {
  constructor(elements, root2, options) {
    this.length = 0;
    this.options = options;
    this._root = root2;
    if (elements) {
      for (let idx = 0; idx < elements.length; idx++) {
        this[idx] = elements[idx];
      }
      this.length = elements.length;
    }
  }
}
Cheerio.prototype.cheerio = "[cheerio object]";
Cheerio.prototype.splice = Array.prototype.splice;
Cheerio.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
Object.assign(Cheerio.prototype, Attributes, Traversing, Manipulation, Css, Forms);
function getLoad(parse2, render2) {
  return function load(content, options, isDocument2 = true) {
    if (content == null) {
      throw new Error("cheerio.load() expects a string");
    }
    const internalOpts = {...defaultOpts, ...flatten(options)};
    const initialRoot = parse2(content, internalOpts, isDocument2, null);
    class LoadedCheerio extends Cheerio {
      _make(selector, context) {
        const cheerio = initialize(selector, context);
        cheerio.prevObject = this;
        return cheerio;
      }
      _parse(content2, options2, isDocument3, context) {
        return parse2(content2, options2, isDocument3, context);
      }
      _render(dom) {
        return render2(dom, this.options);
      }
    }
    function initialize(selector, context, root2 = initialRoot, opts) {
      if (selector && isCheerio(selector))
        return selector;
      const options2 = {
        ...internalOpts,
        ...flatten(opts)
      };
      const r = typeof root2 === "string" ? [parse2(root2, options2, false, null)] : "length" in root2 ? root2 : [root2];
      const rootInstance = isCheerio(r) ? r : new LoadedCheerio(r, null, options2);
      rootInstance._root = rootInstance;
      if (!selector) {
        return new LoadedCheerio(void 0, rootInstance, options2);
      }
      const elements = typeof selector === "string" && isHtml(selector) ? parse2(selector, options2, false, null).children : isNode(selector) ? [selector] : Array.isArray(selector) ? selector : void 0;
      const instance = new LoadedCheerio(elements, rootInstance, options2);
      if (elements) {
        return instance;
      }
      if (typeof selector !== "string") {
        throw new Error("Unexpected type of selector");
      }
      let search = selector;
      const searchContext = !context ? rootInstance : typeof context === "string" ? isHtml(context) ? new LoadedCheerio([parse2(context, options2, false, null)], rootInstance, options2) : (search = `${context} ${search}`, rootInstance) : isCheerio(context) ? context : new LoadedCheerio(Array.isArray(context) ? context : [context], rootInstance, options2);
      if (!searchContext)
        return instance;
      return searchContext.find(search);
    }
    Object.assign(initialize, staticMethods, {
      load,
      _root: initialRoot,
      _options: internalOpts,
      fn: LoadedCheerio.prototype,
      prototype: LoadedCheerio.prototype
    });
    return initialize;
  };
}
function isNode(obj) {
  return !!obj.name || obj.type === "root" || obj.type === "text" || obj.type === "comment";
}
export {getParse as a, getLoad as g, html as h, staticMethods as s, text as t, xml as x};
export default null;
