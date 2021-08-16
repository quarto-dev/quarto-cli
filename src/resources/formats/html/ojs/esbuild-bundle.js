// ojs-bundle.js
import { Interpreter } from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler";
import {
  Inspector,
  Runtime,
  RuntimeError
} from "https://cdn.skypack.dev/@observablehq/runtime";

// stdlib.js
var e = new Map();
var t = [];
var n = t.map;
var r = t.some;
var o = t.hasOwnProperty;
var i = "https://cdn.jsdelivr.net/npm/";
var a = /^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/;
var s = /^\d+\.\d+\.\d+(-[\w-.+]+)?$/;
var u = /\.[^/]*$/;
var l = ["unpkg", "jsdelivr", "browser", "main"];
var RequireError = class extends Error {
  constructor(e2) {
    super(e2);
  }
};
function c(e2) {
  const t2 = a.exec(e2);
  return t2 && { name: t2[1], version: t2[2], path: t2[3] };
}
function f(t2) {
  const n2 = `${i}${t2.name}${t2.version ? `@${t2.version}` : ""}/package.json`;
  let r2 = e.get(n2);
  return r2 || e.set(n2, r2 = fetch(n2).then((t3) => {
    if (!t3.ok)
      throw new RequireError("unable to load package.json");
    return t3.redirected && !e.has(t3.url) && e.set(t3.url, r2), t3.json();
  })), r2;
}
RequireError.prototype.name = RequireError.name;
var d = h(async function(e2, t2) {
  if (e2.startsWith(i) && (e2 = e2.substring(i.length)), /^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new RequireError("illegal name");
  const n2 = c(e2);
  if (!n2)
    return `${i}${e2}`;
  if (!n2.version && t2 != null && t2.startsWith(i)) {
    const e3 = await f(c(t2.substring(i.length)));
    n2.version = e3.dependencies && e3.dependencies[n2.name] || e3.peerDependencies && e3.peerDependencies[n2.name];
  }
  if (n2.path && !u.test(n2.path) && (n2.path += ".js"), n2.path && n2.version && s.test(n2.version))
    return `${i}${n2.name}@${n2.version}/${n2.path}`;
  const r2 = await f(n2);
  return `${i}${r2.name}@${r2.version}/${n2.path || function(e3) {
    for (const t3 of l) {
      const n3 = e3[t3];
      if (typeof n3 == "string")
        return u.test(n3) ? n3 : `${n3}.js`;
    }
  }(r2) || "index.js"}`;
});
function h(e2) {
  const r2 = new Map(), o2 = u2(null);
  let i2, a2 = 0;
  function s2(e3) {
    if (typeof e3 != "string")
      return e3;
    let n2 = r2.get(e3);
    return n2 || r2.set(e3, n2 = new Promise((n3, r3) => {
      const o3 = document.createElement("script");
      o3.onload = () => {
        try {
          n3(t.pop()(u2(e3)));
        } catch (e4) {
          r3(new RequireError("invalid module"));
        }
        o3.remove(), a2--, a2 === 0 && (window.define = i2);
      }, o3.onerror = () => {
        r3(new RequireError("unable to load module")), o3.remove(), a2--, a2 === 0 && (window.define = i2);
      }, o3.async = true, o3.src = e3, a2 === 0 && (i2 = window.define, window.define = p), a2++, document.head.appendChild(o3);
    })), n2;
  }
  function u2(t2) {
    return (n2) => Promise.resolve(e2(n2, t2)).then(s2);
  }
  function l2(e3) {
    return arguments.length > 1 ? Promise.all(n.call(arguments, o2)).then(m) : o2(e3);
  }
  return l2.alias = function(t2) {
    return h((n2, r3) => n2 in t2 && (r3 = null, typeof (n2 = t2[n2]) != "string") ? n2 : e2(n2, r3));
  }, l2.resolve = e2, l2;
}
function m(e2) {
  const t2 = {};
  for (const n2 of e2)
    for (const e3 in n2)
      o.call(n2, e3) && (n2[e3] == null ? Object.defineProperty(t2, e3, { get: w(n2, e3) }) : t2[e3] = n2[e3]);
  return t2;
}
function w(e2, t2) {
  return () => e2[t2];
}
function v(e2) {
  return (e2 += "") === "exports" || e2 === "module";
}
function p(e2, o2, i2) {
  const a2 = arguments.length;
  a2 < 2 ? (i2 = e2, o2 = []) : a2 < 3 && (i2 = o2, o2 = typeof e2 == "string" ? [] : e2), t.push(r.call(o2, v) ? (e3) => {
    const t2 = {}, r2 = { exports: t2 };
    return Promise.all(n.call(o2, (n2) => (n2 += "") === "exports" ? t2 : n2 === "module" ? r2 : e3(n2))).then((e4) => (i2.apply(null, e4), r2.exports));
  } : (e3) => Promise.all(n.call(o2, e3)).then((e4) => typeof i2 == "function" ? i2.apply(null, e4) : i2));
}
function y(e2, t2, n2) {
  return { resolve: (r2 = n2) => `https://cdn.jsdelivr.net/npm/${e2}@${t2}/${r2}` };
}
p.amd = {};
var g = y("d3", "6.7.0", "dist/d3.min.js");
var b = y("d3-dsv", "2.0.0", "dist/d3-dsv.min.js");
var x = y("@observablehq/inputs", "0.8.0", "dist/inputs.umd.min.js");
var j = y("@observablehq/plot", "0.1.0", "dist/plot.umd.min.js");
var E = y("@observablehq/graphviz", "0.2.1", "dist/graphviz.min.js");
var P = y("@observablehq/highlight.js", "2.0.0", "highlight.min.js");
var L = y("@observablehq/katex", "0.11.1", "dist/katex.min.js");
var O = y("lodash", "4.17.21", "lodash.min.js");
var $2 = y("htl", "0.2.5", "dist/htl.min.js");
var R = y("marked", "0.3.12", "marked.min.js");
var k = y("sql.js", "1.5.0", "dist/sql-wasm.js");
var A = y("vega", "5.20.2", "build/vega.min.js");
var N = y("vega-lite", "5.1.0", "build/vega-lite.min.js");
var C = y("vega-lite-api", "5.0.0", "build/vega-lite-api.min.js");
var q = y("apache-arrow", "4.0.1", "Arrow.es2015.min.js");
async function U(e2) {
  return (await e2(k.resolve()))({ locateFile: (e3) => k.resolve(`dist/${e3}`) });
}
var SQLiteDatabaseClient = class {
  constructor(e2) {
    Object.defineProperties(this, { _db: { value: e2 } });
  }
  static async open(e2) {
    const [t2, n2] = await Promise.all([U(d), Promise.resolve(e2).then(M)]);
    return new SQLiteDatabaseClient(new t2.Database(n2));
  }
  async query(e2, t2) {
    return await async function(e3, t3, n2) {
      const [r2] = await e3.exec(t3, n2);
      if (!r2)
        return [];
      const { columns: o2, values: i2 } = r2, a2 = i2.map((e4) => Object.fromEntries(e4.map((e5, t4) => [o2[t4], e5])));
      return a2.columns = o2, a2;
    }(this._db, e2, t2);
  }
  async queryRow(e2, t2) {
    return (await this.query(e2, t2))[0] || null;
  }
  async explain(e2, t2) {
    return S("pre", { className: "observablehq--inspect" }, [_((await this.query(`EXPLAIN QUERY PLAN ${e2}`, t2)).map((e3) => e3.detail).join("\n"))]);
  }
  async describe(e2) {
    const t2 = await (e2 === void 0 ? this.query("SELECT name FROM sqlite_master WHERE type = 'table'") : this.query("SELECT * FROM pragma_table_info(?)", [e2]));
    if (!t2.length)
      throw new Error("Not found");
    const { columns: n2 } = t2;
    return S("table", { value: t2 }, [S("thead", [S("tr", n2.map((e3) => S("th", [_(e3)])))]), S("tbody", t2.map((e3) => S("tr", n2.map((t3) => S("td", [_(e3[t3])])))))]);
  }
};
function M(e2) {
  return typeof e2 == "string" ? fetch(e2).then(M) : e2 instanceof Response || e2 instanceof Blob ? e2.arrayBuffer().then(M) : e2 instanceof ArrayBuffer ? new Uint8Array(e2) : e2;
}
function S(e2, t2, n2) {
  arguments.length === 2 && (n2 = t2, t2 = void 0);
  const r2 = document.createElement(e2);
  if (t2 !== void 0)
    for (const e3 in t2)
      r2[e3] = t2[e3];
  if (n2 !== void 0)
    for (const e3 of n2)
      r2.appendChild(e3);
  return r2;
}
function _(e2) {
  return document.createTextNode(e2);
}
async function T(e2) {
  return await e2("jszip@3.6.0/dist/jszip.min.js");
}
async function F(e2) {
  const t2 = await fetch(await e2.url());
  if (!t2.ok)
    throw new Error(`Unable to load file: ${e2.name}`);
  return t2;
}
async function D(e2, t2, { array: n2 = false, typed: r2 = false } = {}) {
  const [o2, i2] = await Promise.all([e2.text(), d(b.resolve())]);
  return (t2 === "	" ? n2 ? i2.tsvParseRows : i2.tsvParse : n2 ? i2.csvParseRows : i2.csvParse)(o2, r2 && i2.autoType);
}
var z = class {
  constructor(e2) {
    Object.defineProperty(this, "name", { value: e2, enumerable: true });
  }
  async blob() {
    return (await F(this)).blob();
  }
  async arrayBuffer() {
    return (await F(this)).arrayBuffer();
  }
  async text() {
    return (await F(this)).text();
  }
  async json() {
    return (await F(this)).json();
  }
  async stream() {
    return (await F(this)).body;
  }
  async csv(e2) {
    return D(this, ",", e2);
  }
  async tsv(e2) {
    return D(this, "	", e2);
  }
  async image() {
    const e2 = await this.url();
    return new Promise((t2, n2) => {
      const r2 = new Image();
      new URL(e2, document.baseURI).origin !== new URL(location).origin && (r2.crossOrigin = "anonymous"), r2.onload = () => t2(r2), r2.onerror = () => n2(new Error(`Unable to load file: ${this.name}`)), r2.src = e2;
    });
  }
  async arrow() {
    const [e2, t2] = await Promise.all([d(q.resolve()), F(this)]);
    return e2.Table.from(t2);
  }
  async sqlite() {
    return SQLiteDatabaseClient.open(F(this));
  }
  async zip() {
    const [e2, t2] = await Promise.all([T(d), this.arrayBuffer()]);
    return new ZipArchive(await e2.loadAsync(t2));
  }
};
var FileAttachment = class extends z {
  constructor(e2, t2) {
    super(t2), Object.defineProperty(this, "_url", { value: e2 });
  }
  async url() {
    return await this._url + "";
  }
};
function B(e2) {
  throw new Error(`File not found: ${e2}`);
}
function W(e2) {
  return Object.assign((t2) => {
    const n2 = e2(t2 += "");
    if (n2 == null)
      throw new Error(`File not found: ${t2}`);
    return new FileAttachment(n2, t2);
  }, { prototype: FileAttachment.prototype });
}
var ZipArchive = class {
  constructor(e2) {
    Object.defineProperty(this, "_", { value: e2 }), this.filenames = Object.keys(e2.files).filter((t2) => !e2.files[t2].dir);
  }
  file(e2) {
    const t2 = this._.file(e2 += "");
    if (!t2 || t2.dir)
      throw new Error(`file not found: ${e2}`);
    return new ZipArchiveEntry(t2);
  }
};
var ZipArchiveEntry = class extends z {
  constructor(e2) {
    super(e2.name), Object.defineProperty(this, "_", { value: e2 }), Object.defineProperty(this, "_url", { writable: true });
  }
  async url() {
    return this._url || (this._url = this.blob().then(URL.createObjectURL));
  }
  async blob() {
    return this._.async("blob");
  }
  async arrayBuffer() {
    return this._.async("arraybuffer");
  }
  async text() {
    return this._.async("text");
  }
  async json() {
    return JSON.parse(await this.text());
  }
};
var H = { math: "http://www.w3.org/1998/Math/MathML", svg: "http://www.w3.org/2000/svg", xhtml: "http://www.w3.org/1999/xhtml", xlink: "http://www.w3.org/1999/xlink", xml: "http://www.w3.org/XML/1998/namespace", xmlns: "http://www.w3.org/2000/xmlns/" };
var I = 0;
function Q(e2) {
  this.id = e2, this.href = new URL(`#${e2}`, location) + "";
}
Q.prototype.toString = function() {
  return "url(" + this.href + ")";
};
var V = { canvas: function(e2, t2) {
  var n2 = document.createElement("canvas");
  return n2.width = e2, n2.height = t2, n2;
}, context2d: function(e2, t2, n2) {
  n2 == null && (n2 = devicePixelRatio);
  var r2 = document.createElement("canvas");
  r2.width = e2 * n2, r2.height = t2 * n2, r2.style.width = e2 + "px";
  var o2 = r2.getContext("2d");
  return o2.scale(n2, n2), o2;
}, download: function(e2, t2 = "untitled", n2 = "Save") {
  const r2 = document.createElement("a"), o2 = r2.appendChild(document.createElement("button"));
  async function i2() {
    await new Promise(requestAnimationFrame), URL.revokeObjectURL(r2.href), r2.removeAttribute("href"), o2.textContent = n2, o2.disabled = false;
  }
  return o2.textContent = n2, r2.download = t2, r2.onclick = async (t3) => {
    if (o2.disabled = true, r2.href)
      return i2();
    o2.textContent = "Saving\u2026";
    try {
      const t4 = await (typeof e2 == "function" ? e2() : e2);
      o2.textContent = "Download", r2.href = URL.createObjectURL(t4);
    } catch (e3) {
      o2.textContent = n2;
    }
    if (t3.eventPhase)
      return i2();
    o2.disabled = false;
  }, r2;
}, element: function(e2, t2) {
  var n2, r2 = e2 += "", o2 = r2.indexOf(":");
  o2 >= 0 && (r2 = e2.slice(0, o2)) !== "xmlns" && (e2 = e2.slice(o2 + 1));
  var i2 = H.hasOwnProperty(r2) ? document.createElementNS(H[r2], e2) : document.createElement(e2);
  if (t2)
    for (var a2 in t2)
      o2 = (r2 = a2).indexOf(":"), n2 = t2[a2], o2 >= 0 && (r2 = a2.slice(0, o2)) !== "xmlns" && (a2 = a2.slice(o2 + 1)), H.hasOwnProperty(r2) ? i2.setAttributeNS(H[r2], a2, n2) : i2.setAttribute(a2, n2);
  return i2;
}, input: function(e2) {
  var t2 = document.createElement("input");
  return e2 != null && (t2.type = e2), t2;
}, range: function(e2, t2, n2) {
  arguments.length === 1 && (t2 = e2, e2 = null);
  var r2 = document.createElement("input");
  return r2.min = e2 = e2 == null ? 0 : +e2, r2.max = t2 = t2 == null ? 1 : +t2, r2.step = n2 == null ? "any" : n2 = +n2, r2.type = "range", r2;
}, select: function(e2) {
  var t2 = document.createElement("select");
  return Array.prototype.forEach.call(e2, function(e3) {
    var n2 = document.createElement("option");
    n2.value = n2.textContent = e3, t2.appendChild(n2);
  }), t2;
}, svg: function(e2, t2) {
  var n2 = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  return n2.setAttribute("viewBox", [0, 0, e2, t2]), n2.setAttribute("width", e2), n2.setAttribute("height", t2), n2;
}, text: function(e2) {
  return document.createTextNode(e2);
}, uid: function(e2) {
  return new Q("O-" + (e2 == null ? "" : e2 + "-") + ++I);
} };
var X = { buffer: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsArrayBuffer(e2);
  });
}, text: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsText(e2);
  });
}, url: function(e2) {
  return new Promise(function(t2, n2) {
    var r2 = new FileReader();
    r2.onload = function() {
      t2(r2.result);
    }, r2.onerror = n2, r2.readAsDataURL(e2);
  });
} };
function G() {
  return this;
}
function J(e2, t2) {
  let n2 = false;
  if (typeof t2 != "function")
    throw new Error("dispose is not a function");
  return { [Symbol.iterator]: G, next: () => n2 ? { done: true } : (n2 = true, { done: false, value: e2 }), return: () => (n2 = true, t2(e2), { done: true }), throw: () => ({ done: n2 = true }) };
}
function Y(e2) {
  let t2, n2, r2 = false;
  const o2 = e2(function(e3) {
    n2 ? (n2(e3), n2 = null) : r2 = true;
    return t2 = e3;
  });
  if (o2 != null && typeof o2 != "function")
    throw new Error(typeof o2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: G, throw: () => ({ done: true }), return: () => (o2 != null && o2(), { done: true }), next: function() {
    return { done: false, value: r2 ? (r2 = false, Promise.resolve(t2)) : new Promise((e3) => n2 = e3) };
  } };
}
function K(e2) {
  switch (e2.type) {
    case "range":
    case "number":
      return e2.valueAsNumber;
    case "date":
      return e2.valueAsDate;
    case "checkbox":
      return e2.checked;
    case "file":
      return e2.multiple ? e2.files : e2.files[0];
    case "select-multiple":
      return Array.from(e2.selectedOptions, (e3) => e3.value);
    default:
      return e2.value;
  }
}
var Z = { disposable: J, filter: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    t2(n2.value, ++r2) && (yield n2.value);
}, input: function(e2) {
  return Y(function(t2) {
    var n2 = function(e3) {
      switch (e3.type) {
        case "button":
        case "submit":
        case "checkbox":
          return "click";
        case "file":
          return "change";
        default:
          return "input";
      }
    }(e2), r2 = K(e2);
    function o2() {
      t2(K(e2));
    }
    return e2.addEventListener(n2, o2), r2 !== void 0 && t2(r2), function() {
      e2.removeEventListener(n2, o2);
    };
  });
}, map: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    yield t2(n2.value, ++r2);
}, observe: Y, queue: function(e2) {
  let t2;
  const n2 = [], r2 = e2(function(e3) {
    n2.push(e3), t2 && (t2(n2.shift()), t2 = null);
    return e3;
  });
  if (r2 != null && typeof r2 != "function")
    throw new Error(typeof r2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: G, throw: () => ({ done: true }), return: () => (r2 != null && r2(), { done: true }), next: function() {
    return { done: false, value: n2.length ? Promise.resolve(n2.shift()) : new Promise((e3) => t2 = e3) };
  } };
}, range: function* (e2, t2, n2) {
  e2 = +e2, t2 = +t2, n2 = (o2 = arguments.length) < 2 ? (t2 = e2, e2 = 0, 1) : o2 < 3 ? 1 : +n2;
  for (var r2 = -1, o2 = 0 | Math.max(0, Math.ceil((t2 - e2) / n2)); ++r2 < o2; )
    yield e2 + r2 * n2;
}, valueAt: function(e2, t2) {
  if (!(!isFinite(t2 = +t2) || t2 < 0 || t2 != t2 | 0)) {
    for (var n2, r2 = -1; !(n2 = e2.next()).done; )
      if (++r2 === t2)
        return n2.value;
  }
}, worker: function(e2) {
  const t2 = URL.createObjectURL(new Blob([e2], { type: "text/javascript" })), n2 = new Worker(t2);
  return J(n2, () => {
    n2.terminate(), URL.revokeObjectURL(t2);
  });
} };
function ee(e2, t2) {
  return function(n2) {
    var r2, o2, i2, a2, s2, u2, l2, c2, f2 = n2[0], d2 = [], h2 = null, m2 = -1;
    for (s2 = 1, u2 = arguments.length; s2 < u2; ++s2) {
      if ((r2 = arguments[s2]) instanceof Node)
        d2[++m2] = r2, f2 += "<!--o:" + m2 + "-->";
      else if (Array.isArray(r2)) {
        for (l2 = 0, c2 = r2.length; l2 < c2; ++l2)
          (o2 = r2[l2]) instanceof Node ? (h2 === null && (d2[++m2] = h2 = document.createDocumentFragment(), f2 += "<!--o:" + m2 + "-->"), h2.appendChild(o2)) : (h2 = null, f2 += o2);
        h2 = null;
      } else
        f2 += r2;
      f2 += n2[s2];
    }
    if (h2 = e2(f2), ++m2 > 0) {
      for (i2 = new Array(m2), a2 = document.createTreeWalker(h2, NodeFilter.SHOW_COMMENT, null, false); a2.nextNode(); )
        o2 = a2.currentNode, /^o:/.test(o2.nodeValue) && (i2[+o2.nodeValue.slice(2)] = o2);
      for (s2 = 0; s2 < m2; ++s2)
        (o2 = i2[s2]) && o2.parentNode.replaceChild(d2[s2], o2);
    }
    return h2.childNodes.length === 1 ? h2.removeChild(h2.firstChild) : h2.nodeType === 11 ? ((o2 = t2()).appendChild(h2), o2) : h2;
  };
}
var te = ee(function(e2) {
  var t2 = document.createElement("template");
  return t2.innerHTML = e2.trim(), document.importNode(t2.content, true);
}, function() {
  return document.createElement("span");
});
function ne(e2) {
  let t2;
  Object.defineProperties(this, { generator: { value: Y((e3) => {
    t2 = e3;
  }) }, value: { get: () => e2, set: (n2) => t2(e2 = n2) } }), e2 !== void 0 && t2(e2);
}
function* re() {
  for (; ; )
    yield Date.now();
}
var oe = new Map();
function ie(e2, t2) {
  var n2;
  return (n2 = oe.get(e2 = +e2)) ? n2.then(() => t2) : (n2 = Date.now()) >= e2 ? Promise.resolve(t2) : function(e3, t3) {
    var n3 = new Promise(function(n4) {
      oe.delete(t3);
      var r2 = t3 - e3;
      if (!(r2 > 0))
        throw new Error("invalid time");
      if (r2 > 2147483647)
        throw new Error("too long to wait");
      setTimeout(n4, r2);
    });
    return oe.set(t3, n3), n3;
  }(n2, e2).then(() => t2);
}
var ae = { delay: function(e2, t2) {
  return new Promise(function(n2) {
    setTimeout(function() {
      n2(t2);
    }, e2);
  });
}, tick: function(e2, t2) {
  return ie(Math.ceil((Date.now() + 1) / e2) * e2, t2);
}, when: ie };
function se(e2, t2) {
  if (/^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new Error("illegal name");
  return "https://unpkg.com/" + e2;
}
function ue(e2) {
  return e2 == null ? d : h(e2);
}
var le = ee(function(e2) {
  var t2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  return t2.innerHTML = e2.trim(), t2;
}, function() {
  return document.createElementNS("http://www.w3.org/2000/svg", "g");
});
var ce = String.raw;
function fe() {
  return Y(function(e2) {
    var t2 = e2(document.body.clientWidth);
    function n2() {
      var n3 = document.body.clientWidth;
      n3 !== t2 && e2(t2 = n3);
    }
    return window.addEventListener("resize", n2), function() {
      window.removeEventListener("resize", n2);
    };
  });
}
var de = Object.assign(function(e2) {
  const t2 = ue(e2);
  var n2;
  Object.defineProperties(this, (n2 = { FileAttachment: () => B, Arrow: () => t2(q.resolve()), Inputs: () => t2(x.resolve()), Mutable: () => ne, Plot: () => t2(j.resolve()), SQLite: () => U(t2), SQLiteDatabaseClient: () => SQLiteDatabaseClient, _: () => t2(O.resolve()), d3: () => t2(g.resolve()), dot: () => t2(E.resolve()), htl: () => t2($2.resolve()), html: () => te, md: () => function(e3) {
    return e3(R.resolve()).then(function(t3) {
      return ee(function(n3) {
        var r2 = document.createElement("div");
        r2.innerHTML = t3(n3, { langPrefix: "" }).trim();
        var o2 = r2.querySelectorAll("pre code[class]");
        return o2.length > 0 && e3(P.resolve()).then(function(t4) {
          o2.forEach(function(n4) {
            function r3() {
              t4.highlightBlock(n4), n4.parentNode.classList.add("observablehq--md-pre");
            }
            t4.getLanguage(n4.className) ? r3() : e3(P.resolve("async-languages/index.js")).then((r4) => {
              if (r4.has(n4.className))
                return e3(P.resolve("async-languages/" + r4.get(n4.className))).then((e4) => {
                  t4.registerLanguage(n4.className, e4);
                });
            }).then(r3, r3);
          });
        }), r2;
      }, function() {
        return document.createElement("div");
      });
    });
  }(t2), now: re, require: () => t2, resolve: () => se, svg: () => le, tex: () => function(e3) {
    return Promise.all([e3(L.resolve()), (t3 = L.resolve("dist/katex.min.css"), new Promise(function(e4, n3) {
      var r2 = document.createElement("link");
      r2.rel = "stylesheet", r2.href = t3, r2.onerror = n3, r2.onload = e4, document.head.appendChild(r2);
    }))]).then(function(e4) {
      var t4 = e4[0], n3 = r2();
      function r2(e5) {
        return function() {
          var n4 = document.createElement("div");
          return t4.render(ce.apply(String, arguments), n4, e5), n4.removeChild(n4.firstChild);
        };
      }
      return n3.options = r2, n3.block = r2({ displayMode: true }), n3;
    });
    var t3;
  }(t2), vl: () => async function(e3) {
    const [t3, n3, r2] = await Promise.all([A, N, C].map((t4) => e3(t4.resolve())));
    return r2.register(t3, n3);
  }(t2), width: fe, DOM: V, Files: X, Generators: Z, Promises: ae }, Object.fromEntries(Object.entries(n2).map(he))));
}, { resolve: d.resolve });
function he([e2, t2]) {
  return [e2, { value: t2, writable: true, enumerable: true }];
}

// ojs-bundle.js
import { parseModule } from "https://cdn.skypack.dev/@observablehq/parser";
import { button } from "https://cdn.skypack.dev/@observablehq/inputs";
var EmptyInspector = class {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
  }
};
var OJSConnector = class {
  constructor({ paths, inspectorClass, library, allowPendingGlobals = false }) {
    this.library = library || new de();
    this.localResolverMap = new Map();
    this.pendingGlobals = {};
    this.allowPendingGlobals = allowPendingGlobals;
    this.runtime = new Runtime(this.library, (name) => this.global(name));
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths, this.localResolverMap)
    });
    this.inspectorClass = inspectorClass || Inspector;
    this.mainModuleHasImports = false;
    this.mainModuleOutstandingImportCount = 0;
    this.chunkPromises = [];
  }
  global(name) {
    if (typeof window[name] !== "undefined") {
      return window[name];
    }
    if (!this.allowPendingGlobals) {
      return void 0;
    }
    if (!this.pendingGlobals.hasOwnProperty(name)) {
      const info = {};
      info.promise = new Promise((resolve, reject) => {
        info.resolve = resolve;
        info.reject = reject;
      });
      this.pendingGlobals[name] = info;
    }
    return this.pendingGlobals[name].promise;
  }
  killPendingGlobals() {
    this.allowPendingGlobals = false;
    for (const [name, { reject }] of Object.entries(this.pendingGlobals)) {
      reject(new RuntimeError(`${name} is not defined`));
    }
  }
  setLocalResolver(map) {
    for (const [key, value] of Object.entries(map)) {
      this.localResolverMap.set(key, value);
    }
  }
  define(name, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    let change;
    const obs = this.library.Generators.observe((change_) => {
      change = change_;
    });
    module.variable().define(name, obs);
    return change;
  }
  watch(name, k2, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    module.variable({
      fulfilled: (x2) => k2(x2, name)
    }).define([name], (val) => val);
  }
  async value(val, module = void 0) {
    if (!module) {
      module = this.mainModule;
    }
    const result = await module.value(val);
    return result;
  }
  clearImportModuleWait() {
    const array = Array.from(document.querySelectorAll(".ojs-in-a-box-waiting-for-module-import"));
    for (const node of array) {
      node.classList.remove("ojs-in-a-box-waiting-for-module-import");
    }
  }
  finishInterpreting() {
    return Promise.all(this.chunkPromises).then(() => {
      if (!this.mainModuleHasImports) {
        this.clearImportModuleWait();
      }
    });
  }
  interpretWithRunner(src, runner) {
    try {
      const parse = parseModule(src);
      const chunkPromise = Promise.all(parse.cells.map(runner));
      this.chunkPromises.push(chunkPromise);
      return chunkPromise;
    } catch (error) {
      return Promise.reject(error);
    }
  }
  waitOnImports(cell, promise) {
    if (cell.body.type !== "ImportDeclaration") {
      return promise;
    } else {
      this.mainModuleHasImports = true;
      this.mainModuleOutstandingImportCount++;
      return promise.then((result) => {
        this.mainModuleOutstandingImportCount--;
        if (this.mainModuleOutstandingImportCount === 0) {
          this.clearImportModuleWait();
        }
        return result;
      });
    }
  }
  interpretQuiet(src) {
    const runCell = (cell) => {
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(cellSrc, void 0, (_name) => new EmptyInspector());
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
  interpret(src, elementGetter, elementCreator) {
    const observer = (targetElement, ojsCell) => {
      return (name) => {
        const element = typeof elementCreator === "function" ? elementCreator() : elementCreator;
        targetElement.appendChild(element);
        if (ojsCell.id && ojsCell.id.type === "ViewExpression" && !name.startsWith("viewof ")) {
          element.classList.add("quarto-ojs-hide");
        }
        let cell = targetElement;
        let cellOutputDisplay;
        while (cell !== null && !cell.classList.contains("cell")) {
          cell = cell.parentElement;
          if (cell && cell.classList.contains("cell-output-display")) {
            cellOutputDisplay = cell;
          }
        }
        const config = { childList: true };
        const callback = function(mutationsList, observer3) {
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;
            if (cell && cell.dataset.output !== "all") {
              Array.from(mutation.target.childNodes).filter((n2) => {
                return n2.classList.contains("observablehq--inspect") && !n2.parentNode.classList.contains("observablehq--error") && n2.parentNode.parentNode.dataset.nodetype !== "expression";
              }).forEach((n2) => n2.classList.add("quarto-ojs-hide"));
              if (ojsDiv.classList.contains("observablehq--error")) {
                ojsDiv.classList.remove("quarto-ojs-hide");
              } else if (ojsDiv.parentNode.dataset.nodetype !== "expression" && Array.from(ojsDiv.childNodes).every((n2) => n2.classList.contains("observablehq--inspect"))) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
            for (const added of mutation.addedNodes) {
              const result = added.querySelectorAll("code.javascript");
              if (result.length !== 1) {
                continue;
              }
              if (result[0].innerText.trim().startsWith("import")) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
          }
          const children = Array.from(cellOutputDisplay.querySelectorAll("div.observablehq"));
          if (children.every((n2) => {
            return n2.classList.contains("quarto-ojs-hide");
          })) {
            cellOutputDisplay.classList.add("quarto-ojs-hide");
          } else {
            cellOutputDisplay.classList.remove("quarto-ojs-hide");
          }
        };
        const observer2 = new MutationObserver(callback);
        observer2.observe(element, config);
        element.classList.add("ojs-in-a-box-waiting-for-module-import");
        return new this.inspectorClass(element);
      };
    };
    const runCell = (cell) => {
      const targetElement = typeof elementGetter === "function" ? elementGetter() : elementGetter;
      const cellSrc = src.slice(cell.start, cell.end);
      const promise = this.interpreter.module(cellSrc, void 0, observer(targetElement, cell));
      return this.waitOnImports(cell, promise);
    };
    return this.interpretWithRunner(src, runCell);
  }
};
function es6ImportAsObservableModule(m2) {
  return function(runtime, observer) {
    const main = runtime.module();
    Object.keys(m2).forEach((key) => {
      const v2 = m2[key];
      main.variable(observer(key)).define(key, [], () => v2);
    });
    return main;
  };
}
function defaultResolveImportPath(path) {
  const extractPath = (path2) => {
    let source2 = path2;
    let m2;
    if (m2 = /\.js(\?|$)/i.exec(source2)) {
      source2 = source2.slice(0, m2.index);
    }
    if (m2 = /^[0-9a-f]{16}$/i.test(source2)) {
      source2 = `d/${source2}`;
    }
    if (m2 = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source2)) {
      source2 = source2.slice(m2[0].length);
    }
    return source2;
  };
  const source = extractPath(path);
  const metadataURL = `https://api.observablehq.com/document/${source}`;
  const moduleURL = `https://api.observablehq.com/${source}.js?v=3`;
  return import(moduleURL).then((m2) => m2.default);
}
function importPathResolver(paths, localResolverMap) {
  function importRootPath(path) {
    const { runtimeToRoot } = paths;
    if (!runtimeToRoot) {
      return path;
    } else {
      return `${runtimeToRoot}/${path}`;
    }
  }
  function importRelativePath(path) {
    const { runtimeToDoc } = paths;
    if (!runtimeToDoc) {
      return path;
    } else {
      return `${runtimeToDoc}/${path}`;
    }
  }
  function fetchRootPath(path) {
    const { docToRoot } = paths;
    if (!docToRoot) {
      return path;
    } else {
      return `${docToRoot}/${path}`;
    }
  }
  function fetchRelativePath(path) {
    return path;
  }
  return (path) => {
    const isLocalModule = path.startsWith("/") || path.startsWith(".");
    const isImportFromObservableWebsite = path.match(/^https:\/\/(api\.|beta\.|)observablehq\.com\//i);
    if (!isLocalModule || isImportFromObservableWebsite) {
      return defaultResolveImportPath(path);
    }
    let importPath, fetchPath;
    let moduleType;
    if (window._ojs.selfContained) {
      const resolved = localResolverMap.get(path);
      if (resolved === void 0) {
        throw new Error(`missing local file ${path} in self-contained mode`);
      }
      importPath = resolved;
      fetchPath = resolved;
      const mimeType = resolved.match(/data:(.*);base64/)[1];
      switch (mimeType) {
        case "application/javascript":
          moduleType = "js";
          break;
        case "application/ojs-javascript":
          moduleType = "ojs";
          break;
        default:
          throw new Error(`unrecognized MIME type ${mimeType}`);
      }
    } else {
      const resourceURL = new URL(path, window.location);
      moduleType = resourceURL.pathname.match(/\.(ojs|js|qmd)$/)[1];
      if (path.startsWith("/")) {
        importPath = importRootPath(path);
        fetchPath = fetchRootPath(path);
      } else {
        importPath = importRelativePath(path);
        fetchPath = fetchRelativePath(path);
      }
    }
    if (moduleType === "js") {
      return import(importPath).then((m2) => es6ImportAsObservableModule(m2));
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      return fetch(htmlPath).then((response) => response.text()).then(createOjsModuleFromHTMLSrc);
    } else {
      throw new Error(`internal error, unrecognized module type ${moduleType}`);
    }
  };
}
function createOjsModuleFromHTMLSrc(text) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");
  const staticDefns = [];
  for (const el of doc.querySelectorAll('script[type="ojs-define"]')) {
    staticDefns.push(el.text);
  }
  const ojsSource = [];
  for (const content of doc.querySelectorAll('script[type="ojs-module-contents"]')) {
    for (const cell of JSON.parse(content.text).contents) {
      ojsSource.push(cell.source);
    }
  }
  return createOjsModuleFromSrc(ojsSource.join("\n"), staticDefns);
}
function createOjsModuleFromSrc(src, staticDefns = []) {
  return (runtime, _observer) => {
    const newModule = runtime.module();
    const interpreter = window._ojs.ojsConnector.interpreter;
    const _cells = interpreter.module(src, newModule, (_name) => new EmptyInspector());
    for (const defn of staticDefns) {
      for (const { name, value } of JSON.parse(defn).contents) {
        window._ojs.ojsConnector.define(name, newModule)(value);
      }
    }
    return newModule;
  };
}
async function importOjsFromURL(path) {
  const r2 = await fetch(path);
  const src = await r2.text();
  return createOjsModuleFromSrc(src);
}
var shinyInputVars = new Set();
var shinyInitialValue = {};
function extendObservableStdlib(lib) {
  class NamedVariableOutputBinding extends Shiny.OutputBinding {
    constructor(name, change) {
      super();
      this._name = name;
      this._change = change;
    }
    find(scope) {
      return $(scope).find("#" + this._name);
    }
    getId(el) {
      return el.id;
    }
    renderValue(_el, data) {
      this._change(data);
    }
    onValueError(el, err) {
      const group = `Shiny error in ${el.id}`;
      console.groupCollapsed(`%c${group}`, "color:red");
      console.log(`${err.message}`);
      console.log(`call: ${err.call}`);
      console.groupEnd(group);
    }
  }
  $(document).on("shiny:connected", function(_event) {
    Object.entries(shinyInitialValue).map(([k2, v2]) => {
      window.Shiny.setInputValue(k2, v2);
    });
    shinyInitialValue = {};
  });
  lib.shinyInput = function() {
    return (name) => {
      shinyInputVars.add(name);
      window._ojs.ojsConnector.mainModule.value(name).then((val) => {
        if (window.Shiny && window.Shiny.setInputValue) {
          window.Shiny.setInputValue(name, val);
        } else {
          shinyInitialValue[name] = val;
        }
      });
    };
  };
  lib.shinyOutput = function() {
    return function(name) {
      const dummySpan = document.createElement("div");
      dummySpan.id = name;
      dummySpan.classList.add("ojs-variable-writer");
      window._ojs.shinyElementRoot.appendChild(dummySpan);
      return lib.Generators.observe((change) => {
        Shiny.outputBindings.register(new NamedVariableOutputBinding(name, change));
      });
    };
  };
}
var ShinyInspector = class extends Inspector {
  constructor(node) {
    super(node);
  }
  fulfilled(value, name) {
    if (shinyInputVars.has(name) && window.Shiny) {
      if (window.Shiny.setInputValue === void 0) {
        shinyInitialValue[name] = value;
      } else {
        window.Shiny.setInputValue(name, value);
      }
    }
    return super.fulfilled(value, name);
  }
};
var { Generators } = new de();
var OjsButtonInput = class {
  find(_scope) {
    return document.querySelectorAll(".ojs-inputs-button");
  }
  init(el, change) {
    const btn = button(el.textContent);
    el.innerHTML = "";
    el.appendChild(btn);
    const obs = Generators.input(el.firstChild);
    (async function() {
      await obs.next().value;
      for (const x2 of obs) {
        change(await x2);
      }
    })();
    return {
      onSetValue: (_value) => {
      },
      dispose: () => {
        obs.return();
      }
    };
  }
};
function initOjsShinyRuntime() {
  const valueSym = Symbol("value");
  const callbackSym = Symbol("callback");
  const instanceSym = Symbol("instance");
  class BindingAdapter extends Shiny.InputBinding {
    constructor(x2) {
      super();
      this.x = x2;
    }
    find(scope) {
      const matches = this.x.find(scope);
      return $(matches);
    }
    getId(el) {
      if (this.x.getId) {
        return this.x.getId(el);
      } else {
        return super.getId(el);
      }
    }
    initialize(el) {
      const changeHandler = (value) => {
        el[valueSym] = value;
        el[callbackSym]();
      };
      const instance = this.x.init(el, changeHandler);
      el[instanceSym] = instance;
    }
    getValue(el) {
      return el[valueSym];
    }
    setValue(el, value) {
      el[valueSym] = value;
      el[instanceSym].onSetValue(value);
    }
    subscribe(el, callback) {
      el[callbackSym] = callback;
    }
    unsubscribe(el) {
      el[instanceSym].dispose();
    }
  }
  class InspectorOutputBinding extends Shiny.OutputBinding {
    find(scope) {
      return $(scope).find(".observablehq-inspector");
    }
    getId(el) {
      return el.id;
    }
    renderValue(el, data) {
      new Inspector(el).fulfilled(data);
    }
  }
  if (window.Shiny === void 0) {
    console.warn("Shiny runtime not found; Shiny features won't work.");
    return false;
  }
  Shiny.inputBindings.register(new BindingAdapter(new OjsButtonInput()));
  Shiny.outputBindings.register(new InspectorOutputBinding());
  Shiny.addCustomMessageHandler("ojs-export", ({ name }) => {
    window._ojs.ojsConnector.mainModule.redefine(name, window._ojs.ojsConnector.library.shinyOutput()(name));
    Shiny.bindAll(document.body);
  });
  return true;
}
function createRuntime() {
  const quartoOjsGlobal = window._ojs;
  const isShiny = window.Shiny !== void 0;
  if (isShiny) {
    quartoOjsGlobal.hasShiny = true;
    initOjsShinyRuntime();
    const span = document.createElement("span");
    window._ojs.shinyElementRoot = span;
    document.body.appendChild(span);
  }
  const lib = new de();
  if (isShiny) {
    extendObservableStdlib(lib);
  }
  function transpose(df) {
    const keys = Object.keys(df);
    return df[keys[0]].map((v2, i2) => Object.fromEntries(keys.map((key) => [key, df[key][i2] || void 0]))).filter((v2) => Object.values(v2).every((e2) => e2 !== void 0));
  }
  lib.transpose = () => transpose;
  const mainEl = document.querySelector("main");
  function width() {
    return lib.Generators.observe(function(change) {
      var width2 = change(mainEl.clientWidth);
      function resized() {
        var w2 = mainEl.clientWidth;
        if (w2 !== width2)
          change(width2 = w2);
      }
      window.addEventListener("resize", resized);
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.width = width;
  const layoutDivs = Array.from(document.querySelectorAll("div.quarto-layout-panel div[id]"));
  function layoutWidth() {
    return lib.Generators.observe(function(change) {
      const ourWidths = Object.fromEntries(layoutDivs.map((div) => [div.id, div.clientWidth]));
      change(ourWidths);
      function resized() {
        let changed = false;
        for (const div of layoutDivs) {
          const w2 = div.clientWidth;
          if (w2 !== ourWidths[div.id]) {
            ourWidths[div.id] = w2;
            changed = true;
          }
        }
        if (changed) {
          change(ourWidths);
        }
      }
      window.addEventListener("resize", resized);
      return function() {
        window.removeEventListener("resize", resized);
      };
    });
  }
  lib.layoutWidth = layoutWidth;
  let localResolver = {};
  function fileAttachmentPathResolver(n2) {
    if (localResolver[n2]) {
      return localResolver[n2];
    }
    if (n2.startsWith("/")) {
      if (quartoOjsGlobal.paths.docToRoot === "") {
        return `.${n2}`;
      } else {
        return `${quartoOjsGlobal.paths.docToRoot}${n2}`;
      }
    } else {
      return n2;
    }
  }
  lib.FileAttachment = () => W(fileAttachmentPathResolver);
  const ojsConnector = new OJSConnector({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : void 0,
    library: lib,
    allowPendingGlobals: isShiny
  });
  quartoOjsGlobal.ojsConnector = ojsConnector;
  if (isShiny) {
    $(document).one("shiny:idle", () => {
      $(document).one("shiny:message", () => {
        setTimeout(() => {
          ojsConnector.killPendingGlobals();
        }, 0);
      });
    });
  }
  const subfigIdMap = new Map();
  function getSubfigId(elementId) {
    if (!subfigIdMap.has(elementId)) {
      subfigIdMap.set(elementId, 0);
    }
    let nextIx = subfigIdMap.get(elementId);
    nextIx++;
    subfigIdMap.set(elementId, nextIx);
    return `${elementId}-${nextIx}`;
  }
  const result = {
    setLocalResolver(obj) {
      localResolver = obj;
      ojsConnector.setLocalResolver(obj);
    },
    finishInterpreting() {
      return ojsConnector.finishInterpreting();
    },
    async value(name) {
      await this.finishInterpreting();
      const result2 = await ojsConnector.value(name);
      return result2;
    },
    interpretLenient(src, targetElementId, inline) {
      return result.interpret(src, targetElementId, inline).catch(() => {
      });
    },
    interpret(src, targetElementId, inline) {
      const getElement = () => {
        let targetElement = document.getElementById(targetElementId);
        if (!targetElement) {
          targetElement = document.getElementById(getSubfigId(targetElementId));
          if (!targetElement) {
            console.error("Ran out of subfigures for element", targetElementId);
            console.error("This will fail.");
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        return targetElement;
      };
      const makeElement = () => {
        return document.createElement(inline ? "span" : "div");
      };
      return ojsConnector.interpret(src, getElement, makeElement).catch((e2) => {
        const errorDiv = document.createElement("pre");
        errorDiv.innerText = `${e2.name}: ${e2.message}`;
        getElement().append(errorDiv);
        return e2;
      });
    },
    interpretQuiet(src) {
      return ojsConnector.interpretQuiet(src);
    },
    interpretFromScriptTags() {
      for (const el of document.querySelectorAll("script[type='ojs-module-contents']")) {
        for (const call of JSON.parse(el.text).contents) {
          switch (call.methodName) {
            case "interpret":
              this.interpret(call.source, call.cellName, call.inline);
              break;
            case "interpretLenient":
              this.interpretLenient(call.source, call.cellName, call.inline);
              break;
            case "interpretQuiet":
              this.interpretQuiet(call.source);
              break;
            default:
              throw new Error(`Don't know how to call method ${call.methodName}`);
          }
        }
      }
      for (const el of document.querySelectorAll("script[type='ojs-define']")) {
        for (const { name, value } of JSON.parse(el.text).contents) {
          ojsConnector.define(name)(value);
        }
      }
    }
  };
  return result;
}
window._ojs = {
  ojsConnector: void 0,
  paths: {},
  hasShiny: false,
  shinyElementRoot: void 0
};
window._ojs.runtime = createRuntime();
export {
  OJSConnector,
  ShinyInspector,
  createRuntime,
  extendObservableStdlib,
  initOjsShinyRuntime
};
