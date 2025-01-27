import { Comment, Node, nodesAndTextNodes, NodeType, Text } from "./node.ts";
import { NodeList } from "./node-list.ts";
import UtilTypes from "./utils-types.ts";
import type { Element } from "./element.ts";
import type { HTMLTemplateElement } from "./elements/html-template-element.ts";
import type { DocumentFragment } from "./document-fragment.ts";

export function getElementsByClassName(
  element: any,
  className: string,
  search: Node[],
): Node[] {
  for (const child of element.childNodes) {
    if (child.nodeType === NodeType.ELEMENT_NODE) {
      const classList = className.trim().split(/\s+/);
      let matchesCount = 0;

      for (const singleClassName of classList) {
        if ((<Element> child).classList.contains(singleClassName)) {
          matchesCount++;
        }
      }

      // ensure that all class names are present
      if (matchesCount === classList.length) {
        search.push(child);
      }

      getElementsByClassName(<Element> child, className, search);
    }
  }

  return search;
}

function getOuterHTMLOpeningTag(parentElement: Element) {
  return "<" + parentElement.localName +
    getElementAttributesString(parentElement) + ">";
}

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

/**
 * .innerHTML/.outerHTML implementation without recursion to avoid stack
 * overflows
 */
export function getOuterOrInnerHtml(
  parentElement: Element,
  asOuterHtml: boolean,
): string {
  let outerHTMLOpeningTag = "";
  let outerHTMLClosingTag = "";
  let innerHTML = "";

  if (asOuterHtml) {
    outerHTMLOpeningTag = getOuterHTMLOpeningTag(parentElement);
    outerHTMLClosingTag = `</${parentElement.localName}>`;

    if (voidElements.has(parentElement.localName)) {
      return outerHTMLOpeningTag;
    }
  }

  const initialChildNodes = parentElement.localName === "template"
    ? (parentElement as HTMLTemplateElement).content.childNodes
    : parentElement.childNodes;
  const childNodeDepth = [initialChildNodes];
  const indexDepth = [0];
  const closingTagDepth = [outerHTMLClosingTag];
  let depth = 0;

  depthLoop:
  while (depth > -1) {
    const child = childNodeDepth[depth][indexDepth[depth]];

    if (child) {
      switch (child.nodeType) {
        case NodeType.ELEMENT_NODE: {
          innerHTML += getOuterHTMLOpeningTag(child as Element);
          const childLocalName = (child as Element).localName;

          // Void elements don't have a closing tag nor print innerHTML
          if (!voidElements.has(childLocalName)) {
            if (childLocalName === "template") {
              childNodeDepth.push(
                (child as HTMLTemplateElement).content.childNodes,
              );
            } else {
              childNodeDepth.push(child.childNodes);
            }
            indexDepth.push(0);
            closingTagDepth.push(`</${childLocalName}>`);
            depth++;
            continue depthLoop;
          }
          break;
        }

        case NodeType.COMMENT_NODE:
          innerHTML += `<!--${(child as Comment).data}-->`;
          break;

        case NodeType.TEXT_NODE:
          // Special handling for rawtext-like elements.
          switch ((child.parentNode! as Element).localName) {
            case "style":
            case "script":
            case "xmp":
            case "iframe":
            case "noembed":
            case "noframes":
            case "plaintext":
              innerHTML += (child as Text).data;
              break;

            default:
              // escaping: https://html.spec.whatwg.org/multipage/parsing.html#escapingString
              innerHTML += (child as Text).data
                .replace(/&/g, "&amp;")
                .replace(/\xA0/g, "&nbsp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              break;
          }
          break;
      }
    } else {
      depth--;

      indexDepth.pop();
      childNodeDepth.pop();
      innerHTML += closingTagDepth.pop();
    }

    // Go to next child
    indexDepth[depth]++;
  }

  // If innerHTML is requested then the opening tag should be an empty string
  return outerHTMLOpeningTag + innerHTML;
}

// FIXME: This uses the incorrect .attributes implementation, it
// should probably be changed when .attributes is fixed
export function getElementAttributesString(
  element: Element,
): string {
  let out = "";

  for (const attribute of element.getAttributeNames()) {
    out += ` ${attribute.toLowerCase()}`;

    // escaping: https://html.spec.whatwg.org/multipage/parsing.html#escapingString
    out += `="${
      element.getAttribute(attribute)!
        .replace(/&/g, "&amp;")
        .replace(/\xA0/g, "&nbsp;")
        .replace(/"/g, "&quot;")
    }"`;
  }

  return out;
}

export function insertBeforeAfter(
  node: Node,
  nodes: (Node | string)[],
  before: boolean,
) {
  const parentNode = node.parentNode!;
  const mutator = parentNode._getChildNodesMutator();
  // Find the previous/next sibling to `node` that isn't in `nodes` before the
  // nodes in `nodes` are removed from their parents.
  let viablePrevNextSibling: Node | null = null;
  {
    const difference = before ? -1 : +1;
    for (
      let i = mutator.indexOf(node) + difference;
      0 <= i && i < parentNode.childNodes.length;
      i += difference
    ) {
      if (!nodes.includes(parentNode.childNodes[i])) {
        viablePrevNextSibling = parentNode.childNodes[i];
        break;
      }
    }
  }
  nodes = nodesAndTextNodes(nodes, parentNode);

  let index;
  if (viablePrevNextSibling) {
    index = mutator.indexOf(viablePrevNextSibling) + (before ? 1 : 0);
  } else {
    index = before ? 0 : parentNode.childNodes.length;
  }
  mutator.splice(index, 0, ...(<Node[]> nodes));
}

export function isDocumentFragment(node: Node): node is DocumentFragment {
  let obj: any = node;

  if (!(obj && typeof obj === "object")) {
    return false;
  }

  while (true) {
    switch (obj.constructor) {
      case UtilTypes.DocumentFragment:
        return true;

      case Node:
      case UtilTypes.Element:
        return false;

      // FIXME: We should probably throw here?

      case Object:
      case null:
      case undefined:
        return false;

      default:
        obj = Reflect.getPrototypeOf(obj);
    }
  }
}

/**
 * Sets the new parent for the children via _setParent() on all
 * the child nodes and removes them from the DocumentFragment's
 * childNode list.
 *
 * A helper function for appendChild, etc. It should be called
 * _after_ the children are already pushed onto the new parent's
 * childNodes.
 */
export function moveDocumentFragmentChildren(
  fragment: DocumentFragment,
  newParent: Node,
) {
  const childCount = fragment.childNodes.length;

  for (const child of fragment.childNodes) {
    child._setParent(newParent);
  }

  const mutator = fragment._getChildNodesMutator();
  mutator.splice(0, childCount);
}
