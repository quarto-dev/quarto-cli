import { CTOR_KEY } from "../constructor-lock.ts";
import { fragmentNodesFromString } from "../deserialize.ts";
import { Node, nodesAndTextNodes, NodeType } from "./node.ts";
import { NodeList, nodeListMutatorSym } from "./node-list.ts";
import { HTMLCollection } from "./html-collection.ts";
import {
  getElementAttributesString,
  getElementsByClassName,
  getInnerHtmlFromNodes,
  insertBeforeAfter,
} from "./utils.ts";
import UtilTypes from "./utils-types.ts";

export interface DOMTokenList {
  [index: number]: string;
}

export class DOMTokenList {
  #_value = "";
  get #value() {
    return this.#_value;
  }
  set #value(
    value: string,
  ) {
    this.#_value = value;
    this.#onChange(value);
  }
  #set = new Set<string>();
  #onChange: (className: string) => void;

  constructor(
    onChange: (className: string) => void,
    key: typeof CTOR_KEY,
  ) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor");
    }
    this.#onChange = onChange;
  }

  static #invalidToken(
    token: string,
  ) {
    return token === "" || /[\t\n\f\r ]/.test(token);
  }

  #setIndices() {
    const classes = Array.from(this.#set);
    for (let i = 0; i < classes.length; i++) {
      this[i] = classes[i];
    }
  }

  set value(
    input: string,
  ) {
    this.#value = input;
    this.#set = new Set(
      input
        .trim()
        .split(/[\t\n\f\r\s]+/g)
        .filter(Boolean),
    );
    this.#setIndices();
  }

  get value() {
    return this.#_value;
  }

  get length() {
    return this.#set.size;
  }

  *entries(): IterableIterator<[number, string]> {
    const array = Array.from(this.#set);
    for (let i = 0; i < array.length; i++) {
      yield [i, array[i]];
    }
  }

  *values(): IterableIterator<string> {
    yield* this.#set.values();
  }

  *keys(): IterableIterator<number> {
    for (let i = 0; i < this.#set.size; i++) {
      yield i;
    }
  }

  *[Symbol.iterator](): IterableIterator<string> {
    yield* this.#set.values();
  }

  item(
    index: number,
  ) {
    index = Number(index);
    if (Number.isNaN(index) || index === Infinity) index = 0;
    return this[Math.trunc(index) % 2 ** 32] ?? null;
  }

  contains(
    element: string,
  ) {
    return this.#set.has(element);
  }

  add(
    ...elements: Array<string>
  ) {
    for (const element of elements) {
      if (DOMTokenList.#invalidToken(element)) {
        throw new DOMException(
          "Failed to execute 'add' on 'DOMTokenList': The token provided must not be empty.",
        );
      }
      const { size } = this.#set;
      this.#set.add(element);
      if (size < this.#set.size) {
        this[size] = element;
      }
    }
    this.#updateClassString();
  }

  remove(
    ...elements: Array<string>
  ) {
    const { size } = this.#set;
    for (const element of elements) {
      if (DOMTokenList.#invalidToken(element)) {
        throw new DOMException(
          "Failed to execute 'remove' on 'DOMTokenList': The token provided must not be empty.",
        );
      }
      this.#set.delete(element);
    }
    if (size !== this.#set.size) {
      for (let i = this.#set.size; i < size; i++) {
        delete this[i];
      }
      this.#setIndices();
    }
    this.#updateClassString();
  }

  replace(
    oldToken: string,
    newToken: string,
  ) {
    if ([oldToken, newToken].some((v) => DOMTokenList.#invalidToken(v))) {
      throw new DOMException(
        "Failed to execute 'replace' on 'DOMTokenList': The token provided must not be empty.",
      );
    }
    if (!this.#set.has(oldToken)) {
      return false;
    }

    if (this.#set.has(newToken)) {
      this.remove(oldToken);
    } else {
      this.#set.delete(oldToken);
      this.#set.add(newToken);
      this.#setIndices();
      this.#updateClassString();
    }
    return true;
  }

  supports(): never {
    throw new Error("Not implemented");
  }

  toggle(
    element: string,
    force?: boolean,
  ) {
    if (force !== undefined) {
      const operation = force ? "add" : "remove";
      this[operation](element);
      return false;
    } else {
      const contains = this.contains(element);
      const operation = contains ? "remove" : "add";
      this[operation](element);
      return !contains;
    }
  }

  forEach(
    callback: (value: string, index: number, list: DOMTokenList) => void,
  ) {
    for (const [i, value] of this.entries()) {
      callback(value, i, this);
    }
  }

  #updateClassString() {
    this.#value = Array.from(this.#set).join(" ");
  }
}

const setNamedNodeMapOwnerElementSym = Symbol();
const setAttrValueSym = Symbol();
export class Attr extends Node {
  #namedNodeMap: NamedNodeMap | null = null;
  #name = "";
  #value = "";
  #ownerElement: Element | null = null;

  constructor(
    map: NamedNodeMap | null,
    name: string,
    value: string,
    key: typeof CTOR_KEY,
  ) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor");
    }
    super(name, NodeType.ATTRIBUTE_NODE, null, CTOR_KEY);

    this.#name = name;
    this.#value = value;
    this.#namedNodeMap = map;
  }

  [setNamedNodeMapOwnerElementSym](ownerElement: Element | null) {
    this.#ownerElement = ownerElement;
    this.#namedNodeMap = ownerElement?.attributes ?? null;

    if (ownerElement) {
      this._setOwnerDocument(ownerElement.ownerDocument);
    }
  }

  [setAttrValueSym](value: string) {
    this.#value = value;
  }

  override _shallowClone(): Attr {
    const newAttr = new Attr(null, this.#name, this.#value, CTOR_KEY);
    newAttr._setOwnerDocument(this.ownerDocument);
    return newAttr;
  }

  override cloneNode(): Attr {
    return super.cloneNode() as Attr;
  }

  override appendChild(): Node {
    throw new DOMException("Cannot add children to an Attribute");
  }

  override replaceChild(): Node {
    throw new DOMException("Cannot add children to an Attribute");
  }

  override insertBefore(): Node {
    throw new DOMException("Cannot add children to an Attribute");
  }

  override removeChild(): Node {
    throw new DOMException(
      "The node to be removed is not a child of this node",
    );
  }

  get name() {
    return this.#name;
  }

  get localName() {
    // TODO: When we make namespaces a thing this needs
    // to be updated
    return this.#name;
  }

  get value(): string {
    return this.#value;
  }

  set value(value: any) {
    this.#value = String(value);

    if (this.#namedNodeMap) {
      this.#namedNodeMap[setNamedNodeMapValueSym](
        this.#name,
        this.#value,
        true,
      );
    }
  }

  get ownerElement() {
    return this.#ownerElement ?? null;
  }

  get specified() {
    return true;
  }

  // TODO
  get prefix(): string | null {
    return null;
  }
}

export interface NamedNodeMap {
  [index: number]: Attr;
}

const setNamedNodeMapValueSym = Symbol();
const getNamedNodeMapValueSym = Symbol();
const getNamedNodeMapAttrNamesSym = Symbol();
const getNamedNodeMapAttrNodeSym = Symbol();
const removeNamedNodeMapAttrSym = Symbol();
export class NamedNodeMap {
  static #indexedAttrAccess = function (
    this: NamedNodeMap,
    map: Record<string, string | undefined>,
    index: number,
  ): Attr | undefined {
    if (index + 1 > this.length) {
      return undefined;
    }

    const attribute = Object
      .keys(map)
      .filter((attribute) => map[attribute] !== undefined)[index];
    return this[getNamedNodeMapAttrNodeSym](attribute);
  };
  #onAttrNodeChange: (attr: string, value: string | null) => void;

  constructor(
    ownerElement: Element,
    onAttrNodeChange: (attr: string, value: string | null) => void,
    key: typeof CTOR_KEY,
  ) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor.");
    }
    this.#ownerElement = ownerElement;
    this.#onAttrNodeChange = onAttrNodeChange;
  }

  #attrNodeCache: Record<string, Attr | undefined> = {};
  #map: Record<string, string | undefined> = {};
  #length = 0;
  #capacity = 0;
  #ownerElement: Element | null = null;

  [getNamedNodeMapAttrNodeSym](attribute: string): Attr {
    let attrNode = this.#attrNodeCache[attribute];
    if (!attrNode) {
      attrNode = this.#attrNodeCache[attribute] = new Attr(
        this,
        attribute,
        this.#map[attribute] as string,
        CTOR_KEY,
      );
      attrNode[setNamedNodeMapOwnerElementSym](this.#ownerElement);
    }

    return attrNode;
  }

  [getNamedNodeMapAttrNamesSym](): string[] {
    const names: string[] = [];

    for (const [name, value] of Object.entries(this.#map)) {
      if (value !== undefined) {
        names.push(name);
      }
    }

    return names;
  }

  [getNamedNodeMapValueSym](attribute: string): string | undefined {
    return this.#map[attribute];
  }

  [setNamedNodeMapValueSym](attribute: string, value: string, bubble = false) {
    if (this.#map[attribute] === undefined) {
      this.#length++;

      if (this.#length > this.#capacity) {
        this.#capacity = this.#length;
        const index = this.#capacity - 1;
        Object.defineProperty(this, String(this.#capacity - 1), {
          get: NamedNodeMap.#indexedAttrAccess.bind(this, this.#map, index),
        });
      }
    } else if (this.#attrNodeCache[attribute]) {
      this.#attrNodeCache[attribute]![setAttrValueSym](value);
    }

    this.#map[attribute] = value;

    if (bubble) {
      this.#onAttrNodeChange(attribute, value);
    }
  }

  /**
   * Called when an attribute is removed from
   * an element
   */
  [removeNamedNodeMapAttrSym](attribute: string) {
    if (this.#map[attribute] !== undefined) {
      this.#length--;
      this.#map[attribute] = undefined;
      this.#onAttrNodeChange(attribute, null);

      const attrNode = this.#attrNodeCache[attribute];
      if (attrNode) {
        attrNode[setNamedNodeMapOwnerElementSym](null);
        this.#attrNodeCache[attribute] = undefined;
      }
    }
  }

  *[Symbol.iterator](): Generator<Attr> {
    for (let i = 0; i < this.length; i++) {
      yield this[i];
    }
  }

  get length() {
    return this.#length;
  }

  // FIXME: This method should accept anything and basically
  // coerce any non numbers (and Infinity/-Infinity) into 0
  item(index: number): Attr | null {
    if (index >= this.#length) {
      return null;
    }

    return this[index];
  }

  getNamedItem(attribute: string): Attr | null {
    if (this.#map[attribute] !== undefined) {
      return this[getNamedNodeMapAttrNodeSym](attribute);
    }

    return null;
  }

  setNamedItem(attrNode: Attr) {
    if (attrNode.ownerElement) {
      throw new DOMException("Attribute already in use");
    }

    const previousAttr = this.#attrNodeCache[attrNode.name];
    if (previousAttr) {
      previousAttr[setNamedNodeMapOwnerElementSym](null);
      this.#map[attrNode.name] = undefined;
    }

    attrNode[setNamedNodeMapOwnerElementSym](this.#ownerElement);
    this.#attrNodeCache[attrNode.name] = attrNode;
    this[setNamedNodeMapValueSym](attrNode.name, attrNode.value, true);
  }

  removeNamedItem(attribute: string): Attr {
    if (this.#map[attribute] !== undefined) {
      const attrNode = this[getNamedNodeMapAttrNodeSym](attribute);
      this[removeNamedNodeMapAttrSym](attribute);
      return attrNode;
    }

    throw new DOMException("Node was not found");
  }
}

export class Element extends Node {
  localName: string;
  attributes = new NamedNodeMap(this, (attribute, value) => {
    if (value === null) {
      value = "";
    }

    switch (attribute) {
      case "class":
        this.#classList.value = value;
        break;
      case "id":
        this.#currentId = value;
        break;
    }
  }, CTOR_KEY);

  #currentId = "";
  #classList = new DOMTokenList(
    (className) => {
      if (this.hasAttribute("class") || className !== "") {
        this.attributes[setNamedNodeMapValueSym]("class", className);
      }
    },
    CTOR_KEY,
  );

  constructor(
    public tagName: string,
    parentNode: Node | null,
    attributes: [string, string][],
    key: typeof CTOR_KEY,
  ) {
    super(
      tagName,
      NodeType.ELEMENT_NODE,
      parentNode,
      key,
    );

    for (const attr of attributes) {
      this.setAttribute(attr[0], attr[1]);

      switch (attr[0]) {
        case "class":
          this.#classList.value = attr[1];
          break;
        case "id":
          this.#currentId = attr[1];
          break;
      }
    }

    this.tagName = this.nodeName = tagName.toUpperCase();
    this.localName = tagName.toLowerCase();
  }

  _shallowClone(): Node {
    // FIXME: This attribute copying needs to also be fixed in other
    // elements that override _shallowClone like <template>
    const attributes: [string, string][] = [];
    for (const attribute of this.getAttributeNames()) {
      attributes.push([attribute, this.getAttribute(attribute)!]);
    }
    return new Element(this.nodeName, null, attributes, CTOR_KEY);
  }

  get childElementCount(): number {
    return this._getChildNodesMutator().elementsView().length;
  }

  get className(): string {
    return this.getAttribute("class") ?? "";
  }

  set className(className: string) {
    this.setAttribute("class", className);
    this.#classList.value = className;
  }

  get classList(): DOMTokenList {
    return this.#classList;
  }

  get outerHTML(): string {
    const tagName = this.tagName.toLowerCase();
    let out = "<" + tagName;

    out += getElementAttributesString(this);

    // Special handling for void elements
    switch (tagName) {
      case "area":
      case "base":
      case "br":
      case "col":
      case "embed":
      case "hr":
      case "img":
      case "input":
      case "link":
      case "meta":
      case "param":
      case "source":
      case "track":
      case "wbr":
        out += ">";
        break;

      default:
        out += ">" + this.innerHTML + `</${tagName}>`;
        break;
    }

    return out;
  }

  set outerHTML(html: string) {
    // TODO: Someday...
  }

  get innerHTML(): string {
    return getInnerHtmlFromNodes(this.childNodes, this.tagName);
  }

  set innerHTML(html: string) {
    // Remove all children
    for (const child of this.childNodes) {
      child._setParent(null);
    }

    const mutator = this._getChildNodesMutator();
    mutator.splice(0, this.childNodes.length);

    // Parse HTML into new children
    if (html.length) {
      const parsed = fragmentNodesFromString(html);
      mutator.push(...parsed.childNodes[0].childNodes);

      for (const child of this.childNodes) {
        child._setParent(this);
        child._setOwnerDocument(this.ownerDocument);
      }
    }
  }

  get innerText(): string {
    return this.textContent;
  }

  set innerText(text: string) {
    this.textContent = text;
  }

  get children(): HTMLCollection {
    return this._getChildNodesMutator().elementsView();
  }

  get id(): string {
    return this.#currentId || "";
  }

  set id(id: string) {
    this.setAttribute("id", this.#currentId = id);
  }

  getAttributeNames(): string[] {
    return this.attributes[getNamedNodeMapAttrNamesSym]();
  }

  getAttribute(name: string): string | null {
    return this.attributes[getNamedNodeMapValueSym](name.toLowerCase()) ?? null;
  }

  setAttribute(rawName: string, value: any) {
    const name = String(rawName?.toLowerCase());
    const strValue = String(value);
    this.attributes[setNamedNodeMapValueSym](name, strValue);

    if (name === "id") {
      this.#currentId = strValue;
    } else if (name === "class") {
      this.#classList.value = strValue;
    }
  }

  removeAttribute(rawName: string) {
    const name = String(rawName?.toLowerCase());
    this.attributes[removeNamedNodeMapAttrSym](name);

    if (name === "class") {
      this.#classList.value = "";
    }
  }

  hasAttribute(name: string): boolean {
    return this.attributes[getNamedNodeMapValueSym](
      String(name?.toLowerCase()),
    ) !== undefined;
  }

  hasAttributeNS(_namespace: string, name: string): boolean {
    // TODO: Use namespace
    return this.attributes[getNamedNodeMapValueSym](
      String(name?.toLowerCase()),
    ) !== undefined;
  }

  replaceWith(...nodes: (Node | string)[]) {
    this._replaceWith(...nodes);
  }

  remove() {
    this._remove();
  }

  append(...nodes: (Node | string)[]) {
    const mutator = this._getChildNodesMutator();
    mutator.push(...nodesAndTextNodes(nodes, this));
  }

  prepend(...nodes: (Node | string)[]) {
    const mutator = this._getChildNodesMutator();
    mutator.splice(0, 0, ...nodesAndTextNodes(nodes, this));
  }

  before(...nodes: (Node | string)[]) {
    if (this.parentNode) {
      insertBeforeAfter(this, nodes, true);
    }
  }

  after(...nodes: (Node | string)[]) {
    if (this.parentNode) {
      insertBeforeAfter(this, nodes, false);
    }
  }

  get firstElementChild(): Element | null {
    const elements = this._getChildNodesMutator().elementsView();
    return elements[0] ?? null;
  }

  get lastElementChild(): Element | null {
    const elements = this._getChildNodesMutator().elementsView();
    return elements[elements.length - 1] ?? null;
  }

  get nextElementSibling(): Element | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const mutator = parent._getChildNodesMutator();
    const index = mutator.indexOfElementsView(this);
    const elements = mutator.elementsView();
    return elements[index + 1] ?? null;
  }

  get previousElementSibling(): Element | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const mutator = parent._getChildNodesMutator();
    const index = mutator.indexOfElementsView(this);
    const elements = mutator.elementsView();
    return elements[index - 1] ?? null;
  }

  querySelector(selectors: string): Element | null {
    if (!this.ownerDocument) {
      throw new Error("Element must have an owner document");
    }

    return this.ownerDocument!._nwapi.first(selectors, this);
  }

  querySelectorAll(selectors: string): NodeList {
    if (!this.ownerDocument) {
      throw new Error("Element must have an owner document");
    }

    const nodeList = new NodeList();
    const mutator = nodeList[nodeListMutatorSym]();
    mutator.push(...this.ownerDocument!._nwapi.select(selectors, this));

    return nodeList;
  }

  matches(selectorString: string): boolean {
    return this.ownerDocument!._nwapi.match(selectorString, this);
  }

  // TODO: DRY!!!
  getElementById(id: string): Element | null {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        if ((<Element> child).id === id) {
          return <Element> child;
        }

        const search = (<Element> child).getElementById(id);
        if (search) {
          return search;
        }
      }
    }

    return null;
  }

  getElementsByTagName(tagName: string): Element[] {
    const fixCaseTagName = tagName.toUpperCase();

    if (fixCaseTagName === "*") {
      return <Element[]> this._getElementsByTagNameWildcard([]);
    } else {
      return <Element[]> this._getElementsByTagName(tagName.toUpperCase(), []);
    }
  }

  _getElementsByTagNameWildcard(search: Node[]): Node[] {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        search.push(child);
        (<Element> child)._getElementsByTagNameWildcard(search);
      }
    }

    return search;
  }

  _getElementsByTagName(tagName: string, search: Node[]): Node[] {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        if ((<Element> child).tagName === tagName) {
          search.push(child);
        }

        (<Element> child)._getElementsByTagName(tagName, search);
      }
    }

    return search;
  }

  getElementsByClassName(className: string): Element[] {
    return <Element[]> getElementsByClassName(this, className, []);
  }

  getElementsByTagNameNS(_namespace: string, localName: string): Element[] {
    // TODO: Use namespace
    return this.getElementsByTagName(localName);
  }
}

UtilTypes.Element = Element;
