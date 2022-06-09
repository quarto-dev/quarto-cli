import { CTOR_KEY } from "../constructor-lock.ts";
import { fragmentNodesFromString } from "../deserialize.ts";
import { Node, NodeType, Text, Comment } from "./node.ts";
import { NodeList, nodeListMutatorSym } from "./node-list.ts";
import { HTMLCollection, HTMLCollectionMutator, HTMLCollectionMutatorSym } from "./html-collection.ts";

export class DOMTokenList extends Set<string> {
  #onChange: (className: string) => void;

  constructor(onChange: (className: string) => void) {
    super();
    this.#onChange = onChange;
  }

  add(token: string): this {
    if (token === "" || /[\t\n\f\r ]/.test(token)) {
      throw new Error(`DOMTokenList.add: Invalid class token "${token}"`);
    }
    super.add(token);
    this.#onChange([...this].join(" "));
    return this;
  }

  clear() {
    super.clear();
    this.#onChange("");
  }

  remove(...tokens: string[]): this {
    for (const token of tokens) {
      super.delete(token)
    }
    this.#onChange([...this].join(" "));
    return this;
  }

  delete(token: string): boolean {
    const deleted = super.delete(token);
    if (deleted) {
      this.#onChange([...this].join(" "));
    }
    return deleted;
  }

  contains(token: string): boolean {
    return this.has(token);
  }

  _update(value: string | null) {
    // Using super.clear() and super.add() rather than the overriden methods so
    // onChange doesn't fire while updating.
    super.clear();
    if (value !== null) {
      for (const token of value.split(/[\t\n\f\r ]+/g)) {
        // The only empty strings resulting from splitting should correspond to
        // whitespace at either end of `value`.
        if (token === "") continue;
        super.add(token);
      }
    }
  }
}

export class Attr {
  #namedNodeMap: NamedNodeMap | null = null;
  #name: string = "";

  constructor(map: NamedNodeMap, name: string, key: typeof CTOR_KEY) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor");
    }

    this.#name = name;
    this.#namedNodeMap = map;
  }

  get name() {
    return this.#name;
  }

  get value() {
    return (<{[attribute: string]: string}> <unknown> this.#namedNodeMap)[this.#name];
  }
}

export class NamedNodeMap {
  #attrObjCache: {
    [attribute: string]: Attr;
  } = {};

  private newAttr(attribute: string): Attr {
    return new Attr(this, attribute, CTOR_KEY);
  }

  getNamedItem(attribute: string) {
    return this.#attrObjCache[attribute] ?? (this.#attrObjCache[attribute] = this.newAttr(attribute));
  }

  setNamedItem(...args: any) {
    // TODO
  }
}

export class Element extends Node {
  #classList = new DOMTokenList((className) => {
    if (this.hasAttribute("class") || className !== "") {
      this.attributes["class"] = className;
    }
  });
  public attributes: NamedNodeMap & {[attribute: string]: string} = <any> new NamedNodeMap();

  #currentId = "";

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
      this.attributes[attr[0]] = attr[1];

      switch (attr[0]) {
        case "class":
          this.#classList._update(attr[1]);
          break;
        case "id":
          this.#currentId = attr[1];
          break;
      }
    }

    this.tagName = this.nodeName = tagName.toUpperCase();
  }

  _shallowClone(): Node {
    const attributes: [string, string][] = [];
    for (const attribute of this.getAttributeNames()) {
      attributes.push([attribute, this.attributes[attribute]])
    }
    return new Element(this.nodeName, null, attributes, CTOR_KEY);
  }

  get childElementCount(): number {
    let count = 0;
    for (const { nodeType } of this.childNodes) {
      if (nodeType === NodeType.ELEMENT_NODE) {
        count++;
      }
    }
    return count;
  }

  get className(): string {
    return this.getAttribute("class") ?? "";
  }

  get classList(): DOMTokenList {
    return this.#classList;
  }

  set className(className: string) {
    this.setAttribute("class", className);
    this.#classList._update(className);
  }

  get outerHTML(): string {
    const tagName = this.tagName.toLowerCase();
    const attributes = this.attributes;
    let out = "<" + tagName;

    for (const attribute of this.getAttributeNames()) {
      out += ` ${ attribute.toLowerCase() }`;

      // escaping: https://html.spec.whatwg.org/multipage/parsing.html#escapingString
      if (attributes[attribute] != null) {
        out += `="${
          attributes[attribute]
              .replace(/&/g, "&amp;")
              .replace(/\xA0/g, "&nbsp;")
              .replace(/"/g, "&quot;")
        }"`;
      }
    }

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
        out += ">" + this.innerHTML + `</${ tagName }>`;
        break;
    }

    return out;
  }

  set outerHTML(html: string) {
    // TODO: Someday...
  }

  get innerHTML(): string {
    let out = "";

    for (const child of this.childNodes) {
      switch (child.nodeType) {
        case NodeType.ELEMENT_NODE:
          out += (child as Element).outerHTML;
          break;

        case NodeType.COMMENT_NODE:
          out += `<!--${ (child as Comment).data }-->`;
          break;

        case NodeType.TEXT_NODE:
          // Special handling for rawtext-like elements.
          switch (this.tagName.toLowerCase()) {
            case "style":
            case "script":
            case "xmp":
            case "iframe":
            case "noembed":
            case "noframes":
            case "plaintext":
              out += (child as Text).data;
              break;

            default:
              // escaping: https://html.spec.whatwg.org/multipage/parsing.html#escapingString
              out += (child as Text).data
                .replace(/&/g, "&amp;")
                .replace(/\xA0/g, "&nbsp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              break;
          }

          break;
      }
    }

    return out;
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
    this.setAttribute(id, this.#currentId = id);
  }

  getAttributeNames(): string[] {
    return Object.getOwnPropertyNames(this.attributes);
  }

  getAttribute(name: string): string | null {
    return this.attributes[name?.toLowerCase()] ?? null;
  }

  setAttribute(rawName: string, value: any) {
    const name = rawName?.toLowerCase();
    const strValue = String(value);
    this.attributes[name] = strValue;

    if (name === "id") {
      this.#currentId = strValue;
    } else if (name === "class") {
      this.#classList._update(strValue);
    }
  }

  removeAttribute(rawName: string) {
    const name = rawName?.toLowerCase();
    delete this.attributes[name];
    if (name === "class") {
      this.#classList._update(null);
    }
  }

  hasAttribute(name: string): boolean {
    return this.attributes.hasOwnProperty(name?.toLowerCase());
  }

  hasAttributeNS(_namespace: string, name: string): boolean {
    // TODO: Use namespace
    return this.attributes.hasOwnProperty(name?.toLowerCase());
  }

  get firstElementChild(): Element | null {
    for (const node of this.childNodes) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return <Element> node; 
      }
    }

    return null;
  }

  get lastElementChild(): Element | null {
    const { childNodes } = this;
    for (let i = childNodes.length - 1; i >= 0; i--) {
      const node = childNodes[i];
      if (node.nodeType === Node.ELEMENT_NODE) {
        return <Element> node;
      }
    }

    return null;
  }

  get nextElementSibling(): Element | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const index = parent._getChildNodesMutator().indexOf(this);
    const childNodes = parent.childNodes;
    let next: Element | null = null;

    for (let i = index + 1; i < childNodes.length; i++) {
      const sibling = childNodes[i];

      if (sibling.nodeType === NodeType.ELEMENT_NODE) {
        next = <Element> sibling;
        break;
      }
    }

    return next;
  }

  get previousElementSibling(): Element | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const index = parent._getChildNodesMutator().indexOf(this);
    const childNodes = parent.childNodes;
    let prev: Element | null = null;

    for (let i = index - 1; i >= 0; i--) {
      const sibling = childNodes[i];

      if (sibling.nodeType === NodeType.ELEMENT_NODE) {
        prev = <Element> sibling;
        break;
      }
    }

    return prev;
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
    mutator.push(...this.ownerDocument!._nwapi.select(selectors, this))

    return nodeList;
  }

  matches(selectorString: string): boolean {
    return this.ownerDocument!._nwapi.match(selectorString, this)
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
    return <Element[]> this._getElementsByTagName(tagName.toUpperCase(), []);
  }

  private _getElementsByTagNameWildcard(search: Node[]): Node[] {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        search.push(child);
        (<Element> child)._getElementsByTagNameWildcard(search);
      }
    }

    return search;
  }

  private _getElementsByTagName(tagName: string, search: Node[]): Node[] {
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
    return <Element[]> this._getElementsByClassName(className, []);
  }

  getElementsByTagNameNS(_namespace: string, localName: string): Element[] {
    // TODO: Use namespace
    return this.getElementsByTagName(localName);
  }

  private _getElementsByClassName(className: string, search: Node[]): Node[] {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        if ((<Element> child).classList.contains(className)) {
          search.push(child);
        }

        (<Element> child)._getElementsByClassName(className, search);
      }
    }

    return search;
  }
}

