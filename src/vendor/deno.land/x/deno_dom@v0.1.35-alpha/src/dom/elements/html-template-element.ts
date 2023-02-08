import { Node } from "../node.ts";
import { Element } from "../element.ts";
import { Document } from "../document.ts";
import { DocumentFragment } from "../document-fragment.ts";
import { getElementAttributesString, getInnerHtmlFromNodes } from "../utils.ts";
import { fragmentNodesFromString } from "../../deserialize.ts";
import { CTOR_KEY } from "../../constructor-lock.ts";

export class HTMLTemplateElement extends Element {
  /**
   * This blocks access to the .#contents property when the
   * super() constructor is running which invokes (our
   * overridden) _setParent() method. Without it, we get
   * the following error thrown:
   *
   *   TypeError: Cannot read private member #content from
   *   an object whose class did not declare it
   *
   * FIXME: Maybe find a cleaner way to do this
   */
  private __contentIsSet = false;
  #content: DocumentFragment | null = null;

  constructor(
    parentNode: Node | null,
    attributes: [string, string][],
    key: typeof CTOR_KEY,
    content: DocumentFragment,
  ) {
    super(
      "TEMPLATE",
      parentNode,
      attributes,
      key,
    );

    this.#content = content;
    this.__contentIsSet = true;
  }

  get content(): DocumentFragment {
    return this.#content!;
  }

  override _setOwnerDocument(document: Document | null) {
    super._setOwnerDocument(document);

    if (this.__contentIsSet) {
      this.content._setOwnerDocument(document);
    }
  }

  override _shallowClone(): HTMLTemplateElement {
    const frag = new DocumentFragment();
    const attributes = this
      .getAttributeNames()
      .map((name) => [name, this.getAttribute(name)!] as [string, string]);
    return new HTMLTemplateElement(null, attributes, CTOR_KEY, frag);
  }

  override cloneNode(deep = false): HTMLTemplateElement {
    const newNode = super.cloneNode(deep) as HTMLTemplateElement;

    if (deep) {
      const destContent = newNode.content;
      for (const child of this.content.childNodes) {
        destContent.appendChild(child.cloneNode(deep));
      }
    }

    return newNode;
  }

  get innerHTML(): string {
    return getInnerHtmlFromNodes(this.content.childNodes, "template");
  }

  // Replace children in the `.content`
  set innerHTML(html: string) {
    const content = this.content;

    // Remove all children
    for (const child of content.childNodes) {
      child._setParent(null);
    }

    const mutator = content._getChildNodesMutator();
    mutator.splice(0, content.childNodes.length);

    // Parse HTML into new children
    if (html.length) {
      const parsed = fragmentNodesFromString(html);
      mutator.push(...parsed.childNodes[0].childNodes);

      for (const child of content.childNodes) {
        child._setParent(content);
        child._setOwnerDocument(content.ownerDocument);
      }
    }
  }

  get outerHTML(): string {
    return `<template${
      getElementAttributesString(this)
    }>${this.innerHTML}</template>`;
  }
}
