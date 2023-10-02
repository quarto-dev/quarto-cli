class t {
  constructor(t3, n2, e2, r2) {
    this.source = null, this.observer = t3, this.node = n2, this.options = e2, this.source = r2 || null, r2 && t3.t.push(this);
  }
  collectInterestedObservers(t3, n2, e2, r2, o2) {
    if (this.node !== n2 && !this.options.subtree)
      return;
    if (t3 === "attributes" && !this.options.attributes)
      return;
    if (t3 === "characterData" && !this.options.characterData)
      return;
    if (t3 === "childList" && !this.options.childList)
      return;
    let i2 = r2.indexOf(this.observer);
    i2 < 0 && (i2 = r2.length, r2.push(this.observer), o2.push(void 0)), (t3 === "attributes" && this.options.attributeOldValue || t3 === "characterData" && this.options.characterDataOldValue) && (o2[i2] = e2.oldValue);
  }
}
class n {
  constructor(t2) {
    this.o = [], this.i = t2;
  }
  register(n3, e2) {
    const r2 = this.o;
    let o2 = false;
    r2.forEach((t2) => {
      t2.observer === n3 && (o2 = true, function(t3) {
        for (let n4 = t3.observer.t.length - 1; n4 >= 0; --n4) {
          const e3 = t3.observer.t[n4];
          if (e3.source !== t3)
            return;
          e3.node.o.removeTransientRegisteredObserver(e3), t3.observer.t.splice(n4, 1);
        }
      }(t2), t2.options = e2);
    }), o2 || (this.o.push(new t(n3, this.i, e2)), n3.u.push(this.i));
  }
  removeTransientRegisteredObserver(t2) {
    this.o.splice(this.o.indexOf(t2), 1);
  }
  removeForObserver(t2) {
    let n3 = 0;
    for (let e2 = 0, r2 = this.o.length; e2 < r2; ++e2) {
      const r3 = this.o[e2];
      r3.observer !== t2 && (e2 !== n3 && (this.o[n3] = r3), ++n3);
    }
    this.o.length = n3;
  }
  collectInterestedObservers(t2, n3, e2, r2, o2) {
    this.o.forEach((i2) => {
      i2.collectInterestedObservers(t2, n3, e2, r2, o2);
    });
  }
  appendTransientRegisteredObservers(t2) {
    this.o.forEach((n3) => {
      n3.options.subtree && t2.o.registerTransient(n3);
    });
  }
  registerTransient(n3) {
    this.o.push(new t(n3.observer, this.i, n3.options, n3));
  }
}
function e(t2, n2, ...e2) {
  typeof queueMicrotask != "function" ? Promise.resolve().then(() => t2.apply(n2, e2)) : queueMicrotask(() => t2.apply(n2, e2));
}
class r {
  constructor() {
    this.l = new Set(), this.h = false;
  }
  appendRecord(t2, n2) {
    t2.m.push(n2), this.l.add(t2);
  }
  queueMutationObserverMicrotask() {
    this.h || (this.h = true, e(() => {
      this.p();
    }, this));
  }
  p() {
    this.h = false;
    const t2 = Array.from(this.l);
    this.l.clear(), t2.forEach((t3) => {
      e((t4) => {
        const n2 = t4.takeRecords();
        var e2;
        (e2 = t4).t.forEach((t5) => {
          t5.node.o.removeTransientRegisteredObserver(t5);
        }), e2.t.length = 0, n2.length > 0 && t4.g(n2, t4);
      }, this, t3);
    });
  }
}
class o {
  constructor(t2) {
    this.v = t2;
  }
  deref() {
    return this.v;
  }
}
const i = new class {
  constructor() {
    this.l = new r(), this.N = [], this.S = new WeakSet();
  }
  forEachRange(t2) {
    let n2 = this.N.length;
    for (let e2 = n2 - 1; e2 >= 0; --e2) {
      const r2 = this.N[e2].deref(), o2 = r2 == null, i2 = !o2 && !this.S.has(r2);
      o2 || i2 ? (this.N[e2] = this.N[n2 - 1], this.N.pop(), n2 -= 1) : t2(r2);
    }
  }
  addRange(t2) {
    const n2 = (e2 = t2, typeof WeakRef == "function" ? new WeakRef(e2) : new o(e2));
    var e2;
    this.N.push(n2), this.S.add(t2);
  }
  removeRange(t2) {
    this.S.delete(t2);
  }
}();
function s(t2) {
  return i;
}
function u(t2, ...n2) {
  return n2.some((n3) => t2.nodeType === n3);
}
function l(t2) {
  return t2.nodeType === 2;
}
function c(t2) {
  return t2.nodeType === 3 || t2.nodeType === 4 || t2.nodeType === 8 || t2.nodeType === 7;
}
function a(t2) {
  return t2.nodeType === 3 || t2.nodeType === 4;
}
function h(t2) {
  return t2.nodeType === 1;
}
function f(t2) {
  return t2.nodeType === 10;
}
function d(t2) {
  switch (t2.nodeType) {
    case 3:
    case 7:
    case 8:
      return t2.data.length;
    default:
      return t2.childNodes.length;
  }
}
function m(t2) {
  let n2 = t2, e2 = [];
  for (; n2; )
    e2.unshift(n2), n2 = n2.parentNode;
  return e2;
}
function p(t2) {
  return u(t2, 9) ? t2 : t2.ownerDocument;
}
function g(t2) {
  return t2.parentNode.childNodes.indexOf(t2);
}
function w(t2) {
  for (; t2.parentNode; )
    t2 = t2.parentNode;
  return t2;
}
function y(t2, n2) {
  n2(t2);
  for (let e2 = t2.firstChild; e2; e2 = e2.nextSibling)
    y(e2, n2);
}
function b(t2, n2) {
  const e2 = [];
  return y(n2, (r2) => {
    if (r2 === n2 || r2.nodeType !== 1)
      return;
    const o2 = r2;
    t2 !== "*" && o2.nodeName !== t2 || e2.push(o2);
  }), e2;
}
function x(t2, n2, e2) {
  t2 === "" && (t2 = null);
  const r2 = [];
  return y(e2, (o2) => {
    if (o2 === e2 || o2.nodeType !== 1)
      return;
    const i2 = o2;
    t2 !== "*" && i2.namespaceURI !== t2 || n2 !== "*" && i2.localName !== n2 || r2.push(i2);
  }), r2;
}
function v(t2, n2, e2) {
  e2 || (e2 = p(t2));
  let r2 = t2.T(e2);
  if (n2)
    for (let n3 = t2.firstChild; n3; n3 = n3.nextSibling)
      r2.appendChild(v(n3, true, e2));
  return r2;
}
function N(t2, n2) {
  if (t2.length < n2)
    throw new TypeError(`Function should be called with at least ${n2} arguments`);
}
const S = {IndexSizeError: 1, HierarchyRequestError: 3, WrongDocumentError: 4, InvalidCharacterError: 5, NotFoundError: 8, NotSupportedError: 9, InUseAttributeError: 10, InvalidStateError: 11, NamespaceError: 14, InvalidNodeTypeError: 24};
class E extends Error {
  constructor(t2 = "", n2 = "Error") {
    super(t2), this.message = t2, this.name = n2, this.code = S[n2] || 0, this.stack = new Error(t2).stack;
  }
}
function T(t2, n2) {
  return new E(`${t2}: ${n2}`, t2);
}
function C(t2) {
  throw T("HierarchyRequestError", t2);
}
function D(t2) {
  throw T("IndexSizeError", t2);
}
function $(t2) {
  throw T("InvalidCharacterError", t2);
}
function A(t2) {
  throw T("InvalidNodeTypeError", t2);
}
function I(t2) {
  throw T("InvalidStateError", t2);
}
function k(t2) {
  throw T("NamespaceError", t2);
}
function M(t2) {
  throw T("NotFoundError", t2);
}
function R(t2) {
  throw T("NotSupportedError", t2);
}
function P(t2) {
  throw T("WrongDocumentError", t2);
}
class L {
  constructor(t2, n2) {
    this.addedNodes = [], this.removedNodes = [], this.previousSibling = null, this.nextSibling = null, this.attributeName = null, this.attributeNamespace = null, this.oldValue = null, this.type = t2, this.target = n2;
  }
}
function O(t2, n2, e2) {
  const r2 = [], o2 = [];
  for (let i3 = n2; i3; i3 = i3.parentNode)
    i3.o.collectInterestedObservers(t2, n2, e2, r2, o2);
  const i2 = s();
  r2.forEach((r3, s2) => {
    const u2 = o2[s2], l2 = new L(t2, n2);
    e2.name !== void 0 && e2.namespace !== void 0 && (l2.attributeName = e2.name, l2.attributeNamespace = e2.namespace), u2 !== void 0 && (l2.oldValue = u2), e2.addedNodes !== void 0 && (l2.addedNodes = e2.addedNodes), e2.removedNodes !== void 0 && (l2.removedNodes = e2.removedNodes), e2.previousSibling !== void 0 && (l2.previousSibling = e2.previousSibling), e2.nextSibling !== void 0 && (l2.nextSibling = e2.nextSibling), i2.l.appendRecord(r3, l2);
  }), i2.l.queueMutationObserverMicrotask();
}
function z(t2) {
  const n2 = [];
  for (let e2 = t2.firstElementChild; e2; e2 = e2.nextElementSibling)
    n2.push(e2);
  return n2;
}
function F(t2) {
  for (let n2 = t2.previousSibling; n2; n2 = n2.previousSibling)
    if (h(n2))
      return n2;
  return null;
}
function V(t2) {
  for (let n2 = t2.nextSibling; n2; n2 = n2.nextSibling)
    if (h(n2))
      return n2;
  return null;
}
function U(t2, n2) {
  const e2 = t2.previousSibling, r2 = t2.nextSibling, o2 = u(t2, 1), i2 = o2 ? t2.previousElementSibling : null, s2 = o2 ? t2.nextElementSibling : null;
  if (t2.parentNode = null, t2.previousSibling = null, t2.nextSibling = null, e2 ? e2.nextSibling = r2 : n2.firstChild = r2, r2 ? r2.previousSibling = e2 : n2.lastChild = e2, n2.childNodes.splice(n2.childNodes.indexOf(t2), 1), o2) {
    const e3 = function(t3) {
      return u(t3, 1, 9, 11) ? t3 : null;
    }(n2);
    e3 && (e3.firstElementChild === t2 && (e3.firstElementChild = s2), e3.lastElementChild === t2 && (e3.lastElementChild = i2), e3.childElementCount -= 1);
  }
  if (u(n2, 9)) {
    const e3 = n2;
    u(t2, 1) ? e3.documentElement = null : u(t2, 10) && (e3.doctype = null);
  }
}
function q(t2, n2, e2) {
  if (u(n2, 9, 11, 1) || C("parent must be a Document, DocumentFragment or Element node"), t2.contains(n2) && C("node must not be an inclusive ancestor of parent"), e2 && e2.parentNode !== n2 && M("child is not a child of parent"), u(t2, 11, 10, 1, 3, 4, 7, 8) || C("node must be a DocumentFragment, DocumentType, Element, Text, ProcessingInstruction or Comment node"), u(t2, 3) && u(n2, 9) && C("can not insert a Text node under a Document"), u(t2, 10) && !u(n2, 9) && C("can only insert a DocumentType node under a Document"), u(n2, 9)) {
    const r2 = n2;
    switch (t2.nodeType) {
      case 11:
        const n3 = t2;
        n3.firstElementChild !== n3.lastElementChild && C("can not insert more than one element under a Document"), Array.from(n3.childNodes).some((t3) => u(t3, 3)) && C("can not insert a Text node under a Document"), n3.firstElementChild && (r2.documentElement || e2 && u(e2, 10) || e2 && r2.doctype && g(e2) < g(r2.doctype)) && C("Document should contain at most one doctype, followed by at most one element");
        break;
      case 1:
        (r2.documentElement || e2 && u(e2, 10) || e2 && r2.doctype && g(e2) < g(r2.doctype)) && C("Document should contain at most one doctype, followed by at most one element");
        break;
      case 10:
        (r2.doctype || e2 && r2.documentElement && g(r2.documentElement) < g(e2) || !e2 && r2.documentElement) && C("Document should contain at most one doctype, followed by at most one element");
    }
  }
}
function _(t2, n2, e2) {
  q(t2, n2, e2);
  let r2 = e2;
  return r2 === t2 && (r2 = t2.nextSibling), j(t2, p(n2)), B(t2, n2, r2), t2;
}
function B(t2, n2, e2, r2 = false) {
  const o2 = function(t3) {
    return t3.nodeType === 11;
  }(t2), i2 = o2 ? Array.from(t2.childNodes) : [t2], u2 = i2.length;
  if (u2 === 0)
    return;
  if (o2 && (i2.forEach((t3) => H(t3, true)), O("childList", t2, {removedNodes: i2})), e2 !== null) {
    const t3 = g(e2);
    s().forEachRange((e3) => {
      e3.startContainer === n2 && e3.startOffset > t3 && (e3.startOffset += u2), e3.endContainer === n2 && e3.endOffset > t3 && (e3.endOffset += u2);
    });
  }
  let l2 = e2 === null ? n2.lastChild : e2.previousSibling;
  i2.forEach((t3) => {
    !function(t4, n3, e3) {
      t4.parentNode = n3;
      const r3 = e3 === null ? n3.lastChild : e3.previousSibling, o3 = e3 === null ? null : e3;
      if (t4.previousSibling = r3, t4.nextSibling = o3, r3 ? r3.nextSibling = t4 : n3.firstChild = t4, o3 ? (o3.previousSibling = t4, n3.childNodes.splice(n3.childNodes.indexOf(o3), 0, t4)) : (n3.lastChild = t4, n3.childNodes.push(t4)), h(t4)) {
        const e4 = n3;
        let i3 = null;
        for (let t5 = r3; t5; t5 = t5.previousSibling) {
          if (h(t5)) {
            i3 = t5;
            break;
          }
          const n4 = t5;
          if (!f(n4)) {
            i3 = n4.previousElementSibling;
            break;
          }
        }
        let s2 = null;
        for (let t5 = o3; t5; t5 = t5.nextSibling) {
          if (h(t5)) {
            s2 = t5;
            break;
          }
          s2 = t5.nextElementSibling;
          break;
        }
        i3 || (e4.firstElementChild = t4), s2 || (e4.lastElementChild = t4), e4.childElementCount += 1;
      }
      (function(t5) {
        return t5.nodeType === 9;
      })(n3) && (h(t4) ? n3.documentElement = t4 : f(t4) && (n3.doctype = t4));
    }(t3, n2, e2);
  }), r2 || O("childList", n2, {addedNodes: i2, nextSibling: e2, previousSibling: l2});
}
function W(t2, n2) {
  return _(t2, n2, null);
}
function X(t2, n2, e2) {
  if (u(e2, 9, 11, 1) || C("Can not replace under a non-parent node"), n2.contains(e2) && C("Can not insert a node under its own descendant"), t2.parentNode !== e2 && M("child is not a child of parent"), u(n2, 11, 10, 1, 3, 4, 7, 8) || C("Can not insert a node that isn't a DocumentFragment, DocumentType, Element, Text, ProcessingInstruction or Comment"), u(n2, 3) && u(e2, 9) && C("can not insert a Text node under a Document"), u(n2, 10) && !u(e2, 9) && C("can only insert a DocumentType node under a Document"), u(e2, 9)) {
    const r3 = e2;
    switch (n2.nodeType) {
      case 11:
        const e3 = n2;
        e3.firstElementChild !== e3.lastElementChild && C("can not insert more than one element under a Document"), Array.from(e3.childNodes).some((t3) => u(t3, 3)) && C("can not insert a Text node under a Document"), e3.firstElementChild && (r3.documentElement && r3.documentElement !== t2 || t2 && r3.doctype && g(t2) < g(r3.doctype)) && C("Document should contain at most one doctype, followed by at most one element");
        break;
      case 1:
        (r3.documentElement && r3.documentElement !== t2 || r3.doctype && g(t2) < g(r3.doctype)) && C("Document should contain at most one doctype, followed by at most one element");
        break;
      case 10:
        (r3.doctype && r3.doctype !== t2 || r3.documentElement && g(r3.documentElement) < g(t2)) && C("Document should contain at most one doctype, followed by at most one element");
    }
  }
  let r2 = t2.nextSibling;
  r2 === n2 && (r2 = n2.nextSibling);
  const o2 = t2.previousSibling;
  j(n2, p(e2));
  let i2 = [];
  t2.parentNode !== null && (i2.push(t2), H(t2, true));
  const s2 = u(n2, 11) ? Array.from(n2.childNodes) : [n2];
  return B(n2, e2, r2, true), O("childList", e2, {addedNodes: s2, removedNodes: i2, nextSibling: r2, previousSibling: o2}), t2;
}
function Y(t2, n2) {
  t2 !== null && j(t2, p(n2));
  const e2 = Array.from(n2.childNodes);
  let r2 = [];
  t2 !== null && (u(t2, 11) ? t2.childNodes.forEach((t3) => {
    r2.push(t3);
  }) : r2.push(t2)), e2.forEach((t3) => {
    H(t3, true);
  }), t2 !== null && B(t2, n2, null, true), (r2.length > 0 || e2.length > 0) && O("childList", n2, {addedNodes: r2, removedNodes: e2});
}
function H(t2, n2 = false) {
  const e2 = t2.parentNode, r2 = g(t2);
  s().forEachRange((n3) => {
    t2.contains(n3.startContainer) && (n3.startContainer = e2, n3.startOffset = r2), t2.contains(n3.endContainer) && (n3.endContainer = e2, n3.endOffset = r2), n3.startContainer === e2 && n3.startOffset > r2 && (n3.startOffset -= 1), n3.endContainer === e2 && n3.endOffset > r2 && (n3.endOffset -= 1);
  });
  const o2 = t2.previousSibling, i2 = t2.nextSibling;
  U(t2, e2);
  for (let n3 = e2; n3; n3 = n3.parentNode)
    n3.o.appendTransientRegisteredObservers(t2);
  n2 || O("childList", e2, {removedNodes: [t2], nextSibling: i2, previousSibling: o2});
}
function j(t2, n2) {
  const e2 = p(t2);
  t2.parentNode && H(t2), n2 !== e2 && y(t2, (t3) => {
    if (t3.ownerDocument = n2, u(t3, 1))
      for (const e3 of t3.attributes)
        e3.ownerDocument = n2;
  });
}
function Q(t2) {
  const n2 = [];
  return y(t2, (t3) => {
    u(t3, 3, 4) && n2.push(t3.data);
  }), n2.join("");
}
function K(t2, n2) {
  let e2 = null;
  if (n2 !== "") {
    e2 = new (s()).Text(n2);
  }
  Y(e2, t2);
}
function G(t2, n2) {
  const e2 = t2.map((t3) => t3 instanceof Node ? t3 : n2.createTextNode(String(t3)));
  if (e2.length === 1)
    return e2[0];
  {
    const t3 = n2.createDocumentFragment();
    return e2.forEach((n3) => {
      t3.appendChild(n3);
    }), t3;
  }
}
function J(t2, n2) {
  _(G(n2, p(t2)), t2, t2.firstChild);
}
function Z(t2, n2) {
  W(G(n2, p(t2)), t2);
}
function tt(t2, n2) {
  const e2 = G(n2, p(t2));
  q(e2, t2, null), Y(e2, t2);
}
function nt(t2, n2) {
  const e2 = t2.parentNode;
  if (e2 === null)
    return;
  let r2 = t2.previousSibling;
  for (; r2 !== null && n2.indexOf(r2) >= 0; )
    r2 = r2.previousSibling;
  _(G(n2, p(t2)), e2, r2 === null ? e2.firstChild : r2.nextSibling);
}
function et(t2, n2) {
  const e2 = t2.parentNode;
  if (e2 === null)
    return;
  let r2 = t2.nextSibling;
  for (; r2 !== null && n2.indexOf(r2) >= 0; )
    r2 = r2.nextSibling;
  _(G(n2, p(t2)), e2, r2);
}
function rt(t2, n2) {
  const e2 = t2.parentNode;
  if (e2 === null)
    return;
  let r2 = t2.nextSibling;
  for (; r2 !== null && n2.indexOf(r2) >= 0; )
    r2 = r2.nextSibling;
  const o2 = G(n2, p(t2));
  t2.parentNode === e2 ? X(t2, o2, e2) : _(o2, e2, r2);
}
function ot(t2) {
  t2.parentNode !== null && H(t2);
}
function it(t2, n2) {
  const e2 = n2.startContainer;
  u(e2, 7) && C("Can not insert into a processing instruction"), u(e2, 8) && C("Can not insert into a comment"), a(e2) && e2.parentNode === null && C("Can not insert into a text node without a parent");
  let r2 = null;
  r2 = a(e2) ? e2 : e2.childNodes[n2.startOffset] || null;
  const o2 = r2 === null ? e2 : r2.parentNode;
  q(t2, o2, r2), a(e2) && (r2 = e2.splitText(n2.startOffset)), t2 === r2 && (r2 = r2.nextSibling), t2.parentNode !== null && H(t2);
  let i2 = r2 === null ? d(o2) : g(r2);
  u(t2, 11) ? i2 += d(t2) : i2 += 1, _(t2, o2, r2), n2.collapsed && n2.setEnd(o2, i2);
}
function st(t2) {
  return t2 >>> 0;
}
function ut(t2) {
  return t2 === null ? "" : String(t2);
}
function lt(t2) {
  return t2 == null ? "" : String(t2);
}
function ct(t2, n2) {
  return function(t3, n3) {
    if (!(t3 instanceof n3))
      throw new TypeError(`Value should be an instance of ${n3.name}`);
  }(t2, n2), t2;
}
function at(t2, n2) {
  return t2 == null ? null : ct(t2, n2);
}
function ht(t2) {
  return t2 === void 0 ? null : t2;
}
const ft = new WeakMap();
function dt(t2) {
  let n2 = ft.get(t2);
  return n2 === void 0 && (n2 = Math.random(), ft.set(t2, n2)), n2;
}
class Node {
  constructor() {
    this.ownerDocument = null, this.parentNode = null, this.childNodes = [], this.firstChild = null, this.lastChild = null, this.previousSibling = null, this.nextSibling = null, this.o = new n(this);
  }
  get parentElement() {
    return this.parentNode && u(this.parentNode, 1) ? this.parentNode : null;
  }
  hasChildNodes() {
    return !!this.childNodes.length;
  }
  normalize() {
    let t2 = this.firstChild, n2 = 0;
    for (p(this); t2; ) {
      let e2 = t2.nextSibling;
      if (!u(t2, 3)) {
        t2.normalize(), t2 = e2;
        continue;
      }
      const r2 = t2;
      let o2 = r2.length;
      if (o2 === 0) {
        H(t2), --n2, t2 = e2;
        continue;
      }
      let i2 = "";
      const l2 = [];
      for (let t3 = r2.nextSibling; t3 && u(t3, 3); t3 = t3.nextSibling)
        i2 += t3.data, l2.push(t3);
      i2 && r2.replaceData(o2, 0, i2);
      const c2 = s();
      for (let t3 = 0, e3 = l2.length; t3 < e3; ++t3) {
        const e4 = l2[t3], i3 = n2 + t3 + 1;
        c2.forEachRange((t4) => {
          t4.startContainer === e4 && (t4.startOffset += o2, t4.startContainer = r2), t4.endContainer === e4 && (t4.endOffset += o2, t4.endContainer = r2), t4.startContainer === this && t4.startOffset === i3 && (t4.startContainer = r2, t4.startOffset = o2), t4.endContainer === this && t4.endOffset === i3 && (t4.endContainer = r2, t4.endOffset = o2);
        }), o2 += e4.length;
      }
      for (; l2.length; )
        H(l2.shift());
      t2 = t2.nextSibling, ++n2;
    }
  }
  cloneNode(t2 = false) {
    return v(this, t2);
  }
  compareDocumentPosition(t2) {
    if (N(arguments, 1), this === (t2 = ct(t2, Node)))
      return 0;
    let n2 = t2, e2 = this, r2 = null, o2 = null;
    if (l(n2) && (r2 = n2, n2 = r2.ownerElement), l(e2) && (o2 = e2, e2 = o2.ownerElement, r2 !== null && n2 !== null && e2 === n2))
      for (const t3 of e2.attributes) {
        if (t3 === r2)
          return Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC | Node.DOCUMENT_POSITION_PRECEDING;
        if (t3 === o2)
          return Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC | Node.DOCUMENT_POSITION_FOLLOWING;
      }
    if (n2 === null || e2 === null)
      return Node.DOCUMENT_POSITION_DISCONNECTED | Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC | (dt(n2 || r2) > dt(e2 || o2) ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING);
    const i2 = m(n2), s2 = m(e2);
    if (i2[0] !== s2[0])
      return Node.DOCUMENT_POSITION_DISCONNECTED | Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC | (dt(i2[0]) > dt(s2[0]) ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING);
    let u2 = 0;
    for (; u2 < i2.length && u2 < s2.length && i2[u2] === s2[u2]; )
      ++u2;
    const c2 = n2 !== e2 && u2 === i2.length, a2 = n2 !== e2 && u2 === s2.length;
    return c2 && r2 === null || n2 === e2 && o2 !== null ? Node.DOCUMENT_POSITION_CONTAINS | Node.DOCUMENT_POSITION_PRECEDING : a2 && o2 === null || n2 === e2 && r2 !== null ? Node.DOCUMENT_POSITION_CONTAINED_BY | Node.DOCUMENT_POSITION_FOLLOWING : c2 || g(i2[u2]) < g(s2[u2]) ? Node.DOCUMENT_POSITION_PRECEDING : Node.DOCUMENT_POSITION_FOLLOWING;
  }
  contains(t2) {
    for (N(arguments, 1), t2 = at(t2, Node); t2 && t2 != this; )
      t2 = t2.parentNode;
    return t2 === this;
  }
  isDefaultNamespace(t2) {
    N(arguments, 1), (t2 = ht(t2)) === "" && (t2 = null);
    return this.lookupNamespaceURI(null) === t2;
  }
  insertBefore(t2, n2) {
    return N(arguments, 2), _(t2 = ct(t2, Node), this, n2 = at(n2, Node));
  }
  appendChild(t2) {
    return N(arguments, 1), W(t2 = ct(t2, Node), this);
  }
  replaceChild(t2, n2) {
    return N(arguments, 2), t2 = ct(t2, Node), X(n2 = ct(n2, Node), t2, this);
  }
  removeChild(t2) {
    return N(arguments, 1), function(t3, n2) {
      return t3.parentNode !== n2 && M("child is not a child of parent"), H(t3), t3;
    }(t2 = ct(t2, Node), this);
  }
}
function mt(t2, n2, e2, r2) {
  O("attributes", n2, {name: t2.localName, namespace: t2.namespaceURI, oldValue: e2});
}
function pt(t2, n2) {
  mt(t2, t2.ownerElement, t2.value), t2.C = n2;
}
function gt(t2, n2, e2 = false) {
  e2 || mt(t2, n2, null, t2.value), n2.attributes.push(t2), t2.ownerElement = n2;
}
function wt(t2) {
  const n2 = t2.ownerElement;
  mt(t2, n2, t2.value), n2.attributes.splice(n2.attributes.indexOf(t2), 1), t2.ownerElement = null;
}
Node.ELEMENT_NODE = 1, Node.ATTRIBUTE_NODE = 2, Node.TEXT_NODE = 3, Node.CDATA_SECTION_NODE = 4, Node.ENTITY_REFERENCE_NODE = 5, Node.ENTITY_NODE = 6, Node.PROCESSING_INSTRUCTION_NODE = 7, Node.COMMENT_NODE = 8, Node.DOCUMENT_NODE = 9, Node.DOCUMENT_TYPE_NODE = 10, Node.DOCUMENT_FRAGMENT_NODE = 11, Node.NOTATION_NODE = 12, Node.DOCUMENT_POSITION_DISCONNECTED = 1, Node.DOCUMENT_POSITION_PRECEDING = 2, Node.DOCUMENT_POSITION_FOLLOWING = 4, Node.DOCUMENT_POSITION_CONTAINS = 8, Node.DOCUMENT_POSITION_CONTAINED_BY = 16, Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC = 32, Node.prototype.ELEMENT_NODE = 1, Node.prototype.ATTRIBUTE_NODE = 2, Node.prototype.TEXT_NODE = 3, Node.prototype.CDATA_SECTION_NODE = 4, Node.prototype.ENTITY_REFERENCE_NODE = 5, Node.prototype.ENTITY_NODE = 6, Node.prototype.PROCESSING_INSTRUCTION_NODE = 7, Node.prototype.COMMENT_NODE = 8, Node.prototype.DOCUMENT_NODE = 9, Node.prototype.DOCUMENT_TYPE_NODE = 10, Node.prototype.DOCUMENT_FRAGMENT_NODE = 11, Node.prototype.NOTATION_NODE = 12;
class Attr extends Node {
  get nodeType() {
    return 2;
  }
  get nodeName() {
    return this.name;
  }
  get nodeValue() {
    return this.C;
  }
  set nodeValue(t2) {
    yt(this, t2 = lt(t2));
  }
  get textContent() {
    return this.C;
  }
  set textContent(t2) {
    yt(this, t2 = lt(t2));
  }
  lookupPrefix(t2) {
    return N(arguments, 1), this.ownerElement !== null ? this.ownerElement.lookupPrefix(t2) : null;
  }
  lookupNamespaceURI(t2) {
    return N(arguments, 1), this.ownerElement === null ? null : this.ownerElement.lookupNamespaceURI(t2);
  }
  get value() {
    return this.C;
  }
  set value(t2) {
    yt(this, t2);
  }
  constructor(t2, n2, e2, r2, o2) {
    super(), this.namespaceURI = t2, this.prefix = n2, this.localName = e2, this.name = n2 === null ? e2 : `${n2}:${e2}`, this.C = r2, this.ownerElement = o2, this.ownerDocument = o2 ? o2.ownerDocument : s().document;
  }
  T(t2) {
    const n2 = new (s()).Attr(this.namespaceURI, this.prefix, this.localName, this.value, null);
    return n2.ownerDocument = t2, n2;
  }
}
function yt(t2, n2) {
  n2 = String(n2);
  t2.ownerElement === null ? t2.C = n2 : pt(t2, n2);
}
class CharacterData extends Node {
  get nodeValue() {
    return this.D;
  }
  set nodeValue(t2) {
    t2 = lt(t2), bt(this, 0, this.length, t2);
  }
  get textContent() {
    return this.D;
  }
  set textContent(t2) {
    t2 = lt(t2), bt(this, 0, this.length, t2);
  }
  lookupPrefix(t2) {
    N(arguments, 1);
    const n2 = this.parentElement;
    return n2 !== null ? n2.lookupPrefix(t2) : null;
  }
  lookupNamespaceURI(t2) {
    N(arguments, 1);
    const n2 = this.parentElement;
    return n2 === null ? null : n2.lookupNamespaceURI(t2);
  }
  before(...t2) {
    nt(this, t2);
  }
  after(...t2) {
    et(this, t2);
  }
  replaceWith(...t2) {
    rt(this, t2);
  }
  remove() {
    ot(this);
  }
  get previousElementSibling() {
    return F(this);
  }
  get nextElementSibling() {
    return V(this);
  }
  get data() {
    return this.D;
  }
  set data(t2) {
    t2 = ut(t2), bt(this, 0, this.length, t2);
  }
  get length() {
    return this.data.length;
  }
  constructor(t2) {
    super(), this.D = String(t2);
  }
  substringData(t2, n2) {
    return N(arguments, 2), xt(this, t2, n2);
  }
  appendData(t2) {
    N(arguments, 1), bt(this, this.length, 0, t2);
  }
  insertData(t2, n2) {
    N(arguments, 1), bt(this, t2, 0, n2);
  }
  deleteData(t2, n2) {
    N(arguments, 2), bt(this, t2, n2, "");
  }
  replaceData(t2, n2, e2) {
    N(arguments, 3), bt(this, t2, n2, e2);
  }
}
function bt(t2, n2, e2, r2) {
  n2 = st(n2), e2 = st(e2);
  const o2 = t2.length;
  n2 > o2 && D("can not replace data past the node's length"), n2 + e2 > o2 && (e2 = o2 - n2), O("characterData", t2, {oldValue: t2.data});
  const i2 = t2.data, u2 = i2.substring(0, n2) + r2 + i2.substring(n2 + e2);
  t2.D = u2;
  s().forEachRange((o3) => {
    o3.startContainer === t2 && o3.startOffset > n2 && o3.startOffset <= n2 + e2 && (o3.startOffset = n2), o3.endContainer === t2 && o3.endOffset > n2 && o3.endOffset <= n2 + e2 && (o3.endOffset = n2), o3.startContainer === t2 && o3.startOffset > n2 + e2 && (o3.startOffset = o3.startOffset + r2.length - e2), o3.endContainer === t2 && o3.endOffset > n2 + e2 && (o3.endOffset = o3.endOffset + r2.length - e2);
  });
}
function xt(t2, n2, e2) {
  n2 = st(n2), e2 = st(e2);
  const r2 = t2.length;
  return n2 > r2 && D("can not substring data past the node's length"), n2 + e2 > r2 ? t2.data.substring(n2) : t2.data.substring(n2, n2 + e2);
}
class Text extends CharacterData {
  get nodeType() {
    return 3;
  }
  get nodeName() {
    return "#text";
  }
  constructor(t2 = "") {
    super(t2);
    const n2 = s();
    this.ownerDocument = n2.document;
  }
  splitText(t2) {
    return N(arguments, 1), function(t3, n2) {
      const e2 = t3.length;
      n2 > e2 && D("can not split past the node's length");
      const r2 = e2 - n2, o2 = xt(t3, n2, r2), i2 = new (s()).Text(o2);
      i2.ownerDocument = t3.ownerDocument;
      const u2 = t3.parentNode;
      if (u2 !== null) {
        B(i2, u2, t3.nextSibling);
        const e3 = g(t3) + 1;
        s().forEachRange((r3) => {
          r3.startContainer === t3 && r3.startOffset > n2 && (r3.startContainer = i2, r3.startOffset -= n2), r3.endContainer === t3 && r3.endOffset > n2 && (r3.endContainer = i2, r3.endOffset -= n2), r3.startContainer === u2 && r3.startOffset === e3 && (r3.startOffset += 1), r3.endContainer === u2 && r3.endOffset === e3 && (r3.endOffset += 1);
        });
      }
      return bt(t3, n2, r2, ""), i2;
    }(this, t2 = st(t2));
  }
  T(t2) {
    const n2 = new (s()).Text(this.data);
    return n2.ownerDocument = t2, n2;
  }
  get wholeText() {
    const t2 = [this.data];
    let n2 = this.previousSibling;
    for (; n2 !== null && u(n2, 3, 4); ) {
      const e3 = n2.data;
      t2.unshift(e3), n2 = n2.previousSibling;
    }
    let e2 = this.nextSibling;
    for (; e2 !== null && u(e2, 3, 4); ) {
      const n3 = e2.data;
      t2.push(n3), e2 = e2.nextSibling;
    }
    return t2.join("");
  }
}
class CDATASection extends Text {
  get nodeType() {
    return 4;
  }
  get nodeName() {
    return "#cdata-section";
  }
  constructor(t2) {
    super(t2);
  }
  T(t2) {
    const n2 = new (s()).CDATASection(this.data);
    return n2.ownerDocument = t2, n2;
  }
}
class vt extends CharacterData {
  get nodeType() {
    return 8;
  }
  get nodeName() {
    return "#comment";
  }
  constructor(t2 = "") {
    super(t2);
    const n2 = s();
    this.ownerDocument = n2.document;
  }
  T(t2) {
    const n2 = new (s()).Comment(this.data);
    return n2.ownerDocument = t2, n2;
  }
}
class DocumentType extends Node {
  get nodeType() {
    return 10;
  }
  get nodeName() {
    return this.name;
  }
  get nodeValue() {
    return null;
  }
  set nodeValue(t2) {
  }
  get textContent() {
    return null;
  }
  set textContent(t2) {
  }
  lookupPrefix(t2) {
    return N(arguments, 1), null;
  }
  lookupNamespaceURI(t2) {
    return N(arguments, 1), null;
  }
  before(...t2) {
    nt(this, t2);
  }
  after(...t2) {
    et(this, t2);
  }
  replaceWith(...t2) {
    rt(this, t2);
  }
  remove() {
    ot(this);
  }
  constructor(t2, n2 = "", e2 = "") {
    super(), this.name = t2, this.publicId = n2, this.systemId = e2;
  }
  T(t2) {
    const n2 = new (s()).DocumentType(this.name, this.publicId, this.systemId);
    return n2.ownerDocument = t2, n2;
  }
}
function Nt(t2, n2, e2, r2, o2) {
  return new Attr(t2, n2, e2, r2, o2);
}
function St(t2, n2, e2, r2 = null) {
  return wo(t2, n2, e2, r2);
}
function Et(t2, n2) {
  gt(t2, n2);
}
const Tt = "http://www.w3.org/1999/xhtml", Ct = "http://www.w3.org/XML/1998/namespace", Dt = "http://www.w3.org/2000/xmlns/";
function $t(t2) {
  (function(t3) {
    const n2 = t3.split(":");
    return !(n2.length > 2) && n2.every((t4) => Hr(t4));
  })(t2) || $("The qualified name is not a valid QName");
}
function At(t2, n2) {
  t2 === "" && (t2 = null), $t(n2);
  let e2 = null, r2 = n2;
  const o2 = n2.indexOf(":");
  return o2 >= 0 && (e2 = n2.substring(0, o2), r2 = n2.substring(o2 + 1)), e2 !== null && t2 === null && k("Qualified name with prefix can not have a null namespace"), e2 === "xml" && t2 !== Ct && k("xml prefix can only be used for the XML namespace"), n2 !== "xmlns" && e2 !== "xmlns" || t2 === Dt || k("xmlns prefix or qualifiedName must use the XMLNS namespace"), t2 === Dt && n2 !== "xmlns" && e2 !== "xmlns" && k("xmlns prefix or qualifiedName must be used for the XMLNS namespace"), {namespace: t2, prefix: e2, localName: r2};
}
function It(t2, n2) {
  if (t2.namespaceURI === n2 && t2.prefix !== null)
    return t2.prefix;
  const e2 = Array.from(t2.attributes).find((t3) => t3.prefix === "xmlns" && t3.value === n2);
  return e2 ? e2.localName : t2.parentElement !== null ? It(t2.parentElement, n2) : null;
}
function kt(t2, n2) {
  return {success: true, offset: t2, value: n2};
}
function Mt(t2) {
  return kt(t2, void 0);
}
function Rt(t2, n2, e2 = false) {
  return {success: false, offset: t2, expected: n2, fatal: e2};
}
function Pt(t2) {
  return (n2, e2) => {
    const r2 = e2 + t2.length;
    return n2.slice(e2, r2) === t2 ? kt(r2, t2) : Rt(e2, [t2]);
  };
}
function Lt(t2, n2) {
  return (e2, r2) => {
    const o2 = e2.codePointAt(r2);
    return o2 !== void 0 && t2(o2) ? Mt(r2 + function(t3) {
      return t3 > 65535 ? 2 : 1;
    }(o2)) : Rt(r2, n2);
  };
}
function Ot(t2, n2) {
  return (e2, r2) => {
    const o2 = r2;
    for (; ; ) {
      const n3 = e2.codePointAt(r2);
      if (n3 === void 0)
        break;
      if (!t2(n3))
        break;
      r2 += n3 > 65535 ? 2 : 1;
    }
    return n2 !== void 0 && r2 === o2 ? Rt(r2, n2) : Mt(r2);
  };
}
function zt(t2, n2, e2) {
  return Lt((e3) => t2 <= e3 && e3 <= n2, e2 || [`${String.fromCodePoint(t2)}-${String.fromCodePoint(n2)}`]);
}
function Ft(t2, n2) {
  return (e2, r2) => {
    const o2 = t2(e2, r2);
    return o2.success ? kt(o2.offset, n2(o2.value)) : o2;
  };
}
function Vt(t2) {
  return Ft(t2, () => {
  });
}
function Ut(t2, n2, e2, r2) {
  return (o2, i2) => {
    const s2 = t2(o2, i2);
    return s2.success ? n2(s2.value) ? s2 : Rt(i2, e2, r2) : s2;
  };
}
function qt(t2, n2) {
  return (e2, r2) => {
    let o2 = null;
    for (const i2 of t2) {
      const t3 = i2(e2, r2);
      if (t3.success)
        return t3;
      if (o2 === null || t3.offset > o2.offset ? o2 = t3 : t3.offset === o2.offset && n2 === void 0 && (o2.expected = o2.expected.concat(t3.expected)), t3.fatal)
        return t3;
    }
    return n2 = n2 || (o2 == null ? void 0 : o2.expected) || [], o2 && (o2.expected = n2), o2 || Rt(r2, n2);
  };
}
function _t(t2) {
  return (n2, e2) => {
    const r2 = t2(n2, e2);
    return r2.success || r2.fatal ? r2 : kt(e2, null);
  };
}
function Bt(t2) {
  return (n2, e2) => {
    let r2 = [], o2 = e2;
    for (; ; ) {
      const e3 = t2(n2, o2);
      if (!e3.success) {
        if (e3.fatal)
          return e3;
        break;
      }
      if (r2.push(e3.value), e3.offset === o2)
        break;
      o2 = e3.offset;
    }
    return kt(o2, r2);
  };
}
function Wt(t2) {
  return (n2, e2) => {
    let r2 = e2;
    for (; ; ) {
      const e3 = t2(n2, r2);
      if (!e3.success) {
        if (e3.fatal)
          return e3;
        break;
      }
      if (e3.offset === r2)
        break;
      r2 = e3.offset;
    }
    return Mt(r2);
  };
}
function Xt(t2, n2, e2) {
  return (r2, o2) => {
    const i2 = t2(r2, o2);
    if (!i2.success)
      return i2;
    const s2 = n2(r2, i2.offset);
    return s2.success ? kt(s2.offset, e2(i2.value, s2.value)) : s2;
  };
}
function Yt(...t2) {
  return (n2, e2) => {
    const r2 = [];
    for (const o2 of t2) {
      const t3 = o2(n2, e2);
      if (!t3.success)
        return t3;
      e2 = t3.offset, r2.push(t3.value);
    }
    return kt(e2, r2);
  };
}
function Ht(...t2) {
  return (n2, e2) => {
    for (const r2 of t2) {
      const t3 = r2(n2, e2);
      if (!t3.success)
        return t3;
      e2 = t3.offset;
    }
    return Mt(e2);
  };
}
function jt(t2, n2) {
  return t2;
}
function Qt(t2, n2) {
  return n2;
}
function Kt(t2) {
  return Xt(t2, Wt(t2), Qt);
}
function Gt(t2, n2) {
  return Xt(t2, n2, Qt);
}
function Jt(t2, n2) {
  return Xt(t2, n2, jt);
}
function Zt(t2, n2, e2, r2 = false) {
  return Gt(t2, r2 ? sn(Jt(n2, e2)) : Jt(n2, e2));
}
function tn(t2) {
  return (n2, e2) => {
    const r2 = t2(n2, e2);
    return r2.success ? kt(r2.offset, n2.slice(e2, r2.offset)) : r2;
  };
}
function nn(t2) {
  return (n2, e2) => {
    const r2 = t2(n2, e2);
    return r2.success ? kt(e2, r2.value) : r2;
  };
}
function en(t2, n2) {
  return (e2, r2) => t2(e2, r2).success ? Rt(r2, n2) : Mt(r2);
}
function rn(t2, n2, e2) {
  return Gt(en(n2, e2), t2);
}
function on(t2, n2, e2 = 0, r2 = []) {
  return (o2, i2) => {
    const s2 = o2.codePointAt(i2 + e2);
    if (s2 === void 0)
      return Rt(i2, r2);
    const u2 = t2[s2];
    return u2 === void 0 ? n2 === void 0 ? Rt(i2, r2) : n2(o2, i2) : u2(o2, i2);
  };
}
function sn(t2) {
  return (n2, e2) => {
    const r2 = t2(n2, e2);
    return r2.success ? r2 : Rt(r2.offset, r2.expected, true);
  };
}
const un = (t2, n2) => t2.length === n2 ? Mt(n2) : Rt(n2, ["end of input"]);
function ln(t2) {
  return Xt(t2, un, jt);
}
class cn {
  constructor(t2, n2) {
    this.$ = 0, this.A = 0, this.I = t2, this.k = n2;
  }
  next() {
    if (this.$ >= this.k.length)
      return {done: true, value: un(this.I, this.A)};
    const {parser: t2, type: n2} = this.k[this.$], e2 = t2(this.I, this.A);
    return e2.success ? (this.A = e2.offset, n2 !== 1 && (this.$ += 1), e2.value === void 0 ? this.next() : {done: false, value: e2.value}) : n2 === 0 || e2.fatal ? {done: true, value: e2} : (this.$ += 1, this.next());
  }
}
function an(t2) {
  return (n2, e2) => {
    const r2 = e2, o2 = t2(n2, e2);
    return o2.success ? kt(o2.offset, Object.assign({input: n2, start: r2, end: o2.offset}, o2.value)) : o2;
  };
}
const hn = Pt("_"), fn = Pt("-"), dn = Pt("."), mn = Pt('"'), pn = Pt("'"), gn = Pt("<"), wn = Pt(">"), yn = Pt("&"), bn = Pt("="), xn = Pt("["), vn = Pt("]"), Nn = Pt(";"), Sn = Pt("%"), En = Pt("("), Tn = Pt(")"), Cn = Pt("+"), Dn = Pt(","), $n = Pt("?"), An = Pt("*"), In = Pt("|"), kn = Pt("]]>"), Mn = Pt("<!--"), Rn = Pt("-->"), Pn = Pt("<?"), Ln = Pt("?>"), On = Pt("1."), zn = Pt("version"), Fn = Pt("encoding"), Vn = Pt("standalone"), Un = Pt("yes"), qn = Pt("no"), _n = Pt("<?xml"), Bn = Pt("<!DOCTYPE"), Wn = Pt("SYSTEM"), Xn = Pt("PUBLIC"), Yn = Pt("</"), Hn = Pt("/>"), jn = Pt("&#"), Qn = Pt("&#x"), Kn = Pt("<!ELEMENT"), Gn = Pt("EMPTY"), Jn = Pt("ANY"), Zn = Pt("#PCDATA"), te = Pt("<!ATTLIST"), ne = Pt("NOTATION"), ee = Pt("#REQUIRED"), re = Pt("#IMPLIED"), oe = Pt("#FIXED"), ie = Pt("<!ENTITY"), se = Pt("NDATA"), ue = Pt("<!NOTATION"), le = 65, ce = 90, ae = zt(le, ce), he = 97, fe = 122, de = zt(he, fe), me = zt(48, 57), pe = qt([me, zt(65, 70), zt(97, 102)], ["hexadecimal digit"]);
function ge(t2) {
  return t2 === 9 || t2 === 10 || t2 === 13 || 32 <= t2 && t2 <= 55295 || 57344 <= t2 && t2 <= 65533 || 65536 <= t2 && t2 <= 1114111;
}
const we = ln(Ot(ge));
function ye(t2) {
  return t2 === 32 || t2 === 9 || t2 === 13 || t2 === 10;
}
const be = Ot(ye, ["whitespace"]), xe = ln(Ot(ye)), ve = 58, Ne = 95;
function Se(t2) {
  return t2 === ve || le <= t2 && t2 <= ce || t2 === Ne || he <= t2 && t2 <= fe || 192 <= t2 && t2 <= 214 || 216 <= t2 && t2 <= 246 || 248 <= t2 && t2 <= 767 || 880 <= t2 && t2 <= 893 || 895 <= t2 && t2 <= 8191 || 8204 <= t2 && t2 <= 8205 || 8304 <= t2 && t2 <= 8591 || 11264 <= t2 && t2 <= 12271 || 12289 <= t2 && t2 <= 55295 || 63744 <= t2 && t2 <= 64975 || 65008 <= t2 && t2 <= 65533 || 65536 <= t2 && t2 <= 983039;
}
const Ee = Lt(Se, ["valid name start character"]);
function Te(t2) {
  return Se(t2) || t2 === 45 || t2 === 46 || 48 <= t2 && t2 <= 57 || t2 === 183 || 768 <= t2 && t2 <= 879 || 8255 <= t2 && t2 <= 8256;
}
const Ce = tn(Gt(Ee, Ot(Te))), De = ln(Ce), $e = Ut(Ce, (t2) => !t2.includes(":"), ["name must not contain colon"], true), Ae = tn(Ot(Te, ["valid name character"])), Ie = an(Ft(Ut(qt([Ft(Zt(Qn, tn(Kt(pe)), Nn, true), (t2) => parseInt(t2, 16)), Ft(Zt(jn, tn(Kt(me)), Nn, true), (t2) => parseInt(t2, 10))]), (t2) => ge(t2), ["character reference must reference a valid character"], true), (t2) => ({type: 0, cp: t2}))), ke = qt([an(Ft(Zt(yn, $e, sn(Nn)), (t2) => ({type: 1, name: t2}))), Ie]), Me = an(Ft(Zt(Sn, $e, Nn), (t2) => ({type: 2, name: t2}))), Re = 38, Pe = qt([Zt(mn, Bt(qt([tn(Ot((t2) => t2 !== 37 && t2 !== Re && t2 !== Le && ge(t2), [])), Me, ke])), mn, true), Zt(pn, Bt(qt([tn(Ot((t2) => t2 !== 37 && t2 !== Re && t2 !== Oe && ge(t2), [])), Me, ke])), pn, true)]), Le = 34, Oe = 39, ze = on({[Le]: Zt(mn, Bt(on({[Re]: ke}, tn(Ot((t2) => t2 !== Be && t2 !== Re && t2 !== Le && ge(t2), [])))), mn, true), [Oe]: Zt(pn, Bt(on({[Re]: ke}, tn(Ot((t2) => t2 !== Be && t2 !== Re && t2 !== Oe && ge(t2), [])))), pn, true)}, void 0, 0, ["quoted attribute value"]), Fe = ln(Bt(qt([tn(Ot((t2) => t2 !== Be && t2 !== Re && ge(t2), [])), ke]))), Ve = Ut(qt([Zt(mn, tn(Ot((t2) => t2 !== Le && ge(t2))), mn), Zt(pn, tn(Ot((t2) => t2 !== Oe && ge(t2))), pn)]), (t2) => !t2.includes("#"), ["system identifier must not contain a fragment identifier"], true);
function Ue(t2) {
  return t2 === 32 || t2 === 13 || t2 === 10 || he <= t2 && t2 <= fe || le <= t2 && t2 <= ce || 48 <= t2 && t2 <= 57 || 33 <= t2 && t2 <= 47 && t2 !== 34 && t2 !== 38 || 58 <= t2 && t2 <= 64 && t2 !== 60 && t2 !== 62 || t2 === 95;
}
const qe = ln(Ot(Ue)), _e = qt([Zt(mn, tn(Ot((t2) => t2 !== Le && Ue(t2))), mn, true), Zt(pn, tn(Ot((t2) => t2 !== Oe && Ue(t2))), pn, true)]), Be = 60, We = tn(Kt(qt([Ot((t2) => t2 !== Be && t2 !== Re && t2 !== 93 && ge(t2), []), rn(Vt(vn), kn, [])], ["character data"]))), Comment = Ft(Zt(Mn, tn(Wt(qt([Ot((t2) => t2 !== 45 && ge(t2), []), Jt(Vt(fn), en(fn, ["comment content may not contain --"]))]))), Rn, true), (t2) => ({type: 3, data: t2})), Xe = Ut($e, (t2) => t2.toLowerCase() !== "xml", ['processing instruction target must not be "xml"'], true), Ye = Zt(Pn, Xt(Xe, _t(Gt(be, tn(Wt(qt([Ot((t2) => t2 !== 63 && ge(t2), []), Jt(Vt($n), en(wn, ["PI data"]))]))))), (t2, n2) => ({type: 4, target: t2, data: n2})), Ln, true), He = Pt("<![CDATA["), je = tn(Wt(qt([Ot((t2) => t2 !== 93 && ge(t2), []), rn(Vt(vn), kn, ["CData"])]))), Qe = an(Ft(Zt(He, je, kn, true), (t2) => ({type: 5, data: t2}))), Ke = Zt(_t(be), bn, _t(be)), Ge = tn(Gt(On, Kt(me))), Je = Gt(be, Gt(zn, Gt(Ke, qt([Zt(mn, Ge, mn, true), Zt(pn, Ge, pn, true)])))), Ze = tn(Gt(qt([ae, de]), Wt(qt([ae, de, me, Vt(dn), Vt(hn), Vt(fn)])))), tr = Gt(be, Gt(Fn, Gt(Ke, qt([Zt(mn, Ze, mn, true), Zt(pn, Ze, pn, true)])))), nr = qt([Ft(Un, () => true), Ft(qn, () => false)]), er = Gt(be, Gt(Vn, sn(Gt(Ke, qt([Zt(mn, nr, mn, true), Zt(pn, nr, pn, true)]))))), rr = Zt(Jt(_n, nn(be)), Jt(Xt(Je, Xt(_t(tr), _t(er), (t2, n2) => [t2, n2]), (t2, [n2, e2]) => ({type: 6, version: t2, encoding: n2, standalone: e2})), _t(be)), Ln, true), or = an(Ft(Ce, (t2) => ({name: t2}))), ir = Xt(or, Gt(sn(Ke), sn(ze)), (t2, n2) => ({name: t2, value: n2})), sr = Ft(Yt(gn, or, sn(Jt(Bt(Gt(be, ir)), _t(be))), sn(on({47: Ft(Hn, () => true)}, Ft(wn, () => false), 0, [">", "/>"]))), ([t2, n2, e2, r2]) => ({type: r2 ? 9 : 7, name: n2, attributes: e2})), ur = an(Ft(Zt(Yn, Jt(Ce, _t(be)), wn, true), (t2) => ({type: 8, name: t2}))), lr = qt([$n, An, Cn]), cr = Jt(qt([Vt(Ce), function(t2, n2) {
  return ar(t2, n2);
}, function(t2, n2) {
  return hr(t2, n2);
}]), Vt(_t(lr))), ar = Ht(En, _t(be), cr, Kt(Yt(_t(be), In, _t(be), sn(cr))), _t(be), Tn);
const hr = Ht(En, _t(be), cr, Wt(Yt(_t(be), Dn, _t(be), sn(cr))), _t(be), Tn);
const fr = Jt(qt([ar, hr]), _t(lr)), dr = Ht(En, _t(be), Zn, qt([Ht(Wt(Ht(_t(be), In, _t(be), Ce)), _t(be), Tn, An), Vt(Jt(_t(be), Tn))])), mr = Jt(Kn, sn(Ht(be, Ce, be, qt([Vt(Gn), Vt(Jn), Vt(dr), Vt(fr)]), _t(be), wn))), pr = Pt("CDATA"), gr = qt([Pt("IDREFS"), Pt("IDREF"), Pt("ID"), Pt("ENTITY"), Pt("ENTITIES"), Pt("NMTOKENS"), Pt("NMTOKEN")]), wr = qt([Jt(ne, sn(Ht(be, En, _t(be), $e, Wt(Ht(_t(be), In, _t(be), $e)), _t(be), Tn))), Jt(En, sn(Ht(_t(be), Ae, Wt(Ht(_t(be), In, _t(be), Ae)), _t(be), Tn)))]), yr = qt([Ft(pr, () => true), Ft(gr, () => false), Ft(wr, () => false)]), br = qt([Ft(ee, () => ({type: 0})), Ft(re, () => ({type: 1})), Xt(Ft(_t(Jt(oe, be)), (t2) => t2 !== null), ze, (t2, n2) => ({type: 2, fixed: t2, value: n2}))]), xr = Xt(Gt(be, or), sn(Xt(Gt(be, yr), Gt(be, br), (t2, n2) => ({isCData: t2, def: n2}))), (t2, {isCData: n2, def: e2}) => ({name: t2, isCData: n2, def: e2})), vr = Zt(Jt(te, be), Xt(Ce, sn(Bt(xr)), (t2, n2) => ({type: 0, name: t2, attdefs: n2})), Gt(_t(be), wn), true), Nr = qt([Ft(Gt(Wn, sn(Gt(be, Ve))), (t2) => ({publicId: null, systemId: t2})), Gt(Xn, Xt(sn(Gt(be, _e)), Gt(be, Ve), (t2, n2) => ({publicId: t2, systemId: n2})))]), Sr = qt([Pe, Xt(Nr, _t(Gt(Zt(be, se, be), $e)), (t2, n2) => ({ids: t2, ndata: n2}))]), Er = Zt(ie, Xt(Gt(be, $e), sn(Gt(be, Sr)), (t2, n2) => ({type: 1, name: t2, value: n2})), Gt(_t(be), wn)), Tr = qt([Pe, Vt(Nr)]), Cr = Zt(Jt(ie, Gt(be, Sn)), Xt(Gt(be, $e), sn(Gt(be, Tr)), (t2, n2) => n2 ? {type: 2, name: t2, value: n2} : void 0), Gt(_t(be), wn), true), Dr = Gt(nn(ie), sn(qt([Er, Cr]))), $r = Zt(Jt(_n, nn(be)), Jt(Xt(_t(Je), tr, (t2, n2) => ({type: 6, version: t2, encoding: n2, standalone: null})), _t(be)), Ln, true), Ar = Ft(Jt(Jt(Xn, be), sn(_e)), (t2) => ({publicId: t2, systemId: null})), Ir = Zt(ue, Xt(Zt(be, $e, be), qt([Vt(Nr), Vt(Ar)]), () => {
}), Gt(_t(be), wn), true), kr = qt([Vt(mr), vr, Dr, Vt(Ir), Vt(Ye), Vt(Comment)]), Mr = qt([Vt(Me), Vt(be)]), Rr = function(t2) {
  return Ft(t2, (t3) => t3.filter((t4) => t4 !== void 0));
}(Bt(qt([kr, Mr]))), Pr = Gt(Bn, sn(Ft(Yt(be, Ce, _t(Gt(be, Nr)), _t(be), _t(Jt(Zt(xn, Rr, vn, true), _t(be))), wn), ([t2, n2, e2, r2, o2, i2]) => ({type: 10, name: n2, ids: e2, intSubset: o2})))), Lr = {parser: on({[Be]: on({47: ur, 33: qt([Comment, Qe]), 63: Ye}, sr, 1), [Re]: ke}, We), type: 1};
function Or(t2) {
  return new cn(t2, [Lr]);
}
const zr = qt([Comment, Ye, be]), Fr = [...[{parser: rr, type: 2}, {parser: zr, type: 1}, {parser: Pr, type: 2}, {parser: zr, type: 1}], ...[{parser: sr, type: 0}, Lr]];
function Vr(t2) {
  return new cn(t2, Fr);
}
const Ur = [{parser: $r, type: 2}, Lr];
function qr(t2) {
  return new cn(t2, Ur);
}
function _r(t2) {
  return Array.from(t2, (t3) => Yr(t3) ? t3 : "[invalid character]").join("");
}
function Br(t2, n2, e2) {
  const r2 = Array.from(t2);
  if (r2.length < e2)
    return t2;
  switch (n2) {
    case 0:
      return "\u2026" + r2.slice(-e2).join("");
    case 1:
      return r2.slice(0, e2).join("") + "\u2026";
  }
  const o2 = 0 | Math.min(r2.length / 2, e2 / 2);
  return r2.slice(0, o2).join("") + "\u2026" + r2.slice(-o2).join("");
}
function Wr(t2, n2) {
  const {line: e2, char: r2} = function(t3, n3) {
    let e3 = 1, r3 = 1, o2 = 0;
    for (; o2 < n3; ) {
      const n4 = t3.codePointAt(o2);
      r3++, o2 += n4 > 65535 ? 2 : 1, n4 === 10 && (e3++, r3 = 1);
    }
    return {line: e3, char: r3};
  }(n2.input, n2.start);
  throw new Error(`${t2}
${`At line ${e2}, character ${r2}:`}

${function(t3, n3, e3) {
    const r3 = Br(_r(t3.substring(n3, e3)), 2, 30), o2 = t3.lastIndexOf("\n", n3), i2 = Br(_r(t3.substring(o2 + 1, n3)), 0, 55 - r3.length), s2 = t3.indexOf("\n", e3), u2 = Br(_r(s2 > 0 ? t3.substring(e3, s2) : t3.substring(e3)), 1, 80 - r3.length - i2.length), l2 = Array.from(i2, (t4) => jr(t4) ? t4 : " ").join("");
    return `${i2}${r3}${u2}
${l2}${"^".repeat(Math.max(Array.from(r3).length, 1))}`;
  }(n2.input, n2.start, n2.end)}`);
}
function Xr(t2, n2, e2, r2) {
  const o2 = Array.from(new Set(e2), (t3) => t3.includes('"') ? `'${t3}'` : `"${t3}"`), i2 = n2.codePointAt(r2), s2 = i2 ? String.fromCodePoint(i2) : "";
  Wr(`Parsing ${t2} failed, expected ${o2.length > 1 ? "one of " + o2.join(", ") : o2[0]}`, {input: n2, start: r2, end: r2 + Math.max(s2.length, 1)});
}
function Yr(t2) {
  return we(t2, 0).success;
}
function Hr(t2) {
  return De(t2, 0).success;
}
function jr(t2) {
  return xe(t2, 0).success;
}
function Qr(t2) {
  const n2 = [];
  for (const e2 of t2)
    if (typeof e2 != "string")
      switch (e2.type) {
        case 0:
          n2.push(String.fromCodePoint(e2.cp));
          break;
        case 1:
          n2.push(`&${e2.name};`);
          break;
        case 2:
          Wr(`reference to parameter entity "${e2.name}" must not occur in an entity declaration in the internal subset`, e2);
      }
    else
      n2.push(e2);
  return n2.join("");
}
class Kr {
  constructor(t2) {
    if (this.M = new Map(), this.R = new Map(), this.P = new Set(), this.L = new Set(), t2.intSubset)
      for (const n2 of t2.intSubset)
        switch (n2.type) {
          case 0: {
            for (const t4 of n2.attdefs)
              if (t4.def.type === 2)
                for (const n3 of t4.def.value)
                  typeof n3 != "string" && n3.type === 1 && (this.R.has(n3.name) || this.P.has(n3.name) || this.L.has(n3.name) || Wr(`default value of attribute "${t4.name.name}" contains reference to undefined entity "${n3.name}"`, n3), this.P.has(n3.name) && Wr(`default value of attribute "${t4.name.name}" must not contain reference to external entity "${n3.name}"`, n3));
            let t3 = this.M.get(n2.name);
            t3 === void 0 && (t3 = new Map(), this.M.set(n2.name, t3));
            for (const e2 of n2.attdefs)
              t3.has(e2.name.name) || t3.set(e2.name.name, e2);
            break;
          }
          case 2:
            if (Array.isArray(n2.value))
              for (const t3 of n2.value)
                typeof t3 != "string" && t3.type === 2 && Wr(`reference to parameter entity "${t3.name}" must not occur in an entity declaration in the internal subset`, t3);
            break;
          case 1:
            if (this.R.has(n2.name) || this.P.has(n2.name))
              continue;
            Array.isArray(n2.value) ? this.R.set(n2.name, Qr(n2.value)) : n2.value.ndata === null ? this.P.add(n2.name) : this.L.add(n2.name);
        }
  }
  getAttlist(t2) {
    return this.M.get(t2.name);
  }
  getEntityReplacementText(t2, n2) {
    const e2 = this.R.get(t2.name);
    if (e2 === void 0 && (this.L.has(t2.name) && Wr(`reference to binary entity "${t2.name}" is not allowed`, t2), this.P.has(t2.name))) {
      if (n2)
        return "";
      Wr(`reference to external entity "${t2.name}" is not allowed in attribute value`, t2);
    }
    return e2;
  }
}
const Gr = new Map([["lt", "&#60;"], ["gt", ">"], ["amp", "&#38;"], ["apos", "'"], ["quot", '"']]);
function Jr(t2, n2, e2, r2) {
  for (const o2 of n2) {
    if (typeof o2 == "string") {
      t2.push(o2.replace(/[\r\n\t]/g, " "));
      continue;
    }
    if (o2.type === 0) {
      t2.push(String.fromCodePoint(o2.cp));
      continue;
    }
    r2 !== null && r2.includes(o2.name) && Wr(`reference to entity "${o2.name}" must not be recursive`, o2);
    let n3 = Gr.get(o2.name);
    n3 === void 0 && e2 !== null && (n3 = e2.getEntityReplacementText(o2, false)), n3 === void 0 && Wr(`reference to unknown entity "${o2.name}" in attribute value`, o2);
    const i2 = Fe(n3, 0);
    i2.success || Xr(`replacement text for entity "${o2.name}"`, n3, i2.expected, i2.offset), Jr(t2, i2.value, e2, r2 ? [o2.name, ...r2] : [o2.name]);
  }
}
function Zr(t2, n2, e2) {
  const r2 = [];
  return Jr(r2, t2, e2, null), n2 && !n2.isCData ? r2.join("").replace(/[ ]+/g, " ").replace(/^[ ]+|[ ]+$/g, "") : r2.join("");
}
function to(t2, n2) {
  const e2 = t2.name, r2 = n2.get(e2);
  if (r2 !== void 0)
    return r2;
  let o2 = null, i2 = e2;
  const s2 = e2.indexOf(":");
  s2 >= 0 && (o2 = e2.substring(0, s2), i2 = e2.substring(s2 + 1)), (o2 === "" || i2 === "" || i2.includes(":")) && Wr(`the name "${e2}" is not a valid qualified name`, t2);
  const u2 = {prefix: o2, localName: i2};
  return n2.set(e2, u2), u2;
}
class no {
  constructor(t2, n2 = null) {
    var e2;
    this.O = new Map(), this.F = null, this.V = t2, this.F = (e2 = n2 != null ? n2 : t2 == null ? void 0 : t2.F) !== null && e2 !== void 0 ? e2 : null;
  }
  getForElement(t2, n2) {
    t2 === "xmlns" && Wr('element names must not have the prefix "xmlns"', n2);
    for (let n3 = this; n3 !== null; n3 = n3.V) {
      const e2 = n3.O.get(t2);
      if (e2 !== void 0)
        return e2;
    }
    if (t2 !== null && this.F) {
      const n3 = this.F(t2);
      if (n3 !== void 0)
        return n3;
    }
    Wr(`use of undeclared element prefix "${t2}"`, n2);
  }
  getForAttribute(t2, n2, e2) {
    if (t2 === null)
      return n2 === "xmlns" ? Dt : null;
    for (let n3 = this; n3 !== null; n3 = n3.V) {
      const e3 = n3.O.get(t2);
      if (e3 !== void 0)
        return e3;
    }
    if (this.F) {
      const n3 = this.F(t2);
      if (n3 !== void 0)
        return n3;
    }
    Wr(`use of undeclared attribute prefix ${t2}`, e2);
  }
  static fromAttrs(t2, n2, e2, r2, o2) {
    let i2 = t2, s2 = false;
    const u2 = (n3, e3, r3) => {
      n3 !== null || e3 !== Ct && e3 !== Dt || Wr(`the namespace "${e3}" must not be used as the default namespace`, r3), e3 === Dt && Wr(`the namespace "${Dt}" must not be bound to a prefix`, r3), e3 === Ct && n3 !== "xml" && Wr(`the namespace "${Ct}" must be bound only to the prefix "xml"`, r3), e3 !== Ct && n3 === "xml" && Wr(`the xml namespace prefix must not be bound to any namespace other than "${Ct}"`, r3), n3 !== null && e3 === null && Wr(`the prefix "${n3}" must not be undeclared`, r3), s2 || (i2 = new no(t2), s2 = true), i2.O.set(n3, e3);
    }, l2 = (t3, n3) => {
      const {prefix: l3, localName: c2} = to(t3, o2), a2 = e2 == null ? void 0 : e2.get(t3.name);
      if (l3 !== null || c2 !== "xmlns" || s2 && i2.O.has(null)) {
        if (!(l3 !== "xmlns" || s2 && i2.O.has(c2))) {
          c2 === "xmlns" && Wr('the "xmlns" namespace prefix must not be declared', t3);
          const e3 = Zr(n3, a2, r2) || null;
          u2(c2, e3, t3);
        }
      } else {
        const e3 = Zr(n3, a2, r2) || null;
        u2(null, e3, t3);
      }
    };
    for (const t3 of n2.attributes)
      l2(t3.name, t3.value);
    if (e2)
      for (const t3 of e2.values()) {
        const n3 = t3.def;
        n3.type === 2 && l2(t3.name, n3.value);
      }
    return i2;
  }
  static default(t2) {
    const n2 = new no(null, t2);
    return n2.O.set(null, null), n2.O.set("xml", Ct), n2.O.set("xmlns", Dt), n2;
  }
}
const eo = no.default(null);
function ro(t2, n2) {
  B(n2, t2, null, true);
}
const oo = 100, io = 4194304;
function so(t2, n2, e2, r2, {entityExpansionMaxAmplification: o2 = oo, entityExpansionThreshold: i2 = io}) {
  var s2, u2;
  const l2 = p(r2);
  let c2 = {parent: null, root: r2, namespaces: e2, entityRoot: true}, a2 = null;
  const f2 = new Map();
  let d2 = [];
  function m2() {
    if (d2.length > 0) {
      const t3 = d2.join("");
      if (c2.root === l2) {
        if (!jr(t3))
          throw new Error("document must not contain text outside of elements");
      } else
        ro(c2.root, l2.createTextNode(d2.join("")));
      d2.length = 0;
    }
  }
  const g2 = (t2 = function(t3) {
    return t3.replace(/\r\n?/g, "\n");
  }(t2 = t2.replace(/^\ufeff/, ""))).length;
  let w2 = g2, y2 = null, b2 = {parent: null, entity: null, iterator: n2(t2)};
  for (; b2; ) {
    let n3 = b2.iterator.next();
    for (; !n3.done; n3 = b2.iterator.next()) {
      const t3 = n3.value;
      if (typeof t3 != "string") {
        switch (t3.type) {
          case 0:
            c2.root === l2 && l2.documentElement !== null && Wr("character reference must not appear after the document element", t3), d2.push(String.fromCodePoint(t3.cp));
            continue;
          case 1: {
            c2.root === l2 && l2.documentElement !== null && Wr(`reference to entity "${t3.name}" must not appear after the document element`, t3);
            for (let n5 = b2; n5; n5 = n5.parent)
              n5.entity === t3.name && Wr(`reference to entity "${t3.name}" must not be recursive`, t3);
            let n4 = Gr.get(t3.name);
            if (n4 === void 0 && a2 !== null && (n4 = a2.getEntityReplacementText(t3, true)), n4 === void 0 && Wr(`reference to unknown entity "${t3.name}" in content`, t3), y2 === null && (y2 = t3), w2 += n4.length, w2 > i2) {
              w2 / g2 > o2 && Wr("too much entity expansion", y2);
            }
            c2 = {parent: c2, root: c2.root, namespaces: c2.namespaces, entityRoot: true}, b2 = {parent: b2, entity: t3.name, iterator: Or(n4)};
            continue;
          }
        }
        switch (m2(), t3.type) {
          case 5:
            c2.root === l2 && l2.documentElement !== null && Wr("CData section must not appear after the document element", t3), ro(c2.root, l2.createCDATASection(t3.data));
            continue;
          case 3:
            ro(c2.root, l2.createComment(t3.data));
            continue;
          case 10:
            a2 = new Kr(t3), ro(c2.root, l2.implementation.createDocumentType(t3.name, ((s2 = t3.ids) === null || s2 === void 0 ? void 0 : s2.publicId) || "", ((u2 = t3.ids) === null || u2 === void 0 ? void 0 : u2.systemId) || ""));
            continue;
          case 4:
            ro(c2.root, l2.createProcessingInstruction(t3.target, t3.data || ""));
            continue;
          case 7:
          case 9: {
            c2.root === l2 && l2.documentElement !== null && Wr(`document must contain a single root element, but found "${l2.documentElement.nodeName}" and "${t3.name.name}"`, t3.name);
            const n4 = a2 ? a2.getAttlist(t3.name) : void 0, e3 = no.fromAttrs(c2.namespaces, t3, n4, a2, f2), {prefix: r3, localName: o3} = to(t3.name, f2), i3 = e3.getForElement(r3, t3.name), s3 = St(l2, o3, i3, r3);
            for (const r4 of t3.attributes) {
              const {prefix: o4, localName: i4} = to(r4.name, f2), u3 = e3.getForAttribute(o4, i4, r4.name), l3 = n4 == null ? void 0 : n4.get(r4.name.name);
              s3.hasAttributeNS(u3, i4) && Wr(`attribute "${r4.name.name}" must not appear multiple times on element "${t3.name.name}"`, r4.name);
              gt(Nt(u3, o4, i4, Zr(r4.value, l3, a2), s3), s3, true);
            }
            if (n4)
              for (const t4 of n4.values()) {
                const n5 = t4.def;
                if (n5.type !== 2)
                  continue;
                const {prefix: r4, localName: o4} = to(t4.name, f2), i4 = e3.getForAttribute(r4, o4, t4.name);
                if (s3.hasAttributeNS(i4, o4))
                  continue;
                gt(Nt(i4, r4, o4, Zr(n5.value, t4, a2), s3), s3, true);
              }
            ro(c2.root, s3), t3.type === 7 && (c2 = {parent: c2, root: s3, namespaces: e3, entityRoot: false});
            continue;
          }
          case 8:
            h(c2.root) && c2.root.nodeName === t3.name || Wr(`non-well-formed element: found end tag "${t3.name}" but expected ${h(c2.root) ? `"${c2.root.nodeName}"` : "no such tag"}`, t3), c2 = c2.parent;
            continue;
        }
      } else
        d2.push(t3);
    }
    if (n3.value.success || Xr(b2.entity ? `replacement text for entity ${b2.entity}` : r2 === l2 ? "document" : "fragment", t2, n3.value.expected, n3.value.offset), !c2.entityRoot)
      throw new Error(`${b2.entity ? `replacement text for entity "${b2.entity}"` : r2 === l2 ? "document" : "fragment"} is not well-formed - element "${c2.root.nodeName}" is missing a closing tag`);
    b2 = b2.parent, b2 && (c2 = c2.parent, b2.entity === null && (y2 = null));
  }
  m2();
}
function uo(t2, n2 = {}) {
  const e2 = new Document().createDocumentFragment();
  return so(t2, qr, n2.resolveNamespacePrefix ? no.default(n2.resolveNamespacePrefix) : eo, e2, {}), e2;
}
function lo(t2, n2 = {}) {
  const e2 = new Document();
  return so(t2, Vr, eo, e2, n2), e2;
}
class co {
  constructor() {
    this.U = new Map();
  }
  copy() {
    const t2 = new co();
    for (const [n2, e2] of Array.from(this.U.entries()))
      t2.U.set(n2, e2.concat());
    return t2;
  }
  retrievePreferredPrefixString(t2, n2) {
    const e2 = this.U.get(n2);
    if (e2 === void 0)
      return null;
    for (const n3 of e2)
      if (n3 === t2)
        return n3;
    return e2[e2.length - 1];
  }
  checkIfFound(t2, n2) {
    const e2 = this.U.get(n2);
    return e2 !== void 0 && e2.indexOf(t2) >= 0;
  }
  add(t2, n2) {
    const e2 = this.U.get(n2);
    e2 === void 0 ? this.U.set(n2, [t2]) : e2.push(t2);
  }
}
const ao = ["area", "base", "basefont", "bgsound", "br", "col", "embed", "frame", "hr", "img", "input", "keygen", "link", "menuitem", "meta", "param", "source", "track", "wbr"];
function ho(t2, n2, e2 = false) {
  const r2 = e2 ? [t2] : t2.childNodes, o2 = [];
  for (const t3 of r2)
    fo(t3, n2, o2);
  return o2.join("");
}
function fo(t2, n2, e2) {
  const r2 = new co();
  r2.add("xml", Ct);
  const o2 = {value: 1};
  try {
    mo(t2, null, r2, o2, n2, e2);
  } catch (t3) {
    return I(t3.message);
  }
}
function mo(t2, n2, e2, r2, o2, i2) {
  switch (t2.nodeType) {
    case 1:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3 && (s2.localName.indexOf(":") >= 0 || !Hr(s2.localName)))
          throw new Error(`Can not serialize an element because the localName "${s2.localName}" is not allowed.`);
        i3.push("<");
        let u2 = "", l2 = false, c2 = false;
        const a2 = e3.copy(), h2 = {}, f2 = function(t4, n4, e4) {
          let r4 = null;
          for (const o4 of t4.attributes) {
            const t5 = o4.namespaceURI, i4 = o4.prefix;
            if (t5 === Dt) {
              if (i4 === null) {
                r4 = o4.value;
                continue;
              }
              const t6 = o4.localName;
              let s3 = o4.value;
              if (s3 === Ct)
                continue;
              if (s3 === "" && (s3 = null), n4.checkIfFound(t6, s3))
                continue;
              n4.add(t6, s3), e4[t6] = s3 === null ? "" : s3;
            }
          }
          return r4;
        }(s2, a2, h2);
        let d2 = n3;
        const m2 = s2.namespaceURI;
        if (d2 === m2)
          f2 !== null && (c2 = true), u2 += m2 === Ct ? "xml:" + s2.localName : s2.localName, i3.push(u2);
        else {
          let t4 = s2.prefix, n4 = a2.retrievePreferredPrefixString(t4, m2);
          if (t4 === "xmlns") {
            if (o3)
              throw new Error('Can not serialize an element with prefix "xmlns" because it will not legally round-trip in a conforming XML parser.');
            n4 = t4;
          }
          n4 !== null ? (u2 += n4 + ":" + s2.localName, f2 !== null && f2 !== Ct && (d2 = f2 === "" ? null : f2), i3.push(u2)) : t4 !== null ? (t4 in h2 && (t4 = go(a2, m2, r3)), a2.add(t4, m2), u2 += t4 + ":" + s2.localName, i3.push(u2), i3.push(" xmlns:", t4, '="', po(m2, o3), '"'), f2 !== null && (d2 = f2 === "" ? null : f2)) : f2 === null || f2 !== null && f2 !== m2 ? (c2 = true, u2 += s2.localName, d2 = m2, i3.push(u2), i3.push(' xmlns="', po(m2, o3), '"')) : (u2 += s2.localName, d2 = m2, i3.push(u2));
        }
        (function(t4, n4, e4, r4, o4, i4, s3) {
          const u3 = [];
          for (const l3 of t4.attributes) {
            if (i4 && u3.find((t6) => t6.localName === l3.localName && t6.namespaceURI === l3.namespaceURI))
              throw new Error(`Can not serialize a duplicate attribute for namespaceURI "${l3.namespaceURI}", localName "${l3.localName}".`);
            u3.push({namespaceURI: l3.namespaceURI, localName: l3.localName});
            const t5 = l3.namespaceURI;
            let c3 = null;
            if (t5 !== null)
              if (c3 = n4.retrievePreferredPrefixString(l3.prefix, t5), t5 === Dt) {
                if (l3.value === Ct)
                  continue;
                if (l3.prefix === null && o4)
                  continue;
                if (l3.prefix !== null && (!(l3.localName in r4) || r4[l3.localName] !== l3.value))
                  continue;
                if (i4 && l3.value === Dt)
                  throw new Error("The serialization of this attribute would produce invalid XML because the XMLNS namespace is reserved and cannot be applied as an element's namespace via XML parsing.");
                if (i4 && l3.prefix !== null && l3.value === "")
                  throw new Error("Namespace prefix declarations cannot be used to undeclare a namespace. Use a default namespace declaration instead.");
                l3.prefix === "xmlns" && (c3 = "xmlns");
              } else
                c3 === null && (c3 = l3.prefix === null || l3.prefix in r4 ? go(n4, t5, e4) : l3.prefix, n4.add(c3, l3.namespaceURI), r4[c3] = l3.namespaceURI, s3.push(" xmlns:", c3, '="', po(t5, i4), '"'));
            if (s3.push(" "), c3 !== null && s3.push(c3, ":"), i4 && (l3.localName.indexOf(":") >= 0 || !Hr(l3.localName) || l3.localName === "xmlns" && t5 === null))
              throw new Error(`Can not serialize an attribute because the localName "${l3.localName}" is not allowed.`);
            s3.push(l3.localName, '="', po(l3.value, i4), '"');
          }
        })(s2, a2, r3, h2, c2, o3, i3), m2 === Tt && !s2.hasChildNodes() && ao.indexOf(s2.localName) >= 0 && (i3.push(" /"), l2 = true);
        m2 === Tt || s2.hasChildNodes() || (i3.push("/"), l2 = true);
        if (i3.push(">"), l2)
          return;
        for (const n4 of t3.childNodes)
          mo(n4, d2, a2, r3, o3, i3);
        i3.push("</", u2, ">");
      }(t2, n2, e2, r2, o2, i2);
    case 9:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3 && s2.documentElement === null)
          throw new Error("Can not serialize a document with no documentElement.");
        for (const t4 of s2.childNodes)
          mo(t4, n3, e3, r3, o3, i3);
      }(t2, n2, e2, r2, o2, i2);
    case 8:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3 && (!Yr(s2.data) || s2.data.indexOf("--") >= 0 || s2.data.endsWith("-")))
          throw new Error("Can not serialize a comment because it contains invalid characters.");
        i3.push("<!--", s2.data, "-->");
      }(t2, 0, 0, 0, o2, i2);
    case 4:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        i3.push("<![CDATA[", s2.data, "]]>");
      }(t2, 0, 0, 0, 0, i2);
    case 3:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3 && !Yr(s2.data))
          throw new Error("Can not serialize a text node because it contains invalid characters.");
        let u2 = s2.data;
        u2 = u2.replace(/&/g, "&amp;"), u2 = u2.replace(/</g, "&lt;"), u2 = u2.replace(/>/g, "&gt;"), i3.push(u2);
      }(t2, 0, 0, 0, o2, i2);
    case 11:
      return void function(t3, n3, e3, r3, o3, i3) {
        for (const s2 of t3.childNodes)
          mo(s2, n3, e3, r3, o3, i3);
      }(t2, n2, e2, r2, o2, i2);
    case 10:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3 && (u2 = s2.publicId, !qe(u2, 0).success))
          throw new Error("Can not serialize a document type because the publicId contains invalid characters.");
        var u2;
        if (o3 && (!Yr(s2.systemId) || s2.systemId.indexOf('"') >= 0 && s2.systemId.indexOf("'") >= 0))
          throw new Error("Can not serialize a document type because the systemId contains invalid characters.");
        i3.push("<!DOCTYPE"), i3.push(" "), i3.push(s2.name), s2.publicId !== "" && i3.push(' PUBLIC "', s2.publicId, '"');
        s2.systemId !== "" && s2.publicId === "" && i3.push(" SYSTEM");
        s2.systemId !== "" && i3.push(' "', s2.systemId, '"');
        i3.push(">");
      }(t2, 0, 0, 0, o2, i2);
    case 7:
      return void function(t3, n3, e3, r3, o3, i3) {
        const s2 = t3;
        if (o3) {
          if (s2.target.indexOf(":") >= 0)
            throw new Error(`Can not serialize a processing instruction because the target "${s2.target}" may not contain ":".`);
          if (s2.target.toLowerCase() === "xml")
            throw new Error('Can not serialize a processing instruction because "xml" may not be used as target.');
        }
        if (o3 && (!Yr(s2.data) || s2.data.indexOf("?>") >= 0))
          throw new Error("Can not serialize a processing instruction because the data contains invalid characters.");
        i3.push("<?", s2.target, " ", s2.data, "?>");
      }(t2, 0, 0, 0, o2, i2);
    case 2:
      return;
    default:
      throw new TypeError("Only Nodes and Attr objects can be serialized by this algorithm.");
  }
}
function po(t2, n2) {
  if (n2 && t2 !== null && !Yr(t2))
    throw new Error("Can not serialize an attribute value because it contains invalid characters.");
  return t2 === null ? "" : t2.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\t/g, "&#9;").replace(/\n/g, "&#10;").replace(/\r/g, "&#13;");
}
function go(t2, n2, e2) {
  const r2 = "ns" + e2.value;
  return e2.value += 1, t2.add(r2, n2), r2;
}
class Element extends Node {
  get nodeType() {
    return 1;
  }
  get nodeName() {
    return this.tagName;
  }
  get nodeValue() {
    return null;
  }
  set nodeValue(t2) {
  }
  get textContent() {
    return Q(this);
  }
  set textContent(t2) {
    K(this, t2 = lt(t2));
  }
  lookupPrefix(t2) {
    return N(arguments, 1), (t2 = ht(t2)) === null || t2 === "" ? null : It(this, t2);
  }
  lookupNamespaceURI(t2) {
    if (N(arguments, 1), (t2 = ht(t2)) === "" && (t2 = null), this.namespaceURI !== null && this.prefix === t2)
      return this.namespaceURI;
    let n2 = null;
    if (t2 !== null) {
      const e3 = this.getAttributeNodeNS(Dt, t2);
      e3 && e3.prefix === "xmlns" && (n2 = e3.value);
    } else {
      const t3 = this.getAttributeNodeNS(Dt, "xmlns");
      t3 && t3.prefix === null && (n2 = t3.value);
    }
    if (n2 !== null)
      return n2 !== "" ? n2 : null;
    const e2 = this.parentElement;
    return e2 === null ? null : e2.lookupNamespaceURI(t2);
  }
  before(...t2) {
    nt(this, t2);
  }
  after(...t2) {
    et(this, t2);
  }
  replaceWith(...t2) {
    rt(this, t2);
  }
  remove() {
    ot(this);
  }
  get children() {
    return z(this);
  }
  prepend(...t2) {
    J(this, t2);
  }
  append(...t2) {
    Z(this, t2);
  }
  replaceChildren(...t2) {
    tt(this, t2);
  }
  get previousElementSibling() {
    return F(this);
  }
  get nextElementSibling() {
    return V(this);
  }
  constructor(t2, n2, e2) {
    super(), this.firstElementChild = null, this.lastElementChild = null, this.childElementCount = 0, this.attributes = [], this.namespaceURI = t2, this.prefix = n2, this.localName = e2, this.tagName = n2 === null ? e2 : `${n2}:${e2}`;
  }
  hasAttributes() {
    return this.attributes.length > 0;
  }
  getAttribute(t2) {
    N(arguments, 1);
    const n2 = yo(t2 = String(t2), this);
    return n2 === null ? null : n2.value;
  }
  getAttributeNS(t2, n2) {
    N(arguments, 2);
    const e2 = bo(t2 = ht(t2), n2 = String(n2), this);
    return e2 === null ? null : e2.value;
  }
  setAttribute(t2, n2) {
    N(arguments, 2), t2 = String(t2), n2 = String(n2), Hr(t2) || $("The qualified name does not match the Name production");
    const e2 = yo(t2, this);
    if (e2 === null) {
      const e3 = new (s()).Attr(null, null, t2, n2, this);
      return e3.ownerDocument = this.ownerDocument, void gt(e3, this);
    }
    pt(e2, n2);
  }
  setAttributeNS(t2, n2, e2) {
    N(arguments, 3), t2 = ht(t2), n2 = String(n2), e2 = String(e2);
    const {namespace: r2, prefix: o2, localName: i2} = At(t2, n2);
    !function(t3, n3, e3, r3, o3) {
      const i3 = bo(o3, n3, t3);
      if (i3 === null) {
        const i4 = new (s()).Attr(o3, r3, n3, e3, t3);
        return i4.ownerDocument = t3.ownerDocument, void gt(i4, t3);
      }
      pt(i3, e3);
    }(this, i2, e2, o2, r2);
  }
  removeAttribute(t2) {
    N(arguments, 1), vo(t2 = String(t2), this);
  }
  removeAttributeNS(t2, n2) {
    N(arguments, 2), function(t3, n3, e2) {
      const r2 = bo(t3, n3, e2);
      r2 !== null && wt(r2);
    }(t2 = ht(t2), n2 = String(n2), this);
  }
  toggleAttribute(t2, n2) {
    Hr(t2) || $("The qualified name does not match the Name production");
    if (yo(t2, this) === null) {
      if (n2 === void 0 || n2 === true) {
        const n3 = new (s()).Attr(null, null, t2, "", this);
        return n3.ownerDocument = this.ownerDocument, gt(n3, this), true;
      }
      return false;
    }
    return n2 !== void 0 && n2 !== false || (vo(t2, this), false);
  }
  hasAttribute(t2) {
    return N(arguments, 1), yo(t2 = String(t2), this) !== null;
  }
  hasAttributeNS(t2, n2) {
    return N(arguments, 2), bo(t2 = ht(t2), n2 = String(n2), this) !== null;
  }
  getAttributeNode(t2) {
    return N(arguments, 1), yo(t2 = String(t2), this);
  }
  getAttributeNodeNS(t2, n2) {
    return N(arguments, 2), bo(t2 = ht(t2), n2 = String(n2), this);
  }
  setAttributeNode(t2) {
    return N(arguments, 1), xo(t2 = ct(t2, Attr), this);
  }
  setAttributeNodeNS(t2) {
    return N(arguments, 1), xo(t2 = ct(t2, Attr), this);
  }
  removeAttributeNode(t2) {
    return N(arguments, 1), t2 = ct(t2, Attr), this.attributes.indexOf(t2) < 0 && M("the specified attribute does not exist"), wt(t2), t2;
  }
  getElementsByTagName(t2) {
    return N(arguments, 1), b(t2 = String(t2), this);
  }
  getElementsByTagNameNS(t2, n2) {
    return N(arguments, 2), x(t2 = ht(t2), n2 = String(n2), this);
  }
  T(t2) {
    const n2 = wo(t2, this.localName, this.namespaceURI, this.prefix);
    for (const e2 of this.attributes) {
      const r2 = e2.T(t2);
      n2.setAttributeNode(r2);
    }
    return n2;
  }
  get innerHTML() {
    return ho(this, true);
  }
  get outerHTML() {
    return ho(this, true, true);
  }
}
function wo(t2, n2, e2, r2 = null) {
  let o2 = null;
  return o2 = new (s()).Element(e2, r2, n2), o2.ownerDocument = t2, o2;
}
function yo(t2, n2) {
  return n2.attributes.find((n3) => n3.name === t2) || null;
}
function bo(t2, n2, e2) {
  return t2 === "" && (t2 = null), e2.attributes.find((e3) => e3.namespaceURI === t2 && e3.localName === n2) || null;
}
function xo(t2, n2) {
  t2.ownerElement !== null && t2.ownerElement !== n2 && function(t3) {
    throw T("InUseAttributeError", t3);
  }("attribute is in use by another element");
  const e2 = bo(t2.namespaceURI, t2.localName, n2);
  return e2 === t2 ? t2 : (e2 !== null ? function(t3, n3) {
    const e3 = t3.ownerElement;
    mt(t3, e3, t3.value, n3.value), e3.attributes.splice(e3.attributes.indexOf(t3), 1, n3), n3.ownerElement = e3, t3.ownerElement = null;
  }(e2, t2) : gt(t2, n2), e2);
}
function vo(t2, n2) {
  const e2 = yo(t2, n2);
  return e2 !== null && wt(e2), e2;
}
function No(t2, n2, e2) {
  const {namespace: r2, prefix: o2, localName: i2} = At(n2, e2);
  return wo(t2, i2, r2, o2);
}
class DOMImplementation {
  constructor(t2) {
    this.q = t2;
  }
  createDocumentType(t2, n2, e2) {
    N(arguments, 3), t2 = String(t2), n2 = String(n2), e2 = String(e2), $t(t2);
    const r2 = new (s(this.q)).DocumentType(t2, n2, e2);
    return r2.ownerDocument = this.q, r2;
  }
  createDocument(t2, n2, e2 = null) {
    N(arguments, 2), t2 = ht(t2), n2 = ut(n2), e2 = at(e2, DocumentType);
    const r2 = new (s(this.q)).XMLDocument();
    let o2 = null;
    return n2 !== "" && (o2 = No(r2, t2, n2)), e2 && r2.appendChild(e2), o2 && r2.appendChild(o2), r2;
  }
  createHTMLDocument(t2) {
    t2 = ht(t2);
    const n2 = s(this.q), e2 = new n2.Document(), r2 = new n2.DocumentType("html");
    r2.ownerDocument = e2, e2.appendChild(r2);
    const o2 = wo(e2, "html", Tt);
    e2.appendChild(o2);
    const i2 = wo(e2, "head", Tt);
    if (o2.appendChild(i2), t2 !== null) {
      const n3 = wo(e2, "title", Tt);
      i2.appendChild(n3), n3.appendChild(e2.createTextNode(t2));
    }
    return o2.appendChild(wo(e2, "body", Tt)), e2;
  }
}
class Document extends Node {
  get nodeType() {
    return 9;
  }
  get nodeName() {
    return "#document";
  }
  get nodeValue() {
    return null;
  }
  set nodeValue(t2) {
  }
  get textContent() {
    return null;
  }
  set textContent(t2) {
  }
  lookupPrefix(t2) {
    return N(arguments, 1), this.documentElement !== null ? this.documentElement.lookupPrefix(t2) : null;
  }
  lookupNamespaceURI(t2) {
    return N(arguments, 1), this.documentElement === null ? null : this.documentElement.lookupNamespaceURI(t2);
  }
  get children() {
    return z(this);
  }
  prepend(...t2) {
    J(this, t2);
  }
  append(...t2) {
    Z(this, t2);
  }
  replaceChildren(...t2) {
    tt(this, t2);
  }
  constructor() {
    super(), this.firstElementChild = null, this.lastElementChild = null, this.childElementCount = 0, this.implementation = new DOMImplementation(this), this.doctype = null, this.documentElement = null;
  }
  getElementsByTagName(t2) {
    return N(arguments, 1), b(t2 = String(t2), this);
  }
  getElementsByTagNameNS(t2, n2) {
    return N(arguments, 2), x(t2 = ht(t2), n2 = String(n2), this);
  }
  createElement(t2) {
    N(arguments, 1), Hr(t2 = String(t2)) || $("The local name is not a valid Name");
    return wo(this, t2, null, null);
  }
  createElementNS(t2, n2) {
    return N(arguments, 2), No(this, t2 = ht(t2), n2 = String(n2));
  }
  createDocumentFragment() {
    const t2 = new (s()).DocumentFragment();
    return t2.ownerDocument = this, t2;
  }
  createTextNode(t2) {
    N(arguments, 1), t2 = String(t2);
    const n2 = new (s()).Text(t2);
    return n2.ownerDocument = this, n2;
  }
  createCDATASection(t2) {
    N(arguments, 1), (t2 = String(t2)).indexOf("]]>") >= 0 && $('Data must not contain the string "]]>"');
    const n2 = new (s()).CDATASection(t2);
    return n2.ownerDocument = this, n2;
  }
  createComment(t2) {
    N(arguments, 1), t2 = String(t2);
    const n2 = new (s()).Comment(t2);
    return n2.ownerDocument = this, n2;
  }
  createProcessingInstruction(t2, n2) {
    N(arguments, 2), t2 = String(t2), n2 = String(n2), Hr(t2) || $("The target is not a valid Name"), n2.indexOf("?>") >= 0 && $('Data must not contain the string "?>"');
    const e2 = new (s()).ProcessingInstruction(t2, n2);
    return e2.ownerDocument = this, e2;
  }
  importNode(t2, n2 = false) {
    return N(arguments, 1), u(t2 = ct(t2, Node), 9) && R("importing a Document node is not supported"), v(t2, n2, this);
  }
  adoptNode(t2) {
    return N(arguments, 1), u(t2 = ct(t2, Node), 9) && R("adopting a Document node is not supported"), j(t2, this), t2;
  }
  createAttribute(t2) {
    N(arguments, 1), Hr(t2 = String(t2)) || $("The local name is not a valid Name");
    const n2 = new (s()).Attr(null, null, t2, "", null);
    return n2.ownerDocument = this, n2;
  }
  createAttributeNS(t2, n2) {
    N(arguments, 2), t2 = ht(t2), n2 = String(n2);
    const {namespace: e2, prefix: r2, localName: o2} = At(t2, n2), i2 = new (s()).Attr(e2, r2, o2, "", null);
    return i2.ownerDocument = this, i2;
  }
  createRange() {
    const t2 = new (s()).Range();
    return t2.startContainer = this, t2.startOffset = 0, t2.endContainer = this, t2.endOffset = 0, t2;
  }
  T(t2) {
    return new (s()).Document();
  }
}
class DocumentFragment extends Node {
  get nodeType() {
    return 11;
  }
  get nodeName() {
    return "#document-fragment";
  }
  get nodeValue() {
    return null;
  }
  set nodeValue(t2) {
  }
  get textContent() {
    return Q(this);
  }
  set textContent(t2) {
    K(this, t2 = lt(t2));
  }
  lookupPrefix(t2) {
    return N(arguments, 1), null;
  }
  lookupNamespaceURI(t2) {
    return N(arguments, 1), null;
  }
  get children() {
    return z(this);
  }
  prepend(...t2) {
    J(this, t2);
  }
  append(...t2) {
    Z(this, t2);
  }
  replaceChildren(...t2) {
    tt(this, t2);
  }
  constructor() {
    super(), this.firstElementChild = null, this.lastElementChild = null, this.childElementCount = 0;
    const t2 = s();
    this.ownerDocument = t2.document;
  }
  T(t2) {
    const n2 = new (s()).DocumentFragment();
    return n2.ownerDocument = t2, n2;
  }
}
class ProcessingInstruction extends CharacterData {
  get nodeType() {
    return 7;
  }
  get nodeName() {
    return this.target;
  }
  constructor(t2, n2) {
    super(n2), this.target = t2;
  }
  T(t2) {
    const n2 = new (s()).ProcessingInstruction(this.target, this.data);
    return n2.ownerDocument = t2, n2;
  }
}
class So {
  constructor(t2) {
    u(t2.startContainer, 10, 2) && A("StaticRange startContainer must not be a doctype or attribute node"), u(t2.endContainer, 10, 2) && A("StaticRange endContainer must not be a doctype or attribute node"), this.startContainer = t2.startContainer, this.startOffset = t2.startOffset, this.endContainer = t2.endContainer, this.endOffset = t2.endOffset, this.collapsed = this.startContainer === this.endContainer && this.startOffset === this.endOffset;
  }
}
function Eo(t2, n2) {
  if (t2.collapsed)
    return;
  const e2 = m(t2.startContainer), r2 = m(t2.endContainer);
  let o2 = 0;
  for (; o2 < e2.length && o2 < r2.length && e2[o2] === r2[o2]; )
    ++o2;
  const i2 = t2.endContainer.childNodes[t2.endOffset] || null;
  for (let o3 = t2.startContainer.childNodes[t2.startOffset] || null; o3 && o3 !== i2 && o3 !== r2[e2.length]; o3 = o3.nextSibling)
    n2(o3);
  for (let t3 = e2.length - 1; t3 >= o2; --t3)
    for (let o3 = e2[t3].nextSibling; o3 && o3 !== i2 && o3 !== r2[t3]; o3 = o3.nextSibling)
      n2(o3);
  for (let t3 = o2; t3 < r2.length; ++t3)
    for (let e3 = r2[t3].firstChild; e3 && e3 !== i2 && e3 !== r2[t3 + 1]; e3 = e3.nextSibling)
      n2(e3);
}
function To(t2, n2) {
  const e2 = p(t2.startContainer), r2 = e2.createDocumentFragment();
  if (t2.collapsed)
    return r2;
  const o2 = t2.startContainer, i2 = t2.startOffset, s2 = t2.endContainer, l2 = t2.endOffset;
  if (o2 === s2 && c(o2)) {
    const t3 = o2.cloneNode();
    return t3.data = o2.substringData(i2, l2 - i2), W(t3, r2), n2 || o2.replaceData(i2, l2 - i2, ""), r2;
  }
  const a2 = m(t2.startContainer), h2 = m(t2.endContainer);
  let f2 = 0;
  for (; f2 < a2.length && f2 < h2.length && a2[f2] === h2[f2]; )
    ++f2;
  const w2 = f2 === a2.length, y2 = f2 === h2.length;
  let b2 = null;
  w2 || (b2 = a2[f2]);
  let x2 = null;
  y2 || (x2 = h2[f2]);
  const v2 = [], N2 = b2 ? b2.nextSibling : o2.childNodes[i2], S2 = x2 || s2.childNodes[l2] || null;
  for (var E2 = N2; E2 && E2 !== S2; E2 = E2.nextSibling)
    u(E2, 10) && C(n2 ? "Can not clone a doctype using cloneContents" : "Can not extract a doctype using extractContents"), v2.push(E2);
  let T2, D2;
  if (w2 || n2)
    T2 = o2, D2 = i2;
  else {
    const t3 = a2[f2];
    T2 = t3.parentNode, D2 = 1 + g(t3);
  }
  if (b2 !== null && c(b2)) {
    const t3 = b2.cloneNode();
    t3.data = b2.substringData(i2, b2.length - i2), W(t3, r2), n2 || b2.replaceData(i2, b2.length - i2, "");
  } else if (b2 !== null) {
    const t3 = b2.cloneNode();
    W(t3, r2);
    const s3 = e2.createRange();
    s3.setStart(o2, i2), s3.setEnd(b2, d(b2));
    const u2 = To(s3, n2);
    s3.detach(), W(u2, t3);
  }
  if (v2.forEach((t3) => {
    if (n2) {
      W(t3.cloneNode(true), r2);
    } else
      W(t3, r2);
  }), x2 && c(x2)) {
    const t3 = x2.cloneNode();
    t3.data = x2.substringData(0, l2), W(t3, r2), n2 || x2.replaceData(0, l2, "");
  } else if (x2 !== null) {
    const t3 = x2.cloneNode();
    W(t3, r2);
    const o3 = e2.createRange();
    o3.setStart(x2, 0), o3.setEnd(s2, l2);
    const i3 = To(o3, n2);
    o3.detach(), W(i3, t3);
  }
  return n2 || (t2.setStart(T2, D2), t2.collapse(true)), r2;
}
class Range {
  get collapsed() {
    return (t2 = this).startContainer === t2.endContainer && t2.startOffset === t2.endOffset;
    var t2;
  }
  constructor() {
    const t2 = s();
    this.startContainer = t2.document, this.startOffset = 0, this.endContainer = t2.document, this.endOffset = 0, t2.addRange(this);
  }
  get commonAncestorContainer() {
    const t2 = m(this.startContainer), n2 = m(this.endContainer);
    let e2 = t2[0], r2 = 0;
    for (; r2 < t2.length && r2 < n2.length && t2[r2] === n2[r2]; )
      e2 = t2[r2], ++r2;
    return e2;
  }
  setStart(t2, n2) {
    N(arguments, 2), t2 = ct(t2, Node), n2 = st(n2), u(t2, 10) && A("Can not set a range under a doctype node"), n2 > d(t2) && D("Can not set a range past the end of the node");
    Io(this) === w(t2) && Ao(t2, n2, this.endContainer, this.endOffset) !== $o || (this.endContainer = t2, this.endOffset = n2), this.startContainer = t2, this.startOffset = n2;
  }
  setEnd(t2, n2) {
    N(arguments, 2), t2 = ct(t2, Node), n2 = st(n2), u(t2, 10) && A("Can not set a range under a doctype node"), n2 > d(t2) && D("Can not set a range past the end of the node");
    Io(this) === w(t2) && Ao(t2, n2, this.startContainer, this.startOffset) !== Co || (this.startContainer = t2, this.startOffset = n2), this.endContainer = t2, this.endOffset = n2;
  }
  setStartBefore(t2) {
    N(arguments, 1);
    const n2 = (t2 = ct(t2, Node)).parentNode;
    if (n2 === null)
      return A("Can not set range before node without a parent");
    this.setStart(n2, g(t2));
  }
  setStartAfter(t2) {
    N(arguments, 1);
    const n2 = (t2 = ct(t2, Node)).parentNode;
    if (n2 === null)
      return A("Can not set range before node without a parent");
    this.setStart(n2, g(t2) + 1);
  }
  setEndBefore(t2) {
    N(arguments, 1);
    const n2 = (t2 = ct(t2, Node)).parentNode;
    if (n2 === null)
      return A("Can not set range before node without a parent");
    this.setEnd(n2, g(t2));
  }
  setEndAfter(t2) {
    N(arguments, 1);
    const n2 = (t2 = ct(t2, Node)).parentNode;
    if (n2 === null)
      return A("Can not set range before node without a parent");
    this.setEnd(n2, g(t2) + 1);
  }
  collapse(t2 = false) {
    t2 ? (this.endContainer = this.startContainer, this.endOffset = this.startOffset) : (this.startContainer = this.endContainer, this.startOffset = this.endOffset);
  }
  selectNode(t2) {
    N(arguments, 1);
    let n2 = (t2 = ct(t2, Node)).parentNode;
    if (n2 === null)
      return A("Can not select node with null parent");
    const e2 = g(t2);
    this.startContainer = n2, this.startOffset = e2, this.endContainer = n2, this.endOffset = e2 + 1;
  }
  selectNodeContents(t2) {
    N(arguments, 1), u(t2 = ct(t2, Node), 10) && A("Can not place range inside a doctype node");
    const n2 = d(t2);
    this.startContainer = t2, this.startOffset = 0, this.endContainer = t2, this.endOffset = n2;
  }
  compareBoundaryPoints(t2, n2) {
    switch (N(arguments, 2), n2 = ct(n2, Range), t2 !== Range.START_TO_START && t2 !== Range.START_TO_END && t2 !== Range.END_TO_END && t2 !== Range.END_TO_START && R("Unsupported comparison type"), Io(this) !== Io(n2) && P("Can not compare positions of ranges in different trees"), t2) {
      case Range.START_TO_START:
        return Ao(this.startContainer, this.startOffset, n2.startContainer, n2.startOffset);
      case Range.START_TO_END:
        return Ao(this.endContainer, this.endOffset, n2.startContainer, n2.startOffset);
      case Range.END_TO_END:
        return Ao(this.endContainer, this.endOffset, n2.endContainer, n2.endOffset);
      default:
        return Ao(this.startContainer, this.startOffset, n2.endContainer, n2.endOffset);
    }
  }
  deleteContents() {
    if (this.collapsed)
      return;
    const t2 = this.startContainer, n2 = this.startOffset, e2 = this.endContainer, r2 = this.endOffset;
    if (t2 === e2 && c(t2))
      return void t2.replaceData(n2, r2 - n2, "");
    const o2 = [];
    let i2, s2;
    if (Eo(this, (t3) => {
      o2.push(t3);
    }), t2.contains(e2))
      i2 = t2, s2 = n2;
    else {
      let n3 = t2;
      for (; n3.parentNode !== null && !n3.parentNode.contains(e2); )
        n3 = n3.parentNode;
      i2 = n3.parentNode, s2 = 1 + g(n3);
    }
    c(t2) && t2.replaceData(n2, t2.length - n2, ""), o2.forEach((t3) => {
      H(t3);
    }), c(e2) && e2.replaceData(0, r2, ""), this.setStart(i2, s2), this.collapse(true);
  }
  extractContents() {
    return To(this, false);
  }
  cloneContents() {
    return To(this, true);
  }
  insertNode(t2) {
    N(arguments, 1), it(t2 = ct(t2, Node), this);
  }
  surroundContents(t2) {
    N(arguments, 1), t2 = ct(t2, Node);
    (a(this.startContainer) ? this.startContainer.parentNode : this.startContainer) !== (a(this.endContainer) ? this.endContainer.parentNode : this.endContainer) && I("Can not use surroundContents on a range that has partially selected a non-Text node"), u(t2, 9, 10, 11) && A("Can not use Document, DocumentType, or DocumentFragment as a parent node in surroundContents");
    const n2 = To(this, false);
    t2.firstChild && Y(null, t2), it(t2, this), W(n2, t2), this.selectNode(t2);
  }
  cloneRange() {
    const t2 = new (s()).Range();
    return t2.startContainer = this.startContainer, t2.startOffset = this.startOffset, t2.endContainer = this.endContainer, t2.endOffset = this.endOffset, t2;
  }
  detach() {
    s().removeRange(this);
  }
  isPointInRange(t2, n2) {
    return N(arguments, 2), t2 = ct(t2, Node), n2 = st(n2), w(t2) === Io(this) && (u(t2, 10) && A("Point can not be under a doctype"), n2 > d(t2) && D("Offset should not be past the end of node"), Ao(t2, n2, this.startContainer, this.startOffset) !== Co && Ao(t2, n2, this.endContainer, this.endOffset) !== $o);
  }
  comparePoint(t2, n2) {
    return N(arguments, 2), t2 = ct(t2, Node), n2 = st(n2), w(t2) !== Io(this) && P("Can not compare point to range in different trees"), u(t2, 10) && A("Point can not be under a doctype"), n2 > d(t2) && D("Offset should not be past the end of node"), Ao(t2, n2, this.startContainer, this.startOffset) === Co ? -1 : Ao(t2, n2, this.endContainer, this.endOffset) === $o ? 1 : 0;
  }
  intersectsNode(t2) {
    if (N(arguments, 1), w(t2 = ct(t2, Node)) !== Io(this))
      return false;
    const n2 = t2.parentNode;
    if (n2 === null)
      return true;
    const e2 = g(t2);
    return Ao(n2, e2, this.endContainer, this.endOffset) === Co && Ao(n2, e2 + 1, this.startContainer, this.startOffset) === $o;
  }
  toString() {
    let t2 = [];
    const n2 = this.startContainer;
    if (a(n2)) {
      if (this.startContainer === this.endContainer)
        return n2.substringData(this.startOffset, this.endOffset - this.startOffset);
      t2.push(n2.substringData(this.startOffset, n2.length - this.startOffset));
    }
    Eo(this, (n3) => {
      y(n3, (n4) => {
        a(n4) && t2.push(n4.data);
      });
    });
    const e2 = this.endContainer;
    return a(e2) && t2.push(e2.substringData(0, this.endOffset)), t2.join("");
  }
}
Range.START_TO_START = 0, Range.START_TO_END = 1, Range.END_TO_END = 2, Range.END_TO_START = 3;
const Co = -1, Do = 0, $o = 1;
function Ao(t2, n2, e2, r2) {
  if (t2 !== e2) {
    const o2 = m(t2), i2 = m(e2);
    for (; o2[0] && i2[0] && o2[0] === i2[0]; )
      o2.shift(), i2.shift();
    o2.length && (n2 = g(o2[0]) + 0.5), i2.length && (r2 = g(i2[0]) + 0.5);
  }
  return n2 === r2 ? Do : n2 < r2 ? Co : $o;
}
function Io(t2) {
  return w(t2.startContainer);
}
class XMLDocument extends Document {
  T(t2) {
    return new (s()).XMLDocument();
  }
}
class DOMParser {
  constructor() {
  }
  parseFromString(t2, n2) {
    switch (n2) {
      case "text/html":
        throw new Error("HTML parsing is not implemented");
      case "text/xml":
      case "application/xml":
      case "application/xhtml+xml":
      case "image/svg+xml":
        try {
          return lo(t2);
        } catch (t3) {
          const n3 = new Document(), e2 = n3.createElementNS("http://www.mozilla.org/newlayout/xml/parsererror.xml", "parsererror");
          return e2.appendChild(n3.createTextNode(`${t3}`)), n3.appendChild(e2), n3;
        }
      default:
        throw new TypeError(`The type "${n2}" is not a valid value in the SupportedType enumeration.`);
    }
  }
}
class XMLSerializer {
  constructor() {
  }
  serializeToString(t2) {
    const n2 = [];
    return fo(t2 = ct(t2, Node), false, n2), n2.join("");
  }
}
function ko(t2) {
  const n2 = [];
  return fo(t2 = ct(t2, Node), true, n2), n2.join("");
}
class MutationObserver {
  constructor(t2) {
    this.u = [], this.m = [], this.t = [], N(arguments, 1), t2 = ct(t2, Function), this.g = t2;
  }
  observe(t2, n2) {
    if (N(arguments, 2), t2 = ct(t2, Node), n2.childList = !!n2.childList, n2.subtree = !!n2.subtree, n2.attributeOldValue !== void 0 && n2.attributes === void 0 && (n2.attributes = true), n2.characterDataOldValue !== void 0 && n2.characterData === void 0 && (n2.characterData = true), !(n2.childList || n2.attributes || n2.characterData))
      throw new TypeError('The options object must set at least one of "attributes", "characterData", or "childList" to true.');
    if (n2.attributeOldValue && !n2.attributes)
      throw new TypeError('The options object may only set "attributeOldValue" to true when "attributes" is true or not present.');
    if (n2.characterDataOldValue && !n2.characterData)
      throw new TypeError('The options object may only set "characterDataOldValue" to true when "characterData" is true or not present.');
    t2.o.register(this, n2);
  }
  disconnect() {
    this.u.forEach((t2) => t2.o.removeForObserver(this)), this.u.length = 0, this.m.length = 0;
  }
  takeRecords() {
    const t2 = this.m.concat();
    return this.m.length = 0, t2;
  }
}
const Mo = new Document();
i.document = Mo, i.Attr = Attr, i.CDATASection = CDATASection, i.Comment = vt, i.Document = Document, i.DocumentFragment = DocumentFragment, i.DocumentType = DocumentType, i.DOMImplementation = DOMImplementation, i.Element = Element, i.ProcessingInstruction = ProcessingInstruction, i.Range = Range, i.Text = Text, i.XMLDocument = XMLDocument;
export {Attr, CDATASection, CharacterData, vt as Comment, E as DOMException, DOMImplementation, DOMParser, Document, DocumentFragment, DocumentType, Element, MutationObserver, L as MutationRecord, Node, ProcessingInstruction, Range, So as StaticRange, Text, XMLDocument, XMLSerializer, Mo as document, lo as parseXmlDocument, uo as parseXmlFragment, ko as serializeToWellFormedString, Et as unsafeAppendAttribute, Nt as unsafeCreateAttribute, St as unsafeCreateElement};
export default null;
