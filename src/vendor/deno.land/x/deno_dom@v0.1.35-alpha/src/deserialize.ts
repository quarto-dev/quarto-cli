import { parse, parseFrag } from "./parser.ts";
import { CTOR_KEY } from "./constructor-lock.ts";
import { Comment, Node, NodeType, Text } from "./dom/node.ts";
import { DocumentType } from "./dom/document.ts";
import { DocumentFragment } from "./dom/document-fragment.ts";
import { HTMLTemplateElement } from "./dom/elements/html-template-element.ts";
import { Element } from "./dom/element.ts";

export function nodesFromString(html: string): Node {
  const parsed = JSON.parse(parse(html));
  const node = nodeFromArray(parsed, null);

  return node;
}

export function fragmentNodesFromString(html: string): Node {
  const parsed = JSON.parse(parseFrag(html));
  const node = nodeFromArray(parsed, null);

  return node;
}

function nodeFromArray(data: any, parentNode: Node | null): Node {
  // For reference only:
  // type node = [NodeType, nodeName, attributes, node[]]
  //             | [NodeType, characterData]

  // <template> element gets special treatment, until
  // we implement all the HTML elements
  if (data[1] === "template") {
    const content = nodeFromArray(data[3], null);
    const contentFrag = new DocumentFragment();
    const fragMutator = contentFrag._getChildNodesMutator();

    for (const child of content.childNodes) {
      fragMutator.push(child);
      child._setParent(contentFrag);
    }

    return new HTMLTemplateElement(
      parentNode,
      data[2],
      CTOR_KEY,
      contentFrag,
    );
  }

  const elm = new Element(data[1], parentNode, data[2], CTOR_KEY);
  const childNodes = elm._getChildNodesMutator();
  let childNode: Node;

  for (const child of data.slice(3)) {
    switch (child[0]) {
      case NodeType.TEXT_NODE:
        childNode = new Text(child[1]);
        childNode.parentNode = childNode.parentElement = <Element> elm;
        childNodes.push(childNode);
        break;

      case NodeType.COMMENT_NODE:
        childNode = new Comment(child[1]);
        childNode.parentNode = childNode.parentElement = <Element> elm;
        childNodes.push(childNode);
        break;

      case NodeType.DOCUMENT_NODE:
      case NodeType.ELEMENT_NODE:
        nodeFromArray(child, elm);
        break;

      case NodeType.DOCUMENT_TYPE_NODE:
        childNode = new DocumentType(child[1], child[2], child[3], CTOR_KEY);
        childNode.parentNode = childNode.parentElement = <Element> elm;
        childNodes.push(childNode);
        break;
    }
  }

  return elm;
}
