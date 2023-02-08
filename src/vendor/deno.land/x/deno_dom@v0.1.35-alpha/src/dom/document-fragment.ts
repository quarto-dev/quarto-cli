import { CTOR_KEY } from "../constructor-lock.ts";
import { HTMLCollection } from "./html-collection.ts";
import { NodeList, nodeListMutatorSym } from "./node-list.ts";
import { Node, nodesAndTextNodes, NodeType } from "./node.ts";
import { Element } from "./element.ts";
import {
  customByClassNameSym,
  customByTagNameSym,
} from "./selectors/custom-api.ts";
import { getElementsByClassName } from "./utils.ts";
import UtilTypes from "./utils-types.ts";

export class DocumentFragment extends Node {
  constructor() {
    super(
      "#document-fragment",
      NodeType.DOCUMENT_FRAGMENT_NODE,
      null,
      CTOR_KEY,
    );
  }

  get childElementCount(): number {
    return this._getChildNodesMutator().elementsView().length;
  }

  get children(): HTMLCollection {
    return this._getChildNodesMutator().elementsView();
  }

  get firstElementChild(): Element | null {
    const elements = this._getChildNodesMutator().elementsView();
    return elements[0] ?? null;
  }

  get lastElementChild(): Element | null {
    const elements = this._getChildNodesMutator().elementsView();
    return elements[elements.length - 1] ?? null;
  }

  append(...nodes: (Node | string)[]) {
    const mutator = this._getChildNodesMutator();
    mutator.push(...nodesAndTextNodes(nodes, this));
  }

  prepend(...nodes: (Node | string)[]) {
    const mutator = this._getChildNodesMutator();
    mutator.splice(0, 0, ...nodesAndTextNodes(nodes, this));
  }

  replaceChildren(...nodes: (Node | string)[]) {
    const mutator = this._getChildNodesMutator();

    // Remove all current child nodes
    for (const child of this.childNodes) {
      child._setParent(null);
    }
    mutator.splice(0, this.childNodes.length);

    // Add new children
    mutator.splice(0, 0, ...nodesAndTextNodes(nodes, this));
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

  querySelector(selectors: string): Element | null {
    if (!this.ownerDocument) {
      throw new Error("DocumentFragment must have an owner document");
    }

    return this.ownerDocument!._nwapi.first(selectors, this as any as Element);
  }

  querySelectorAll(selectors: string): NodeList {
    if (!this.ownerDocument) {
      throw new Error("DocumentFragment must have an owner document");
    }

    const nodeList = new NodeList();
    const mutator = nodeList[nodeListMutatorSym]();
    mutator.push(
      ...this.ownerDocument!._nwapi.select(selectors, this as any as Element),
    );

    return nodeList;
  }
}

UtilTypes.DocumentFragment = DocumentFragment;

// Add required methods just for Sizzle.js selector to work on
// DocumentFragment's
function documentFragmentGetElementsByTagName(
  this: DocumentFragment,
  tagName: string,
): Node[] {
  const search: Node[] = [];

  if (tagName === "*") {
    return documentFragmentGetElementsByTagNameWildcard(this, search);
  }

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

function documentFragmentGetElementsByClassName(
  this: DocumentFragment,
  className: string,
) {
  return getElementsByClassName(this, className, []);
}

function documentFragmentGetElementsByTagNameWildcard(
  fragment: DocumentFragment,
  search: Node[],
): Node[] {
  for (const child of fragment.childNodes) {
    if (child.nodeType === NodeType.ELEMENT_NODE) {
      search.push(child);
      (<Element> child)._getElementsByTagNameWildcard(search);
    }
  }

  return search;
}

(DocumentFragment as any).prototype[customByTagNameSym] =
  documentFragmentGetElementsByTagName;
(DocumentFragment as any).prototype[customByClassNameSym] =
  documentFragmentGetElementsByClassName;
