import {html} from "/-/parse5@v7.0.0-4AUKIZfwEPUbwYAbyTrt/dist=es2019,mode=imports/optimized/parse5.js";
import {isComment, isTag, isText, Document, Element, Comment, isDirective, ProcessingInstruction, Text} from "/-/domhandler@v5.0.3-oHQ1zBLd64RIysV9PvVR/dist=es2019,mode=imports/optimized/domhandler.js";
function createTextNode(value) {
  return new Text(value);
}
function enquoteDoctypeId(id) {
  const quote = id.includes('"') ? "'" : '"';
  return quote + id + quote;
}
function serializeDoctypeContent(name, publicId, systemId) {
  let str = "!DOCTYPE ";
  if (name) {
    str += name;
  }
  if (publicId) {
    str += ` PUBLIC ${enquoteDoctypeId(publicId)}`;
  } else if (systemId) {
    str += " SYSTEM";
  }
  if (systemId) {
    str += ` ${enquoteDoctypeId(systemId)}`;
  }
  return str;
}
const adapter = {
  isCommentNode: isComment,
  isElementNode: isTag,
  isTextNode: isText,
  createDocument() {
    const node = new Document([]);
    node["x-mode"] = html.DOCUMENT_MODE.NO_QUIRKS;
    return node;
  },
  createDocumentFragment() {
    return new Document([]);
  },
  createElement(tagName, namespaceURI, attrs) {
    const attribs = Object.create(null);
    const attribsNamespace = Object.create(null);
    const attribsPrefix = Object.create(null);
    for (let i = 0; i < attrs.length; i++) {
      const attrName = attrs[i].name;
      attribs[attrName] = attrs[i].value;
      attribsNamespace[attrName] = attrs[i].namespace;
      attribsPrefix[attrName] = attrs[i].prefix;
    }
    const node = new Element(tagName, attribs, []);
    node.namespace = namespaceURI;
    node["x-attribsNamespace"] = attribsNamespace;
    node["x-attribsPrefix"] = attribsPrefix;
    return node;
  },
  createCommentNode(data) {
    return new Comment(data);
  },
  appendChild(parentNode, newNode) {
    const prev = parentNode.children[parentNode.children.length - 1];
    if (prev) {
      prev.next = newNode;
      newNode.prev = prev;
    }
    parentNode.children.push(newNode);
    newNode.parent = parentNode;
  },
  insertBefore(parentNode, newNode, referenceNode) {
    const insertionIdx = parentNode.children.indexOf(referenceNode);
    const {prev} = referenceNode;
    if (prev) {
      prev.next = newNode;
      newNode.prev = prev;
    }
    referenceNode.prev = newNode;
    newNode.next = referenceNode;
    parentNode.children.splice(insertionIdx, 0, newNode);
    newNode.parent = parentNode;
  },
  setTemplateContent(templateElement, contentElement) {
    adapter.appendChild(templateElement, contentElement);
  },
  getTemplateContent(templateElement) {
    return templateElement.children[0];
  },
  setDocumentType(document, name, publicId, systemId) {
    const data = serializeDoctypeContent(name, publicId, systemId);
    let doctypeNode = document.children.find((node) => isDirective(node) && node.name === "!doctype");
    if (doctypeNode) {
      doctypeNode.data = data !== null && data !== void 0 ? data : null;
    } else {
      doctypeNode = new ProcessingInstruction("!doctype", data);
      adapter.appendChild(document, doctypeNode);
    }
    doctypeNode["x-name"] = name !== null && name !== void 0 ? name : void 0;
    doctypeNode["x-publicId"] = publicId !== null && publicId !== void 0 ? publicId : void 0;
    doctypeNode["x-systemId"] = systemId !== null && systemId !== void 0 ? systemId : void 0;
  },
  setDocumentMode(document, mode) {
    document["x-mode"] = mode;
  },
  getDocumentMode(document) {
    return document["x-mode"];
  },
  detachNode(node) {
    if (node.parent) {
      const idx = node.parent.children.indexOf(node);
      const {prev, next} = node;
      node.prev = null;
      node.next = null;
      if (prev) {
        prev.next = next;
      }
      if (next) {
        next.prev = prev;
      }
      node.parent.children.splice(idx, 1);
      node.parent = null;
    }
  },
  insertText(parentNode, text) {
    const lastChild = parentNode.children[parentNode.children.length - 1];
    if (lastChild && isText(lastChild)) {
      lastChild.data += text;
    } else {
      adapter.appendChild(parentNode, createTextNode(text));
    }
  },
  insertTextBefore(parentNode, text, referenceNode) {
    const prevNode = parentNode.children[parentNode.children.indexOf(referenceNode) - 1];
    if (prevNode && isText(prevNode)) {
      prevNode.data += text;
    } else {
      adapter.insertBefore(parentNode, createTextNode(text), referenceNode);
    }
  },
  adoptAttributes(recipient, attrs) {
    for (let i = 0; i < attrs.length; i++) {
      const attrName = attrs[i].name;
      if (typeof recipient.attribs[attrName] === "undefined") {
        recipient.attribs[attrName] = attrs[i].value;
        recipient["x-attribsNamespace"][attrName] = attrs[i].namespace;
        recipient["x-attribsPrefix"][attrName] = attrs[i].prefix;
      }
    }
  },
  getFirstChild(node) {
    return node.children[0];
  },
  getChildNodes(node) {
    return node.children;
  },
  getParentNode(node) {
    return node.parent;
  },
  getAttrList(element) {
    return element.attributes;
  },
  getTagName(element) {
    return element.name;
  },
  getNamespaceURI(element) {
    return element.namespace;
  },
  getTextNodeContent(textNode) {
    return textNode.data;
  },
  getCommentNodeContent(commentNode) {
    return commentNode.data;
  },
  getDocumentTypeNodeName(doctypeNode) {
    var _a;
    return (_a = doctypeNode["x-name"]) !== null && _a !== void 0 ? _a : "";
  },
  getDocumentTypeNodePublicId(doctypeNode) {
    var _a;
    return (_a = doctypeNode["x-publicId"]) !== null && _a !== void 0 ? _a : "";
  },
  getDocumentTypeNodeSystemId(doctypeNode) {
    var _a;
    return (_a = doctypeNode["x-systemId"]) !== null && _a !== void 0 ? _a : "";
  },
  isDocumentTypeNode(node) {
    return isDirective(node) && node.name === "!doctype";
  },
  setNodeSourceCodeLocation(node, location) {
    if (location) {
      node.startIndex = location.startOffset;
      node.endIndex = location.endOffset;
    }
    node.sourceCodeLocation = location;
  },
  getNodeSourceCodeLocation(node) {
    return node.sourceCodeLocation;
  },
  updateNodeSourceCodeLocation(node, endLocation) {
    if (endLocation.endOffset != null)
      node.endIndex = endLocation.endOffset;
    node.sourceCodeLocation = {
      ...node.sourceCodeLocation,
      ...endLocation
    };
  }
};
export {adapter, serializeDoctypeContent};
export default null;
