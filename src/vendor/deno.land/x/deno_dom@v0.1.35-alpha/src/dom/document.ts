import { CTOR_KEY } from "../constructor-lock.ts";
import { Comment, Node, NodeType, Text } from "./node.ts";
import { NodeList, nodeListMutatorSym } from "./node-list.ts";
import { Element } from "./element.ts";
import { DocumentFragment } from "./document-fragment.ts";
import { HTMLTemplateElement } from "./elements/html-template-element.ts";
import { getSelectorEngine, SelectorApi } from "./selectors/selectors.ts";
import { getElementsByClassName } from "./utils.ts";
import UtilTypes from "./utils-types.ts";

export class DOMImplementation {
  constructor(key: typeof CTOR_KEY) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor.");
    }
  }

  createDocument() {
    throw new Error("Unimplemented"); // TODO
  }

  createHTMLDocument(titleStr?: string): HTMLDocument {
    titleStr += "";

    const doc = new HTMLDocument(CTOR_KEY);

    const docType = new DocumentType("html", "", "", CTOR_KEY);
    doc.appendChild(docType);

    const html = new Element("html", doc, [], CTOR_KEY);
    html._setOwnerDocument(doc);

    const head = new Element("head", html, [], CTOR_KEY);
    const body = new Element("body", html, [], CTOR_KEY);

    const title = new Element("title", head, [], CTOR_KEY);
    const titleText = new Text(titleStr);
    title.appendChild(titleText);

    doc.head = head;
    doc.body = body;

    return doc;
  }

  createDocumentType(
    qualifiedName: string,
    publicId: string,
    systemId: string,
  ): DocumentType {
    const doctype = new DocumentType(
      qualifiedName,
      publicId,
      systemId,
      CTOR_KEY,
    );

    return doctype;
  }
}

export class DocumentType extends Node {
  #qualifiedName = "";
  #publicId = "";
  #systemId = "";

  constructor(
    name: string,
    publicId: string,
    systemId: string,
    key: typeof CTOR_KEY,
  ) {
    super(
      "html",
      NodeType.DOCUMENT_TYPE_NODE,
      null,
      key,
    );

    this.#qualifiedName = name;
    this.#publicId = publicId;
    this.#systemId = systemId;
  }

  get name() {
    return this.#qualifiedName;
  }

  get publicId() {
    return this.#publicId;
  }

  get systemId() {
    return this.#systemId;
  }

  _shallowClone(): Node {
    return new DocumentType(
      this.#qualifiedName,
      this.#publicId,
      this.#systemId,
      CTOR_KEY,
    );
  }
}

export interface ElementCreationOptions {
  is: string;
}

export type VisibilityState = "visible" | "hidden" | "prerender";
export type NamespaceURI =
  | "http://www.w3.org/1999/xhtml"
  | "http://www.w3.org/2000/svg"
  | "http://www.w3.org/1998/Math/MathML";

export class Document extends Node {
  public head: Element = <Element> <unknown> null;
  public body: Element = <Element> <unknown> null;
  public implementation: DOMImplementation;

  #lockState = false;
  #documentURI = "about:blank"; // TODO
  #title = "";
  #nwapi: SelectorApi | null = null;

  constructor() {
    super(
      "#document",
      NodeType.DOCUMENT_NODE,
      null,
      CTOR_KEY,
    );

    this.implementation = new DOMImplementation(CTOR_KEY);
  }

  _shallowClone(): Node {
    return new Document();
  }

  // Expose the document's NWAPI for Element's access to
  // querySelector/querySelectorAll
  get _nwapi() {
    return this.#nwapi || (this.#nwapi = getSelectorEngine()(this));
  }

  get documentURI() {
    return this.#documentURI;
  }

  get title() {
    return this.querySelector("title")?.textContent || "";
  }

  get cookie() {
    return ""; // TODO
  }

  set cookie(newCookie: string) {
    // TODO
  }

  get visibilityState(): VisibilityState {
    return "visible";
  }

  get hidden() {
    return false;
  }

  get compatMode(): string {
    return "CSS1Compat";
  }

  get documentElement(): Element | null {
    for (const node of this.childNodes) {
      if (node.nodeType === NodeType.ELEMENT_NODE) {
        return <Element> node;
      }
    }

    return null;
  }

  get doctype(): DocumentType | null {
    for (const node of this.childNodes) {
      if (node.nodeType === NodeType.DOCUMENT_TYPE_NODE) {
        return <DocumentType> node;
      }
    }

    return null;
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

  appendChild(child: Node): Node {
    super.appendChild(child);
    child._setOwnerDocument(this);
    return child;
  }

  createElement(tagName: string, options?: ElementCreationOptions): Element {
    tagName = tagName.toUpperCase();

    switch (tagName) {
      case "TEMPLATE": {
        const frag = new DocumentFragment();
        const elm = new HTMLTemplateElement(
          null,
          [],
          CTOR_KEY,
          frag,
        );
        elm._setOwnerDocument(this);
        return elm;
      }

      default: {
        const elm = new Element(tagName, null, [], CTOR_KEY);
        elm._setOwnerDocument(this);
        return elm;
      }
    }
  }

  createElementNS(
    namespace: NamespaceURI,
    qualifiedName: string,
    options?: ElementCreationOptions,
  ): Element {
    if (namespace === "http://www.w3.org/1999/xhtml") {
      return this.createElement(qualifiedName, options);
    } else {
      throw new Error(
        `createElementNS: "${namespace}" namespace unimplemented`,
      ); // TODO
    }
  }

  createTextNode(data?: string): Text {
    return new Text(data);
  }

  createComment(data?: string): Comment {
    return new Comment(data);
  }

  createDocumentFragment(): DocumentFragment {
    const fragment = new DocumentFragment();
    fragment._setOwnerDocument(this);
    return fragment;
  }

  importNode(node: Node, deep: boolean = false) {
    const copy = node.cloneNode(deep);

    copy._setOwnerDocument(this);

    return copy;
  }

  adoptNode(node: Node) {
    if (node instanceof Document) {
      throw new DOMException(
        "Adopting a Document node is not supported.",
        "NotSupportedError",
      );
    }
    node._setParent(null);
    node._setOwnerDocument(this);

    return node;
  }

  querySelector(selectors: string): Element | null {
    return this._nwapi.first(selectors, this);
  }

  querySelectorAll(selectors: string): NodeList {
    const nodeList = new NodeList();
    const mutator = nodeList[nodeListMutatorSym]();
    mutator.push(...this._nwapi.select(selectors, this));

    return nodeList;
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
    if (tagName === "*") {
      return this.documentElement
        ? <Element[]> this._getElementsByTagNameWildcard(
          this.documentElement,
          [],
        )
        : [];
    } else {
      return <Element[]> this._getElementsByTagName(tagName.toUpperCase(), []);
    }
  }

  private _getElementsByTagNameWildcard(node: Node, search: Node[]): Node[] {
    for (const child of this.childNodes) {
      if (child.nodeType === NodeType.ELEMENT_NODE) {
        search.push(child);
        (<any> child)._getElementsByTagNameWildcard(search);
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

        (<any> child)._getElementsByTagName(tagName, search);
      }
    }

    return search;
  }

  getElementsByTagNameNS(_namespace: string, localName: string): Element[] {
    return this.getElementsByTagName(localName);
  }

  getElementsByClassName(className: string): Element[] {
    return <Element[]> getElementsByClassName(this, className, []);
  }

  hasFocus(): boolean {
    return true;
  }
}

export class HTMLDocument extends Document {
  constructor(key: typeof CTOR_KEY) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor.");
    }
    super();
  }

  _shallowClone(): Node {
    return new HTMLDocument(CTOR_KEY);
  }
}

UtilTypes.Document = Document;
