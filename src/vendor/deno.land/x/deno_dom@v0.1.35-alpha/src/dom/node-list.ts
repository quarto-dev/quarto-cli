import { Node } from "./node.ts";
import { HTMLCollection } from "./html-collection.ts";

const NodeListFakeClass: any = (() => {
  return class NodeList {
    constructor() {
      throw new TypeError("Illegal constructor");
    }

    static [Symbol.hasInstance](value: any) {
      return value.constructor === NodeListClass;
    }
  };
})();

export const nodeListMutatorSym = Symbol();
const nodeListCachedMutator = Symbol();

// Array methods that we need for NodeList mutator implementation
const { push, splice, slice, indexOf, filter } = Array.prototype;

// Implementation of a NodeList mutator
class NodeListMutatorImpl {
  // There should only ever be one elementView per element. Element views
  // are basically just the source of HTMLCollections/.children properties
  // on elements that are always in sync with their .childNodes counterpart.
  elementViews: any[][] = [];

  constructor(
    public arrayInstance: any[],
  ) {}

  push(...items: any[]) {
    // Copy the new items to the element view (if any)
    for (const view of this.elementViews) {
      for (const item of items) {
        if (item.nodeType === Node.ELEMENT_NODE) {
          push.call(view, item);
        }
      }
    }

    return push.call(this.arrayInstance, ...items);
  }

  splice(index: number, deleteCount = 0, ...items: any[]) {
    // Delete and insert new elements in an element view (if any)
    for (const view of this.elementViews) {
      const toDelete = filter.call(
        slice.call(this.arrayInstance, index, index + deleteCount),
        (item) => item.nodeType === Node.ELEMENT_NODE,
      );

      const toInsert = items.filter((item) =>
        item.nodeType === Node.ELEMENT_NODE
      );

      // Find where to start splicing in the element view
      let elementViewSpliceIndex = -1;
      for (let idx = index; idx < this.arrayInstance.length; idx++) {
        const item = this.arrayInstance[idx];

        if (item.nodeType === Node.ELEMENT_NODE) {
          elementViewSpliceIndex = indexOf.call(view, item);
          break;
        }
      }

      // If no element is found just do everything at the end
      // of the view
      if (elementViewSpliceIndex === -1) {
        elementViewSpliceIndex = view.length;
      }

      if (toDelete.length) {
        splice.call(view, elementViewSpliceIndex, toDelete.length);
      }

      // Finally, insert all the found elements
      splice.call(view, elementViewSpliceIndex, 0, ...toInsert);
    }

    return splice.call(this.arrayInstance, index, deleteCount, ...items);
  }

  indexOf(item: any, fromIndex = 0) {
    return indexOf.call(this.arrayInstance, item, fromIndex);
  }

  indexOfElementsView(item: any, fromIndex = 0) {
    return indexOf.call(this.elementsView(), item, fromIndex);
  }

  // Return the elements-only view for this NodeList. Creates one if
  // it doesn't already exist.
  elementsView() {
    let view = this.elementViews[0];

    if (!view) {
      view = new HTMLCollection() as any as any[];
      this.elementViews.push(view);
      push.call(
        view,
        ...filter.call(
          this.arrayInstance,
          (item) => item.nodeType === Node.ELEMENT_NODE,
        ),
      );
    }

    return view;
  }
}

// We define the `NodeList` inside a closure to ensure that its
// `.name === "NodeList"` property stays intact, as we need to manipulate
// its prototype and completely change its TypeScript-recognized type.
const NodeListClass: any = (() => {
  // @ts-ignore
  class NodeList extends Array<Node> {
    // @ts-ignore
    forEach(
      cb: (node: Node, index: number, nodeList: Node[]) => void,
      thisArg: NodeList | undefined = undefined,
    ) {
      super.forEach(cb, thisArg);
    }

    item(index: number): Node | null {
      return this[index] ?? null;
    }

    [nodeListMutatorSym]() {
      const cachedMutator = (this as any)[nodeListCachedMutator];

      if (cachedMutator) {
        return cachedMutator;
      } else {
        const cachedMutator = new NodeListMutatorImpl(this);
        (this as any)[nodeListCachedMutator] = cachedMutator;
        return cachedMutator;
      }
    }

    toString() {
      return "[object NodeList]";
    }
  }

  return NodeList;
})();

for (
  const staticMethod of [
    "from",
    "isArray",
    "of",
  ]
) {
  NodeListClass[staticMethod] = undefined;
}

for (
  const instanceMethod of [
    "concat",
    "copyWithin",
    "every",
    "fill",
    "filter",
    "find",
    "findIndex",
    "flat",
    "flatMap",
    "includes",
    "indexOf",
    "join",
    "lastIndexOf",
    "map",
    "pop",
    "push",
    "reduce",
    "reduceRight",
    "reverse",
    "shift",
    "slice",
    "some",
    "sort",
    "splice",
    "toLocaleString",
    "unshift",
  ]
) {
  NodeListClass.prototype[instanceMethod] = undefined;
}

export interface NodeList {
  new (): NodeList;
  readonly [index: number]: Node;
  readonly length: number;
  [Symbol.iterator](): Generator<Node>;

  item(index: number): Node;
  forEach(
    cb: (node: Node, index: number, nodeList: Node[]) => void,
    thisArg?: NodeList | undefined,
  ): void;
  [nodeListMutatorSym](): NodeListMutator;
}

export type NodeListPublic = Omit<NodeList, typeof nodeListMutatorSym>;
export interface NodeListMutator {
  push(...nodes: Node[]): number;
  splice(start: number, deleteCount?: number, ...items: Node[]): Node[];
  indexOf(node: Node, fromIndex?: number | undefined): number;
  indexOfElementsView(node: Node, fromIndex?: number | undefined): number;
  elementsView(): HTMLCollection;
}

export const NodeList = <NodeList> NodeListClass;
export const NodeListPublic = <NodeListPublic> NodeListFakeClass;
