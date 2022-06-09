import { CTOR_KEY } from "../constructor-lock.ts";
import { NodeList, NodeListMutator, nodeListMutatorSym } from "./node-list.ts";
import type { Element } from "./element.ts";
import type { Document } from "./document.ts";

export class EventTarget {
  addEventListener() {
    // TODO
  }

  removeEventListener() {
    // TODO
  }

  dispatchEvent() {
    // TODO
  }
}

export enum NodeType {
  ELEMENT_NODE = 1,
  ATTRIBUTE_NODE = 2,
  TEXT_NODE = 3,
  CDATA_SECTION_NODE = 4,
  ENTITY_REFERENCE_NODE = 5,
  ENTITY_NODE = 6,
  PROCESSING_INSTRUCTION_NODE = 7,
  COMMENT_NODE = 8,
  DOCUMENT_NODE = 9,
  DOCUMENT_TYPE_NODE = 10,
  DOCUMENT_FRAGMENT_NODE = 11,
  NOTATION_NODE = 12,
}

const nodesAndTextNodes = (nodes: (Node | unknown)[], parentNode: Node) => {
  return nodes.map(n => {
    const node: Node = n instanceof Node
      ? n
      : new Text("" + n);

    // Remove from parentNode (if any)
    node.remove();

    // Set new parent
    node._setParent(parentNode, true);
    return node;
  });
}

export class Node extends EventTarget {
  public nodeValue: string | null;
  public childNodes: NodeList;
  public parentNode: Node | null = null;
  public parentElement: Element | null;
  #childNodesMutator: NodeListMutator;
  #ownerDocument: Document | null = null;
  private _ancestors = new Set<Node>();

  // Instance constants defined after Node
  // class body below to avoid clutter
  static ELEMENT_NODE = NodeType.ELEMENT_NODE;
  static ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE;
  static TEXT_NODE = NodeType.TEXT_NODE;
  static CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE;
  static ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE;
  static ENTITY_NODE = NodeType.ENTITY_NODE;
  static PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE;
  static COMMENT_NODE = NodeType.COMMENT_NODE;
  static DOCUMENT_NODE = NodeType.DOCUMENT_NODE;
  static DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE;
  static DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE;
  static NOTATION_NODE = NodeType.NOTATION_NODE;

  constructor(
    public nodeName: string,
    public nodeType: NodeType,
    parentNode: Node | null,
    key: typeof CTOR_KEY,
  ) {
    if (key !== CTOR_KEY) {
      throw new TypeError("Illegal constructor.");
    }
    super();

    this.nodeValue = null;
    this.childNodes = new NodeList();
    this.#childNodesMutator = this.childNodes[nodeListMutatorSym]();
    this.parentElement = <Element> parentNode;

    if (parentNode) {
      parentNode.appendChild(this);
    }
  }

  _getChildNodesMutator(): NodeListMutator {
    return this.#childNodesMutator;
  }

  _setParent(newParent: Node | null, force = false) {
    const sameParent = this.parentNode === newParent;
    const shouldUpdateParentAndAncestors = !sameParent || force;

    if (shouldUpdateParentAndAncestors) {
      this.parentNode = newParent;

      if (newParent) {
        if (!sameParent) {
          // If this a document node or another non-element node
          // then parentElement should be set to null
          if (newParent.nodeType === NodeType.ELEMENT_NODE) {
            this.parentElement = newParent as unknown as Element;
          } else {
            this.parentElement = null;
          }

          this._setOwnerDocument(newParent.#ownerDocument);
        }

        // Add parent chain to ancestors
        this._ancestors = new Set(newParent._ancestors);
        this._ancestors.add(newParent);
      } else {
        this.parentElement = null;
        this._ancestors.clear();
      }

      // Update ancestors for child nodes
      for (const child of this.childNodes) {
        child._setParent(this, shouldUpdateParentAndAncestors);
      }
    }
  }

  _assertNotAncestor(child: Node) {
    // Check this child isn't an ancestor
    if (child.contains(this)) {
      throw new DOMException("The new child is an ancestor of the parent");
    }
  }

  _setOwnerDocument(document: Document | null) {
    if (this.#ownerDocument !== document) {
      this.#ownerDocument = document;

      for (const child of this.childNodes) {
        child._setOwnerDocument(document);
      }
    }
  }

  contains(child: Node) {
    return child._ancestors.has(this) || child === this;
  }

  get ownerDocument() {
    return this.#ownerDocument;
  }

  get textContent(): string {
    let out = "";

    for (const child of this.childNodes) {
      switch (child.nodeType) {
        case NodeType.TEXT_NODE:
          out += child.nodeValue;
          break;
        case NodeType.ELEMENT_NODE:
          out += child.textContent;
          break;
      }
    }

    return out;
  }

  set textContent(content: string) {
    for (const child of this.childNodes) {
      child._setParent(null);
    }

    this._getChildNodesMutator().splice(0, this.childNodes.length);
    this.appendChild(new Text(content));
  }

  get firstChild() {
    return this.childNodes[0] || null;
  }

  get lastChild() {
    return this.childNodes[this.childNodes.length - 1] || null;
  }

  hasChildNodes() {
    return this.firstChild !== null;
  }

  cloneNode(deep: boolean = false): this {
    const copy = this._shallowClone();

    copy._setOwnerDocument(this.ownerDocument);

    if (deep) {
      for (const child of this.childNodes) {
        copy.appendChild(child.cloneNode(true));
      }
    }

    return copy as this;
  }

  _shallowClone(): Node {
    throw new Error("Illegal invocation");
  }

  remove() {
    const parent = this.parentNode;

    if (parent) {
      const nodeList = parent._getChildNodesMutator();
      const idx = nodeList.indexOf(this);
      nodeList.splice(idx, 1);
      this._setParent(null);
    }
  }

  appendChild(child: Node): Node {
    return child._appendTo(this);
  }

  _appendTo(parentNode: Node) {
    parentNode._assertNotAncestor(this); // FIXME: Should this really be a method?
    const oldParentNode = this.parentNode;

    // Check if we already own this child
    if (oldParentNode === parentNode) {
      if (parentNode._getChildNodesMutator().indexOf(this) !== -1) {
        return this;
      }
    } else if (oldParentNode) {
      this.remove();
    }

    this._setParent(parentNode, true);
    parentNode._getChildNodesMutator().push(this);

    return this;
  }

  removeChild(child: Node) {
    // Just copy Firefox's error messages
    if (child && typeof child === "object") {
      if (child.parentNode === this) {
        return child.remove();
      } else {
        throw new DOMException("Node.removeChild: The node to be removed is not a child of this node");
      }
    } else {
      throw new TypeError("Node.removeChild: Argument 1 is not an object.");
    }
  }

  replaceChild(newChild: Node, oldChild: Node): Node {
    if (oldChild.parentNode !== this) {
      throw new Error("Old child's parent is not the current node.");
    }

    oldChild.replaceWith(newChild);
    return oldChild;
  }

  private insertBeforeAfter(nodes: (Node | string)[], side: number) {
    const parentNode = this.parentNode!;
    const mutator = parentNode._getChildNodesMutator();
    const index = mutator.indexOf(this);
    nodes = nodesAndTextNodes(nodes, parentNode);

    mutator.splice(index + side, 0, ...(<Node[]> nodes));
  }

  before(...nodes: (Node | string)[]) {
    if (this.parentNode) {
      this.insertBeforeAfter(nodes, 0);
    }
  }

  after(...nodes: (Node | string)[]) {
    if (this.parentNode) {
      this.insertBeforeAfter(nodes, 1);
    }
  }

  insertBefore(newNode: Node, refNode: Node | null): Node {
    this._assertNotAncestor(newNode);
    const mutator = this._getChildNodesMutator();

    if (refNode === null) {
      this.appendChild(newNode);
      return newNode;
    }

    const index = mutator.indexOf(refNode);
    if (index === -1) {
      throw new Error("DOMException: Child to insert before is not a child of this node");
    }

    const oldParentNode = newNode.parentNode;
    newNode._setParent(this, oldParentNode !== this);
    mutator.splice(index, 0, newNode);

    return newNode;
  }

  replaceWith(...nodes: (Node | string)[]) {
    if (this.parentNode) {
      const parentNode = this.parentNode;
      const mutator = parentNode._getChildNodesMutator();
      const index = mutator.indexOf(this);
      nodes = nodesAndTextNodes(nodes, parentNode);

      mutator.splice(index, 1, ...(nodes as Node[]));
      this._setParent(null);
    }
  }

  get nextSibling(): Node | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const index = parent._getChildNodesMutator().indexOf(this);
    const next: Node | null = parent.childNodes[index + 1] || null;

    return next;
  }

  get previousSibling(): Node | null {
    const parent = this.parentNode;

    if (!parent) {
      return null;
    }

    const index = parent._getChildNodesMutator().indexOf(this);
    const prev: Node | null = parent.childNodes[index - 1] || null;

    return prev;
  }

  // Node.compareDocumentPosition()'s bitmask values
  public static DOCUMENT_POSITION_DISCONNECTED = 1 as const;
  public static DOCUMENT_POSITION_PRECEDING = 2 as const;
  public static DOCUMENT_POSITION_FOLLOWING = 4 as const;
  public static DOCUMENT_POSITION_CONTAINS = 8 as const;
  public static DOCUMENT_POSITION_CONTAINED_BY = 16 as const;
  public static DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32 as const;

  /**
   * FIXME: Does not implement attribute node checks
   * ref: https://dom.spec.whatwg.org/#dom-node-comparedocumentposition
   * MDN: https://developer.mozilla.org/en-US/docs/Web/API/Node/compareDocumentPosition
   */
  compareDocumentPosition(other: Node) {
    if (other === this) {
      return 0;
    }

    // Note: major browser implementations differ in their rejection error of
    // non-Node or nullish values so we just copy the most relevant error message
    // from Firefox
    if (!(other instanceof Node)) {
      throw new TypeError("Node.compareDocumentPosition: Argument 1 does not implement interface Node.");
    }

    let node1Root = other;
    let node2Root = this as Node;
    const node1Hierarchy = [node1Root];
    const node2Hierarchy = [node2Root];
    while (node1Root.parentNode ?? node2Root.parentNode) {
      node1Root = node1Root.parentNode ? (node1Hierarchy.push(node1Root.parentNode), node1Root.parentNode) : node1Root;
      node2Root = node2Root.parentNode ? (node2Hierarchy.push(node2Root.parentNode), node2Root.parentNode) : node2Root;
    }

    // Check if they don't share the same root node
    if (node1Root !== node2Root) {
      return Node.DOCUMENT_POSITION_DISCONNECTED
        | Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC
        | Node.DOCUMENT_POSITION_PRECEDING;
    }

    const longerHierarchy = node1Hierarchy.length > node2Hierarchy.length
      ? node1Hierarchy
      : node2Hierarchy;
    const shorterHierarchy = longerHierarchy === node1Hierarchy
      ? node2Hierarchy
      : node1Hierarchy;

    // Check if either is a container of the other
    if (longerHierarchy[longerHierarchy.length - shorterHierarchy.length] === shorterHierarchy[0]) {
      return longerHierarchy === node1Hierarchy
        // other is a child of this
        ? Node.DOCUMENT_POSITION_CONTAINED_BY | Node.DOCUMENT_POSITION_FOLLOWING
        // this is a child of other
        : Node.DOCUMENT_POSITION_CONTAINS | Node.DOCUMENT_POSITION_PRECEDING;
    }

    // Find their first common ancestor and see whether they
    // are preceding or following
    const longerStart = longerHierarchy.length - shorterHierarchy.length;
    for (let i = shorterHierarchy.length - 1; i >= 0; i--) {
      const shorterHierarchyNode = shorterHierarchy[i];
      const longerHierarchyNode = longerHierarchy[longerStart + i];

      // We found the first common ancestor
      if (longerHierarchyNode !== shorterHierarchyNode) {
        const siblings = shorterHierarchyNode.parentNode!._getChildNodesMutator();

        if (siblings.indexOf(shorterHierarchyNode) < siblings.indexOf(longerHierarchyNode)) {
          // Shorter is before longer
          if (shorterHierarchy === node1Hierarchy) {
            // Other is before this
            return Node.DOCUMENT_POSITION_PRECEDING;
          } else {
            // This is before other
            return Node.DOCUMENT_POSITION_FOLLOWING;
          }
        } else {
          // Longer is before shorter
          if (longerHierarchy === node1Hierarchy) {
            // Other is before this
            return Node.DOCUMENT_POSITION_PRECEDING;
          } else {
            // Other is after this
            return Node.DOCUMENT_POSITION_FOLLOWING;
          }
        }
      }
    }

    // FIXME: Should probably throw here because this
    // point should be unreachable code as per the
    // intended logic
    return Node.DOCUMENT_POSITION_FOLLOWING;
  }
}

// Node instance `nodeType` enum constants
export interface Node {
  ELEMENT_NODE: NodeType;
  ATTRIBUTE_NODE: NodeType;
  TEXT_NODE: NodeType;
  CDATA_SECTION_NODE: NodeType;
  ENTITY_REFERENCE_NODE: NodeType;
  ENTITY_NODE: NodeType;
  PROCESSING_INSTRUCTION_NODE: NodeType;
  COMMENT_NODE: NodeType;
  DOCUMENT_NODE: NodeType;
  DOCUMENT_TYPE_NODE: NodeType;
  DOCUMENT_FRAGMENT_NODE: NodeType;
  NOTATION_NODE: NodeType;
}

Node.prototype.ELEMENT_NODE = NodeType.ELEMENT_NODE;
Node.prototype.ATTRIBUTE_NODE = NodeType.ATTRIBUTE_NODE;
Node.prototype.TEXT_NODE = NodeType.TEXT_NODE;
Node.prototype.CDATA_SECTION_NODE = NodeType.CDATA_SECTION_NODE;
Node.prototype.ENTITY_REFERENCE_NODE = NodeType.ENTITY_REFERENCE_NODE;
Node.prototype.ENTITY_NODE = NodeType.ENTITY_NODE;
Node.prototype.PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE;
Node.prototype.COMMENT_NODE = NodeType.COMMENT_NODE;
Node.prototype.DOCUMENT_NODE = NodeType.DOCUMENT_NODE;
Node.prototype.DOCUMENT_TYPE_NODE = NodeType.DOCUMENT_TYPE_NODE;
Node.prototype.DOCUMENT_FRAGMENT_NODE = NodeType.DOCUMENT_FRAGMENT_NODE;
Node.prototype.NOTATION_NODE = NodeType.NOTATION_NODE;

export class CharacterData extends Node {
  constructor(
    public data: string,
    nodeName: string,
    nodeType: NodeType,
    parentNode: Node | null,
    key: typeof CTOR_KEY,
  ) {
    super(
      nodeName,
      nodeType,
      parentNode,
      key,
    );

    this.nodeValue = data;
  }

  get length(): number {
    return this.data.length;
  }

  // TODO: Implement NonDocumentTypeChildNode.nextElementSibling, etc
  // ref: https://developer.mozilla.org/en-US/docs/Web/API/CharacterData
}

export class Text extends CharacterData {
  constructor(
    text: string = "",
  ) {
    super(
      text,
      "#text",
      NodeType.TEXT_NODE,
      null,
      CTOR_KEY,
    );

    this.nodeValue = text;
  }

  _shallowClone(): Node {
    return new Text(this.textContent);
  }

  get textContent(): string {
    return <string> this.nodeValue;
  }
}

export class Comment extends CharacterData {
  constructor(
    text: string = "",
  ) {
    super(
      text,
      "#comment",
      NodeType.COMMENT_NODE,
      null,
      CTOR_KEY,
    );

    this.nodeValue = text;
  }

  _shallowClone(): Node {
    return new Comment(this.textContent);
  }

  get textContent(): string {
    return <string> this.nodeValue;
  }
}

