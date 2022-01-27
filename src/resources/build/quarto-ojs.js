// quarto-ojs.js
import {
  Interpreter as Interpreter2
} from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler@0.6.0-alpha.9";
import {
  Inspector as Inspector4,
  Runtime as Runtime2,
  RuntimeError as RuntimeError2
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";

// stdlib.js
var e = {};
var t = {};
function n(e2) {
  return new Function("d", "return {" + e2.map(function(e3, t2) {
    return JSON.stringify(e3) + ": d[" + t2 + '] || ""';
  }).join(",") + "}");
}
function r(e2) {
  var t2 = Object.create(null), n2 = [];
  return e2.forEach(function(e3) {
    for (var r2 in e3)
      r2 in t2 || n2.push(t2[r2] = r2);
  }), n2;
}
function o(e2, t2) {
  var n2 = e2 + "", r2 = n2.length;
  return r2 < t2 ? new Array(t2 - r2 + 1).join(0) + n2 : n2;
}
function i(e2) {
  var t2, n2 = e2.getUTCHours(), r2 = e2.getUTCMinutes(), i2 = e2.getUTCSeconds(), a2 = e2.getUTCMilliseconds();
  return isNaN(e2) ? "Invalid Date" : ((t2 = e2.getUTCFullYear()) < 0 ? "-" + o(-t2, 6) : t2 > 9999 ? "+" + o(t2, 6) : o(t2, 4)) + "-" + o(e2.getUTCMonth() + 1, 2) + "-" + o(e2.getUTCDate(), 2) + (a2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + ":" + o(i2, 2) + "." + o(a2, 3) + "Z" : i2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + ":" + o(i2, 2) + "Z" : r2 || n2 ? "T" + o(n2, 2) + ":" + o(r2, 2) + "Z" : "");
}
function a(o2) {
  var a2 = new RegExp('["' + o2 + "\n\r]"), s2 = o2.charCodeAt(0);
  function u2(n2, r2) {
    var o3, i2 = [], a3 = n2.length, u3 = 0, l3 = 0, c3 = a3 <= 0, f3 = false;
    function d2() {
      if (c3)
        return t;
      if (f3)
        return f3 = false, e;
      var r3, o4, i3 = u3;
      if (n2.charCodeAt(i3) === 34) {
        for (; u3++ < a3 && n2.charCodeAt(u3) !== 34 || n2.charCodeAt(++u3) === 34; )
          ;
        return (r3 = u3) >= a3 ? c3 = true : (o4 = n2.charCodeAt(u3++)) === 10 ? f3 = true : o4 === 13 && (f3 = true, n2.charCodeAt(u3) === 10 && ++u3), n2.slice(i3 + 1, r3 - 1).replace(/""/g, '"');
      }
      for (; u3 < a3; ) {
        if ((o4 = n2.charCodeAt(r3 = u3++)) === 10)
          f3 = true;
        else if (o4 === 13)
          f3 = true, n2.charCodeAt(u3) === 10 && ++u3;
        else if (o4 !== s2)
          continue;
        return n2.slice(i3, r3);
      }
      return c3 = true, n2.slice(i3, a3);
    }
    for (n2.charCodeAt(a3 - 1) === 10 && --a3, n2.charCodeAt(a3 - 1) === 13 && --a3; (o3 = d2()) !== t; ) {
      for (var h2 = []; o3 !== e && o3 !== t; )
        h2.push(o3), o3 = d2();
      r2 && (h2 = r2(h2, l3++)) == null || i2.push(h2);
    }
    return i2;
  }
  function l2(e2, t2) {
    return e2.map(function(e3) {
      return t2.map(function(t3) {
        return f2(e3[t3]);
      }).join(o2);
    });
  }
  function c2(e2) {
    return e2.map(f2).join(o2);
  }
  function f2(e2) {
    return e2 == null ? "" : e2 instanceof Date ? i(e2) : a2.test(e2 += "") ? '"' + e2.replace(/"/g, '""') + '"' : e2;
  }
  return { parse: function(e2, t2) {
    var r2, o3, i2 = u2(e2, function(e3, i3) {
      if (r2)
        return r2(e3, i3 - 1);
      o3 = e3, r2 = t2 ? function(e4, t3) {
        var r3 = n(e4);
        return function(n2, o4) {
          return t3(r3(n2), o4, e4);
        };
      }(e3, t2) : n(e3);
    });
    return i2.columns = o3 || [], i2;
  }, parseRows: u2, format: function(e2, t2) {
    return t2 == null && (t2 = r(e2)), [t2.map(f2).join(o2)].concat(l2(e2, t2)).join("\n");
  }, formatBody: function(e2, t2) {
    return t2 == null && (t2 = r(e2)), l2(e2, t2).join("\n");
  }, formatRows: function(e2) {
    return e2.map(c2).join("\n");
  }, formatRow: c2, formatValue: f2 };
}
var s = a(",");
var u = s.parse;
var l = s.parseRows;
var c = a("	");
var f = c.parse;
var d = c.parseRows;
function h(e2) {
  for (var t2 in e2) {
    var n2, r2, o2 = e2[t2].trim();
    if (o2)
      if (o2 === "true")
        o2 = true;
      else if (o2 === "false")
        o2 = false;
      else if (o2 === "NaN")
        o2 = NaN;
      else if (isNaN(n2 = +o2)) {
        if (!(r2 = o2.match(/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/)))
          continue;
        m && r2[4] && !r2[7] && (o2 = o2.replace(/-/g, "/").replace(/T/, " ")), o2 = new Date(o2);
      } else
        o2 = n2;
    else
      o2 = null;
    e2[t2] = o2;
  }
  return e2;
}
var m = new Date("2019-01-01T00:00").getHours() || new Date("2019-07-01T00:00").getHours();
var p = new Map();
var w = [];
var v = w.map;
var y = w.some;
var g = w.hasOwnProperty;
var b = "https://cdn.jsdelivr.net/npm/";
var x = /^((?:@[^/@]+\/)?[^/@]+)(?:@([^/]+))?(?:\/(.*))?$/;
var j = /^\d+\.\d+\.\d+(-[\w-.+]+)?$/;
var E = /\.[^/]*$/;
var P = ["unpkg", "jsdelivr", "browser", "main"];
var RequireError = class extends Error {
  constructor(e2) {
    super(e2);
  }
};
function C(e2) {
  const t2 = x.exec(e2);
  return t2 && { name: t2[1], version: t2[2], path: t2[3] };
}
function A(e2) {
  const t2 = `${b}${e2.name}${e2.version ? `@${e2.version}` : ""}/package.json`;
  let n2 = p.get(t2);
  return n2 || p.set(t2, n2 = fetch(t2).then((e3) => {
    if (!e3.ok)
      throw new RequireError("unable to load package.json");
    return e3.redirected && !p.has(e3.url) && p.set(e3.url, n2), e3.json();
  })), n2;
}
RequireError.prototype.name = RequireError.name;
var N = L(async function(e2, t2) {
  if (e2.startsWith(b) && (e2 = e2.substring(b.length)), /^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new RequireError("illegal name");
  const n2 = C(e2);
  if (!n2)
    return `${b}${e2}`;
  if (!n2.version && t2 != null && t2.startsWith(b)) {
    const e3 = await A(C(t2.substring(b.length)));
    n2.version = e3.dependencies && e3.dependencies[n2.name] || e3.peerDependencies && e3.peerDependencies[n2.name];
  }
  if (n2.path && !E.test(n2.path) && (n2.path += ".js"), n2.path && n2.version && j.test(n2.version))
    return `${b}${n2.name}@${n2.version}/${n2.path}`;
  const r2 = await A(n2);
  return `${b}${r2.name}@${r2.version}/${n2.path || function(e3) {
    for (const t3 of P) {
      const n3 = e3[t3];
      if (typeof n3 == "string")
        return E.test(n3) ? n3 : `${n3}.js`;
    }
  }(r2) || "index.js"}`;
});
function L(e2) {
  const t2 = new Map(), n2 = a2(null);
  let r2, o2 = 0;
  function i2(e3) {
    if (typeof e3 != "string")
      return e3;
    let n3 = t2.get(e3);
    return n3 || t2.set(e3, n3 = new Promise((t3, n4) => {
      const i3 = document.createElement("script");
      i3.onload = () => {
        try {
          t3(w.pop()(a2(e3)));
        } catch (e4) {
          n4(new RequireError("invalid module"));
        }
        i3.remove(), o2--, o2 === 0 && (window.define = r2);
      }, i3.onerror = () => {
        n4(new RequireError("unable to load module")), i3.remove(), o2--, o2 === 0 && (window.define = r2);
      }, i3.async = true, i3.src = e3, o2 === 0 && (r2 = window.define, window.define = k), o2++, document.head.appendChild(i3);
    })), n3;
  }
  function a2(t3) {
    return (n3) => Promise.resolve(e2(n3, t3)).then(i2);
  }
  function s2(e3) {
    return arguments.length > 1 ? Promise.all(v.call(arguments, n2)).then(O) : n2(e3);
  }
  return s2.alias = function(t3) {
    return L((n3, r3) => n3 in t3 && (r3 = null, typeof (n3 = t3[n3]) != "string") ? n3 : e2(n3, r3));
  }, s2.resolve = e2, s2;
}
function O(e2) {
  const t2 = {};
  for (const n2 of e2)
    for (const e3 in n2)
      g.call(n2, e3) && (n2[e3] == null ? Object.defineProperty(t2, e3, { get: R(n2, e3) }) : t2[e3] = n2[e3]);
  return t2;
}
function R(e2, t2) {
  return () => e2[t2];
}
function $2(e2) {
  return (e2 += "") === "exports" || e2 === "module";
}
function k(e2, t2, n2) {
  const r2 = arguments.length;
  r2 < 2 ? (n2 = e2, t2 = []) : r2 < 3 && (n2 = t2, t2 = typeof e2 == "string" ? [] : e2), w.push(y.call(t2, $2) ? (e3) => {
    const r3 = {}, o2 = { exports: r3 };
    return Promise.all(v.call(t2, (t3) => (t3 += "") === "exports" ? r3 : t3 === "module" ? o2 : e3(t3))).then((e4) => (n2.apply(null, e4), o2.exports));
  } : (e3) => Promise.all(v.call(t2, e3)).then((e4) => typeof n2 == "function" ? n2.apply(null, e4) : n2));
}
function T(e2, t2, n2) {
  return { resolve: (r2 = n2) => `https://cdn.jsdelivr.net/npm/${e2}@${t2}/${r2}` };
}
k.amd = {};
var U = T("d3", "7.0.1", "dist/d3.min.js");
var q = T("@observablehq/inputs", "0.9.1", "dist/inputs.min.js");
var M = T("@observablehq/plot", "0.2.0", "dist/plot.umd.min.js");
var S = T("@observablehq/graphviz", "0.2.1", "dist/graphviz.min.js");
var _ = T("@observablehq/highlight.js", "2.0.0", "highlight.min.js");
var D = T("@observablehq/katex", "0.11.1", "dist/katex.min.js");
var F = T("lodash", "4.17.21", "lodash.min.js");
var B = T("htl", "0.3.0", "dist/htl.min.js");
var z = T("jszip", "3.7.1", "dist/jszip.min.js");
var H = T("marked", "0.3.12", "marked.min.js");
var W = T("sql.js", "1.6.1", "dist/sql-wasm.js");
var I = T("vega", "5.20.2", "build/vega.min.js");
var Z = T("vega-lite", "5.1.0", "build/vega-lite.min.js");
var Q = T("vega-lite-api", "5.0.0", "build/vega-lite-api.min.js");
var V = T("apache-arrow", "4.0.1", "Arrow.es2015.min.js");
var J = T("arquero", "4.8.4", "dist/arquero.min.js");
var X = T("topojson-client", "3.1.0", "dist/topojson-client.min.js");
function Y(e2) {
  const t2 = {};
  for (const [n2, r2] of e2)
    t2[n2] = r2;
  return t2;
}
async function G(e2) {
  return (await e2(W.resolve()))({ locateFile: (e3) => W.resolve(`dist/${e3}`) });
}
var SQLiteDatabaseClient = class {
  constructor(e2) {
    Object.defineProperties(this, { _db: { value: e2 } });
  }
  static async open(e2) {
    const [t2, n2] = await Promise.all([G(N), Promise.resolve(e2).then(K)]);
    return new SQLiteDatabaseClient(new t2.Database(n2));
  }
  async query(e2, t2) {
    return await async function(e3, t3, n2) {
      const [r2] = await e3.exec(t3, n2);
      if (!r2)
        return [];
      const { columns: o2, values: i2 } = r2, a2 = i2.map((e4) => Y(e4.map((e5, t4) => [o2[t4], e5])));
      return a2.columns = o2, a2;
    }(this._db, e2, t2);
  }
  async queryRow(e2, t2) {
    return (await this.query(e2, t2))[0] || null;
  }
  async explain(e2, t2) {
    return ee("pre", { className: "observablehq--inspect" }, [te((await this.query(`EXPLAIN QUERY PLAN ${e2}`, t2)).map((e3) => e3.detail).join("\n"))]);
  }
  async describe(e2) {
    const t2 = await (e2 === void 0 ? this.query("SELECT name FROM sqlite_master WHERE type = 'table'") : this.query("SELECT * FROM pragma_table_info(?)", [e2]));
    if (!t2.length)
      throw new Error("Not found");
    const { columns: n2 } = t2;
    return ee("table", { value: t2 }, [ee("thead", [ee("tr", n2.map((e3) => ee("th", [te(e3)])))]), ee("tbody", t2.map((e3) => ee("tr", n2.map((t3) => ee("td", [te(e3[t3])])))))]);
  }
};
function K(e2) {
  return typeof e2 == "string" ? fetch(e2).then(K) : e2 instanceof Response || e2 instanceof Blob ? e2.arrayBuffer().then(K) : e2 instanceof ArrayBuffer ? new Uint8Array(e2) : e2;
}
function ee(e2, t2, n2) {
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
function te(e2) {
  return document.createTextNode(e2);
}
async function ne(e2) {
  const t2 = await fetch(await e2.url());
  if (!t2.ok)
    throw new Error(`Unable to load file: ${e2.name}`);
  return t2;
}
async function re(e2, t2, { array: n2 = false, typed: r2 = false } = {}) {
  const o2 = await e2.text();
  return (t2 === "	" ? n2 ? d : f : n2 ? l : u)(o2, r2 && h);
}
var oe = class {
  constructor(e2) {
    Object.defineProperty(this, "name", { value: e2, enumerable: true });
  }
  async blob() {
    return (await ne(this)).blob();
  }
  async arrayBuffer() {
    return (await ne(this)).arrayBuffer();
  }
  async text() {
    return (await ne(this)).text();
  }
  async json() {
    return (await ne(this)).json();
  }
  async stream() {
    return (await ne(this)).body;
  }
  async csv(e2) {
    return re(this, ",", e2);
  }
  async tsv(e2) {
    return re(this, "	", e2);
  }
  async image() {
    const e2 = await this.url();
    return new Promise((t2, n2) => {
      const r2 = new Image();
      new URL(e2, document.baseURI).origin !== new URL(location).origin && (r2.crossOrigin = "anonymous"), r2.onload = () => t2(r2), r2.onerror = () => n2(new Error(`Unable to load file: ${this.name}`)), r2.src = e2;
    });
  }
  async arrow() {
    const [e2, t2] = await Promise.all([N(V.resolve()), ne(this)]);
    return e2.Table.from(t2);
  }
  async sqlite() {
    return SQLiteDatabaseClient.open(ne(this));
  }
  async zip() {
    const [e2, t2] = await Promise.all([N(z.resolve()), this.arrayBuffer()]);
    return new ZipArchive(await e2.loadAsync(t2));
  }
  async xml(e2 = "application/xml") {
    return new DOMParser().parseFromString(await this.text(), e2);
  }
  async html() {
    return this.xml("text/html");
  }
};
var FileAttachment = class extends oe {
  constructor(e2, t2) {
    super(t2), Object.defineProperty(this, "_url", { value: e2 });
  }
  async url() {
    return await this._url + "";
  }
};
function ie(e2) {
  throw new Error(`File not found: ${e2}`);
}
function ae(e2) {
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
var ZipArchiveEntry = class extends oe {
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
var se = { math: "http://www.w3.org/1998/Math/MathML", svg: "http://www.w3.org/2000/svg", xhtml: "http://www.w3.org/1999/xhtml", xlink: "http://www.w3.org/1999/xlink", xml: "http://www.w3.org/XML/1998/namespace", xmlns: "http://www.w3.org/2000/xmlns/" };
var ue = 0;
function le(e2) {
  this.id = e2, this.href = new URL(`#${e2}`, location) + "";
}
le.prototype.toString = function() {
  return "url(" + this.href + ")";
};
var ce = { canvas: function(e2, t2) {
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
  var i2 = se.hasOwnProperty(r2) ? document.createElementNS(se[r2], e2) : document.createElement(e2);
  if (t2)
    for (var a2 in t2)
      o2 = (r2 = a2).indexOf(":"), n2 = t2[a2], o2 >= 0 && (r2 = a2.slice(0, o2)) !== "xmlns" && (a2 = a2.slice(o2 + 1)), se.hasOwnProperty(r2) ? i2.setAttributeNS(se[r2], a2, n2) : i2.setAttribute(a2, n2);
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
  return new le("O-" + (e2 == null ? "" : e2 + "-") + ++ue);
} };
var fe = { buffer: function(e2) {
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
function de() {
  return this;
}
function he(e2, t2) {
  let n2 = false;
  if (typeof t2 != "function")
    throw new Error("dispose is not a function");
  return { [Symbol.iterator]: de, next: () => n2 ? { done: true } : (n2 = true, { done: false, value: e2 }), return: () => (n2 = true, t2(e2), { done: true }), throw: () => ({ done: n2 = true }) };
}
function me(e2) {
  let t2, n2, r2 = false;
  const o2 = e2(function(e3) {
    n2 ? (n2(e3), n2 = null) : r2 = true;
    return t2 = e3;
  });
  if (o2 != null && typeof o2 != "function")
    throw new Error(typeof o2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: de, throw: () => ({ done: true }), return: () => (o2 != null && o2(), { done: true }), next: function() {
    return { done: false, value: r2 ? (r2 = false, Promise.resolve(t2)) : new Promise((e3) => n2 = e3) };
  } };
}
function pe(e2) {
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
var we = { disposable: he, filter: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    t2(n2.value, ++r2) && (yield n2.value);
}, input: function(e2) {
  return me(function(t2) {
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
    }(e2), r2 = pe(e2);
    function o2() {
      t2(pe(e2));
    }
    return e2.addEventListener(n2, o2), r2 !== void 0 && t2(r2), function() {
      e2.removeEventListener(n2, o2);
    };
  });
}, map: function* (e2, t2) {
  for (var n2, r2 = -1; !(n2 = e2.next()).done; )
    yield t2(n2.value, ++r2);
}, observe: me, queue: function(e2) {
  let t2;
  const n2 = [], r2 = e2(function(e3) {
    n2.push(e3), t2 && (t2(n2.shift()), t2 = null);
    return e3;
  });
  if (r2 != null && typeof r2 != "function")
    throw new Error(typeof r2.then == "function" ? "async initializers are not supported" : "initializer returned something, but not a dispose function");
  return { [Symbol.iterator]: de, throw: () => ({ done: true }), return: () => (r2 != null && r2(), { done: true }), next: function() {
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
  return he(n2, () => {
    n2.terminate(), URL.revokeObjectURL(t2);
  });
} };
function ve(e2, t2) {
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
var ye = ve(function(e2) {
  var t2 = document.createElement("template");
  return t2.innerHTML = e2.trim(), document.importNode(t2.content, true);
}, function() {
  return document.createElement("span");
});
function ge(e2) {
  let t2;
  Object.defineProperties(this, { generator: { value: me((e3) => {
    t2 = e3;
  }) }, value: { get: () => e2, set: (n2) => t2(e2 = n2) } }), e2 !== void 0 && t2(e2);
}
function* be() {
  for (; ; )
    yield Date.now();
}
var xe = new Map();
function je(e2, t2) {
  var n2;
  return (n2 = xe.get(e2 = +e2)) ? n2.then(() => t2) : (n2 = Date.now()) >= e2 ? Promise.resolve(t2) : function(e3, t3) {
    var n3 = new Promise(function(n4) {
      xe.delete(t3);
      var r2 = t3 - e3;
      if (!(r2 > 0))
        throw new Error("invalid time");
      if (r2 > 2147483647)
        throw new Error("too long to wait");
      setTimeout(n4, r2);
    });
    return xe.set(t3, n3), n3;
  }(n2, e2).then(() => t2);
}
var Ee = { delay: function(e2, t2) {
  return new Promise(function(n2) {
    setTimeout(function() {
      n2(t2);
    }, e2);
  });
}, tick: function(e2, t2) {
  return je(Math.ceil((Date.now() + 1) / e2) * e2, t2);
}, when: je };
function Pe(e2, t2) {
  if (/^(\w+:)|\/\//i.test(e2))
    return e2;
  if (/^[.]{0,2}\//i.test(e2))
    return new URL(e2, t2 == null ? location : t2).href;
  if (!e2.length || /^[\s._]/.test(e2) || /\s$/.test(e2))
    throw new Error("illegal name");
  return "https://unpkg.com/" + e2;
}
function Ce(e2) {
  return e2 == null ? N : L(e2);
}
var Ae = ve(function(e2) {
  var t2 = document.createElementNS("http://www.w3.org/2000/svg", "g");
  return t2.innerHTML = e2.trim(), t2;
}, function() {
  return document.createElementNS("http://www.w3.org/2000/svg", "g");
});
var Ne = String.raw;
function Le() {
  return me(function(e2) {
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
var Oe = Object.assign(function(e2) {
  const t2 = Ce(e2);
  var n2;
  Object.defineProperties(this, (n2 = { FileAttachment: () => ie, Arrow: () => t2(V.resolve()), Inputs: () => t2(q.resolve()), Mutable: () => ge, Plot: () => t2(M.resolve()), SQLite: () => G(t2), SQLiteDatabaseClient: () => SQLiteDatabaseClient, _: () => t2(F.resolve()), aq: () => t2.alias({ "apache-arrow": V.resolve() })(J.resolve()), d3: () => t2(U.resolve()), dot: () => t2(S.resolve()), htl: () => t2(B.resolve()), html: () => ye, md: () => function(e3) {
    return e3(H.resolve()).then(function(t3) {
      return ve(function(n3) {
        var r2 = document.createElement("div");
        r2.innerHTML = t3(n3, { langPrefix: "" }).trim();
        var o2 = r2.querySelectorAll("pre code[class]");
        return o2.length > 0 && e3(_.resolve()).then(function(t4) {
          o2.forEach(function(n4) {
            function r3() {
              t4.highlightBlock(n4), n4.parentNode.classList.add("observablehq--md-pre");
            }
            t4.getLanguage(n4.className) ? r3() : e3(_.resolve("async-languages/index.js")).then((r4) => {
              if (r4.has(n4.className))
                return e3(_.resolve("async-languages/" + r4.get(n4.className))).then((e4) => {
                  t4.registerLanguage(n4.className, e4);
                });
            }).then(r3, r3);
          });
        }), r2;
      }, function() {
        return document.createElement("div");
      });
    });
  }(t2), now: be, require: () => t2, resolve: () => Pe, svg: () => Ae, tex: () => function(e3) {
    return Promise.all([e3(D.resolve()), (t3 = D.resolve("dist/katex.min.css"), new Promise(function(e4, n3) {
      var r2 = document.createElement("link");
      r2.rel = "stylesheet", r2.href = t3, r2.onerror = n3, r2.onload = e4, document.head.appendChild(r2);
    }))]).then(function(e4) {
      var t4 = e4[0], n3 = r2();
      function r2(e5) {
        return function() {
          var n4 = document.createElement("div");
          return t4.render(Ne.apply(String, arguments), n4, e5), n4.removeChild(n4.firstChild);
        };
      }
      return n3.options = r2, n3.block = r2({ displayMode: true }), n3;
    });
    var t3;
  }(t2), topojson: () => t2(X.resolve()), vl: () => async function(e3) {
    const [t3, n3, r2] = await Promise.all([I, Z, Q].map((t4) => e3(t4.resolve())));
    return r2.register(t3, n3);
  }(t2), width: Le, DOM: ce, Files: fe, Generators: we, Promises: Ee }, Y(Object.entries(n2).map(Re))));
}, { resolve: N.resolve });
function Re([e2, t2]) {
  return [e2, { value: t2, writable: true, enumerable: true }];
}

// pandoc-code-decorator.js
var PandocCodeDecorator = class {
  constructor(node) {
    this._node = node;
    this._spans = [];
    this.normalizeCodeRange();
    this.initializeEntryPoints();
  }
  normalizeCodeRange() {
    const n2 = this._node;
    const lines = n2.querySelectorAll("code > span");
    for (const line of lines) {
      Array.from(line.childNodes).filter((n22) => n22.nodeType === n22.TEXT_NODE).forEach((n22) => {
        const newSpan = document.createElement("span");
        newSpan.textContent = n22.wholeText;
        n22.replaceWith(newSpan);
      });
    }
  }
  initializeEntryPoints() {
    const lines = this._node.querySelectorAll("code > span");
    let result = [];
    let offset = this._node.parentElement.dataset.sourceOffset && -Number(this._node.parentElement.dataset.sourceOffset) || 0;
    for (const line of lines) {
      let lineNumber = Number(line.id.split("-").pop());
      let column = 1;
      Array.from(line.childNodes).filter((n2) => n2.nodeType === n2.ELEMENT_NODE && n2.nodeName === "SPAN").forEach((n2) => {
        result.push({
          offset,
          line: lineNumber,
          column,
          node: n2
        });
        offset += n2.textContent.length;
        column += n2.textContent.length;
      });
      offset += 1;
    }
    this._elementEntryPoints = result;
  }
  locateEntry(offset) {
    let candidate;
    if (offset === Infinity)
      return void 0;
    for (let i2 = 0; i2 < this._elementEntryPoints.length; ++i2) {
      const entry = this._elementEntryPoints[i2];
      if (entry.offset > offset) {
        return { entry: candidate, index: i2 - 1 };
      }
      candidate = entry;
    }
    if (offset < candidate.offset + candidate.node.textContent.length) {
      return { entry: candidate, index: this._elementEntryPoints.length - 1 };
    } else {
      return void 0;
    }
  }
  offsetToLineColumn(offset) {
    let entry = this.locateEntry(offset);
    if (entry === void 0) {
      const entries = this._elementEntryPoints;
      const last = entries[entries.length - 1];
      return {
        line: last.line,
        column: last.column + Math.min(last.node.textContent.length, offset - last.offset)
      };
    }
    return {
      line: entry.entry.line,
      column: entry.entry.column + offset - entry.entry.offset
    };
  }
  *spanSelection(start, end) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i2 = startIndex; i2 < endIndex; ++i2) {
      yield this._elementEntryPoints[i2];
    }
  }
  decorateSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.add(cssClass);
      }
    }
  }
  clearSpan(start, end, classes) {
    for (const entryPoint of this.spanSelection(start, end)) {
      for (const cssClass of classes) {
        entryPoint.node.classList.remove(cssClass);
      }
    }
  }
  ensureExactSpan(start, end) {
    const splitEntry = (entry, offset) => {
      const newSpan = document.createElement("span");
      for (const cssClass of entry.node.classList) {
        newSpan.classList.add(cssClass);
      }
      const beforeText = entry.node.textContent.slice(0, offset - entry.offset);
      const afterText = entry.node.textContent.slice(offset - entry.offset);
      entry.node.textContent = beforeText;
      newSpan.textContent = afterText;
      entry.node.after(newSpan);
      this._elementEntryPoints.push({
        column: entry.column + offset - entry.offset,
        line: entry.line,
        node: newSpan,
        offset
      });
      this._elementEntryPoints.sort((a2, b2) => a2.offset - b2.offset);
    };
    const startEntry = this.locateEntry(start);
    if (startEntry !== void 0 && startEntry.entry.offset != start) {
      splitEntry(startEntry.entry, start);
    }
    const endEntry = this.locateEntry(end);
    if (endEntry !== void 0 && endEntry.entry.offset !== end) {
      splitEntry(endEntry.entry, end);
    }
  }
  clearSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i2 = startIndex; i2 < endIndex; ++i2) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i2].node.classList.remove(cssClass);
      }
    }
  }
};

// quarto-observable-shiny.js
import {
  Inspector as Inspector2
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";
import {
  button
} from "https://cdn.skypack.dev/@observablehq/inputs@0.10.4";

// quarto-inspector.js
import {
  Inspector
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";
var QuartoInspector = class extends Inspector {
  constructor(node, cellAst) {
    super(node);
    this._cellAst = cellAst;
  }
  rejected(error) {
    return super.rejected(error);
  }
};

// quarto-observable-shiny.js
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
var ShinyInspector = class extends QuartoInspector {
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
var { Generators } = new Oe();
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
      new Inspector2(el).fulfilled(data);
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

// ojs-connector.js
import {
  Interpreter
} from "https://cdn.skypack.dev/@alex.garcia/unofficial-observablehq-compiler@0.6.0-alpha.9";
import {
  Inspector as Inspector3,
  Runtime,
  RuntimeError
} from "https://cdn.skypack.dev/@observablehq/runtime@4.18.3";

// observablehq-parser.js
import { getLineInfo, TokContext, tokTypes as tt, Parser } from "https://cdn.skypack.dev/acorn@7";
import { ancestor } from "https://cdn.skypack.dev/acorn-walk@7";
import { make } from "https://cdn.skypack.dev/acorn-walk@7";
import { simple } from "https://cdn.skypack.dev/acorn-walk@7";
var globals_default = new Set([
  "Array",
  "ArrayBuffer",
  "atob",
  "AudioContext",
  "Blob",
  "Boolean",
  "BigInt",
  "btoa",
  "clearInterval",
  "clearTimeout",
  "console",
  "crypto",
  "CustomEvent",
  "DataView",
  "Date",
  "decodeURI",
  "decodeURIComponent",
  "devicePixelRatio",
  "document",
  "encodeURI",
  "encodeURIComponent",
  "Error",
  "escape",
  "eval",
  "fetch",
  "File",
  "FileList",
  "FileReader",
  "Float32Array",
  "Float64Array",
  "Function",
  "Headers",
  "Image",
  "ImageData",
  "Infinity",
  "Int16Array",
  "Int32Array",
  "Int8Array",
  "Intl",
  "isFinite",
  "isNaN",
  "JSON",
  "Map",
  "Math",
  "NaN",
  "Number",
  "navigator",
  "Object",
  "parseFloat",
  "parseInt",
  "performance",
  "Path2D",
  "Promise",
  "Proxy",
  "RangeError",
  "ReferenceError",
  "Reflect",
  "RegExp",
  "cancelAnimationFrame",
  "requestAnimationFrame",
  "Set",
  "setInterval",
  "setTimeout",
  "String",
  "Symbol",
  "SyntaxError",
  "TextDecoder",
  "TextEncoder",
  "this",
  "TypeError",
  "Uint16Array",
  "Uint32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "undefined",
  "unescape",
  "URIError",
  "URL",
  "WeakMap",
  "WeakSet",
  "WebSocket",
  "Worker",
  "window"
]);
var walk_default = make({
  Import() {
  },
  ViewExpression(node, st, c2) {
    c2(node.id, st, "Identifier");
  },
  MutableExpression(node, st, c2) {
    c2(node.id, st, "Identifier");
  }
});
function isScope(node) {
  return node.type === "FunctionExpression" || node.type === "FunctionDeclaration" || node.type === "ArrowFunctionExpression" || node.type === "Program";
}
function isBlockScope(node) {
  return node.type === "BlockStatement" || node.type === "ForInStatement" || node.type === "ForOfStatement" || node.type === "ForStatement" || isScope(node);
}
function declaresArguments(node) {
  return node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
}
function findReferences(cell, globals) {
  const ast = { type: "Program", body: [cell.body] };
  const locals = new Map();
  const globalSet = new Set(globals);
  const references = [];
  function hasLocal(node, name) {
    const l2 = locals.get(node);
    return l2 ? l2.has(name) : false;
  }
  function declareLocal(node, id) {
    const l2 = locals.get(node);
    if (l2)
      l2.add(id.name);
    else
      locals.set(node, new Set([id.name]));
  }
  function declareClass(node) {
    if (node.id)
      declareLocal(node, node.id);
  }
  function declareFunction(node) {
    node.params.forEach((param) => declarePattern(param, node));
    if (node.id)
      declareLocal(node, node.id);
  }
  function declareCatchClause(node) {
    if (node.param)
      declarePattern(node.param, node);
  }
  function declarePattern(node, parent) {
    switch (node.type) {
      case "Identifier":
        declareLocal(parent, node);
        break;
      case "ObjectPattern":
        node.properties.forEach((node2) => declarePattern(node2, parent));
        break;
      case "ArrayPattern":
        node.elements.forEach((node2) => node2 && declarePattern(node2, parent));
        break;
      case "Property":
        declarePattern(node.value, parent);
        break;
      case "RestElement":
        declarePattern(node.argument, parent);
        break;
      case "AssignmentPattern":
        declarePattern(node.left, parent);
        break;
      default:
        throw new Error("Unrecognized pattern type: " + node.type);
    }
  }
  function declareModuleSpecifier(node) {
    declareLocal(ast, node.local);
  }
  ancestor(ast, {
    VariableDeclaration: (node, parents) => {
      let parent = null;
      for (let i2 = parents.length - 1; i2 >= 0 && parent === null; --i2) {
        if (node.kind === "var" ? isScope(parents[i2]) : isBlockScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      node.declarations.forEach((declaration) => declarePattern(declaration.id, parent));
    },
    FunctionDeclaration: (node, parents) => {
      let parent = null;
      for (let i2 = parents.length - 2; i2 >= 0 && parent === null; --i2) {
        if (isScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      declareLocal(parent, node.id);
      declareFunction(node);
    },
    Function: declareFunction,
    ClassDeclaration: (node, parents) => {
      let parent = null;
      for (let i2 = parents.length - 2; i2 >= 0 && parent === null; i2--) {
        if (isScope(parents[i2])) {
          parent = parents[i2];
        }
      }
      declareLocal(parent, node.id);
    },
    Class: declareClass,
    CatchClause: declareCatchClause,
    ImportDefaultSpecifier: declareModuleSpecifier,
    ImportSpecifier: declareModuleSpecifier,
    ImportNamespaceSpecifier: declareModuleSpecifier
  }, walk_default);
  function identifier(node, parents) {
    let name = node.name;
    if (name === "undefined")
      return;
    for (let i2 = parents.length - 2; i2 >= 0; --i2) {
      if (name === "arguments") {
        if (declaresArguments(parents[i2])) {
          return;
        }
      }
      if (hasLocal(parents[i2], name)) {
        return;
      }
      if (parents[i2].type === "ViewExpression") {
        node = parents[i2];
        name = `viewof ${node.id.name}`;
      }
      if (parents[i2].type === "MutableExpression") {
        node = parents[i2];
        name = `mutable ${node.id.name}`;
      }
    }
    if (!globalSet.has(name)) {
      if (name === "arguments") {
        throw Object.assign(new SyntaxError(`arguments is not allowed`), { node });
      }
      references.push(node);
    }
  }
  ancestor(ast, {
    VariablePattern: identifier,
    Identifier: identifier
  }, walk_default);
  function checkConst(node, parents) {
    if (!node)
      return;
    switch (node.type) {
      case "Identifier":
      case "VariablePattern": {
        for (const parent of parents) {
          if (hasLocal(parent, node.name)) {
            return;
          }
        }
        if (parents[parents.length - 2].type === "MutableExpression") {
          return;
        }
        throw Object.assign(new SyntaxError(`Assignment to constant variable ${node.name}`), { node });
      }
      case "ArrayPattern": {
        for (const element of node.elements) {
          checkConst(element, parents);
        }
        return;
      }
      case "ObjectPattern": {
        for (const property of node.properties) {
          checkConst(property, parents);
        }
        return;
      }
      case "Property": {
        checkConst(node.value, parents);
        return;
      }
      case "RestElement": {
        checkConst(node.argument, parents);
        return;
      }
    }
  }
  function checkConstArgument(node, parents) {
    checkConst(node.argument, parents);
  }
  function checkConstLeft(node, parents) {
    checkConst(node.left, parents);
  }
  ancestor(ast, {
    AssignmentExpression: checkConstLeft,
    AssignmentPattern: checkConstLeft,
    UpdateExpression: checkConstArgument,
    ForOfStatement: checkConstLeft,
    ForInStatement: checkConstLeft
  }, walk_default);
  return references;
}
function findFeatures(cell, featureName) {
  const ast = { type: "Program", body: [cell.body] };
  const features = new Map();
  const { references } = cell;
  simple(ast, {
    CallExpression: (node) => {
      const { callee, arguments: args } = node;
      if (callee.type !== "Identifier" || callee.name !== featureName || references.indexOf(callee) < 0)
        return;
      if (args.length !== 1 || !(args[0].type === "Literal" && /^['"]/.test(args[0].raw) || args[0].type === "TemplateLiteral" && args[0].expressions.length === 0)) {
        throw Object.assign(new SyntaxError(`${featureName} requires a single literal string argument`), { node });
      }
      const [arg] = args;
      const name = arg.type === "Literal" ? arg.value : arg.quasis[0].value.cooked;
      const location2 = { start: arg.start, end: arg.end };
      if (features.has(name))
        features.get(name).push(location2);
      else
        features.set(name, [location2]);
    }
  }, walk_default);
  return features;
}
var SCOPE_FUNCTION = 2;
var SCOPE_ASYNC = 4;
var SCOPE_GENERATOR = 8;
var STATE_START = Symbol("start");
var STATE_MODIFIER = Symbol("modifier");
var STATE_FUNCTION = Symbol("function");
var STATE_NAME = Symbol("name");
var CellParser = class extends Parser {
  constructor(options, ...args) {
    super(Object.assign({ ecmaVersion: 12 }, options), ...args);
  }
  enterScope(flags) {
    if (flags & SCOPE_FUNCTION)
      ++this.O_function;
    return super.enterScope(flags);
  }
  exitScope() {
    if (this.currentScope().flags & SCOPE_FUNCTION)
      --this.O_function;
    return super.exitScope();
  }
  parseForIn(node, init) {
    if (this.O_function === 1 && node.await)
      this.O_async = true;
    return super.parseForIn(node, init);
  }
  parseAwait() {
    if (this.O_function === 1)
      this.O_async = true;
    return super.parseAwait();
  }
  parseYield(noIn) {
    if (this.O_function === 1)
      this.O_generator = true;
    return super.parseYield(noIn);
  }
  parseImport(node) {
    this.next();
    node.specifiers = this.parseImportSpecifiers();
    if (this.type === tt._with) {
      this.next();
      node.injections = this.parseImportSpecifiers();
    }
    this.expectContextual("from");
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
    return this.finishNode(node, "ImportDeclaration");
  }
  parseImportSpecifiers() {
    const nodes = [];
    const identifiers = new Set();
    let first = true;
    this.expect(tt.braceL);
    while (!this.eat(tt.braceR)) {
      if (first) {
        first = false;
      } else {
        this.expect(tt.comma);
        if (this.afterTrailingComma(tt.braceR))
          break;
      }
      const node = this.startNode();
      node.view = this.eatContextual("viewof");
      node.mutable = node.view ? false : this.eatContextual("mutable");
      node.imported = this.parseIdent();
      this.checkUnreserved(node.imported);
      this.checkLocal(node.imported);
      if (this.eatContextual("as")) {
        node.local = this.parseIdent();
        this.checkUnreserved(node.local);
        this.checkLocal(node.local);
      } else {
        node.local = node.imported;
      }
      this.checkLVal(node.local, "let");
      if (identifiers.has(node.local.name)) {
        this.raise(node.local.start, `Identifier '${node.local.name}' has already been declared`);
      }
      identifiers.add(node.local.name);
      nodes.push(this.finishNode(node, "ImportSpecifier"));
    }
    return nodes;
  }
  parseExprAtom(refDestructuringErrors) {
    return this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || super.parseExprAtom(refDestructuringErrors);
  }
  startCell() {
    this.O_function = 0;
    this.O_async = false;
    this.O_generator = false;
    this.strict = true;
    this.enterScope(SCOPE_FUNCTION | SCOPE_ASYNC | SCOPE_GENERATOR);
  }
  finishCell(node, body, id) {
    if (id)
      this.checkLocal(id);
    node.id = id;
    node.body = body;
    node.async = this.O_async;
    node.generator = this.O_generator;
    this.exitScope();
    return this.finishNode(node, "Cell");
  }
  parseCell(node, eof) {
    const lookahead = new CellParser({}, this.input, this.start);
    let token = lookahead.getToken();
    let body = null;
    let id = null;
    this.startCell();
    if (token.type === tt._import && lookahead.getToken().type !== tt.parenL) {
      body = this.parseImport(this.startNode());
    } else if (token.type !== tt.eof && token.type !== tt.semi) {
      if (token.type === tt.name) {
        if (token.value === "viewof" || token.value === "mutable") {
          token = lookahead.getToken();
          if (token.type !== tt.name) {
            lookahead.unexpected();
          }
        }
        token = lookahead.getToken();
        if (token.type === tt.eq) {
          id = this.parseMaybeKeywordExpression("viewof", "ViewExpression") || this.parseMaybeKeywordExpression("mutable", "MutableExpression") || this.parseIdent();
          token = lookahead.getToken();
          this.expect(tt.eq);
        }
      }
      if (token.type === tt.braceL) {
        body = this.parseBlock();
      } else {
        body = this.parseExpression();
        if (id === null && (body.type === "FunctionExpression" || body.type === "ClassExpression")) {
          id = body.id;
        }
      }
    }
    this.semicolon();
    if (eof)
      this.expect(tt.eof);
    return this.finishCell(node, body, id);
  }
  parseTopLevel(node) {
    return this.parseCell(node, true);
  }
  toAssignable(node, isBinding, refDestructuringErrors) {
    return node.type === "MutableExpression" ? node : super.toAssignable(node, isBinding, refDestructuringErrors);
  }
  checkLocal(id) {
    const node = id.id || id;
    if (globals_default.has(node.name) || node.name === "arguments") {
      this.raise(node.start, `Identifier '${node.name}' is reserved`);
    }
  }
  checkUnreserved(node) {
    if (node.name === "viewof" || node.name === "mutable") {
      this.raise(node.start, `Unexpected keyword '${node.name}'`);
    }
    return super.checkUnreserved(node);
  }
  checkLVal(expr, bindingType, checkClashes) {
    return super.checkLVal(expr.type === "MutableExpression" ? expr.id : expr, bindingType, checkClashes);
  }
  unexpected(pos) {
    this.raise(pos != null ? pos : this.start, this.type === tt.eof ? "Unexpected end of input" : "Unexpected token");
  }
  parseMaybeKeywordExpression(keyword, type) {
    if (this.isContextual(keyword)) {
      const node = this.startNode();
      this.next();
      node.id = this.parseIdent();
      return this.finishNode(node, type);
    }
  }
};
var o_tmpl = new TokContext("`", true, true, (parser) => readTemplateToken.call(parser));
function readTemplateToken() {
  out:
    for (; this.pos < this.input.length; this.pos++) {
      switch (this.input.charCodeAt(this.pos)) {
        case 92: {
          if (this.pos < this.input.length - 1)
            ++this.pos;
          break;
        }
        case 36: {
          if (this.input.charCodeAt(this.pos + 1) === 123) {
            if (this.pos === this.start && this.type === tt.invalidTemplate) {
              this.pos += 2;
              return this.finishToken(tt.dollarBraceL);
            }
            break out;
          }
          break;
        }
      }
    }
  return this.finishToken(tt.invalidTemplate, this.input.slice(this.start, this.pos));
}
function parseModule(input, { globals } = {}) {
  const program = ModuleParser.parse(input);
  for (const cell of program.cells) {
    parseReferences(cell, input, globals);
    parseFeatures(cell, input, globals);
  }
  return program;
}
var ModuleParser = class extends CellParser {
  parseTopLevel(node) {
    if (!node.cells)
      node.cells = [];
    while (this.type !== tt.eof) {
      const cell = this.parseCell(this.startNode());
      cell.input = this.input;
      node.cells.push(cell);
    }
    this.next();
    return this.finishNode(node, "Program");
  }
};
function parseReferences(cell, input, globals = globals_default) {
  if (!cell.body) {
    cell.references = [];
  } else if (cell.body.type === "ImportDeclaration") {
    cell.references = cell.body.injections ? cell.body.injections.map((i2) => i2.imported) : [];
  } else {
    try {
      cell.references = findReferences(cell, globals);
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input, error.node.start);
        error.message += ` (${loc.line}:${loc.column})`;
        error.pos = error.node.start;
        error.loc = loc;
        delete error.node;
      }
      throw error;
    }
  }
  return cell;
}
function parseFeatures(cell, input) {
  if (cell.body && cell.body.type !== "ImportDeclaration") {
    try {
      cell.fileAttachments = findFeatures(cell, "FileAttachment");
      cell.databaseClients = findFeatures(cell, "DatabaseClient");
      cell.secrets = findFeatures(cell, "Secret");
    } catch (error) {
      if (error.node) {
        const loc = getLineInfo(input, error.node.start);
        error.message += ` (${loc.line}:${loc.column})`;
        error.pos = error.node.start;
        error.loc = loc;
        delete error.node;
      }
      throw error;
    }
  } else {
    cell.fileAttachments = new Map();
    cell.databaseClients = new Map();
    cell.secrets = new Map();
  }
  return cell;
}

// ojs-connector.js
var EmptyInspector = class {
  pending() {
  }
  fulfilled(_value, _name) {
  }
  rejected(_error, _name) {
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
async function defaultResolveImportPath(path) {
  const extractPath = (path2) => {
    let source2 = path2;
    let m3;
    if (m3 = /\.js(\?|$)/i.exec(source2)) {
      source2 = source2.slice(0, m3.index);
    }
    if (m3 = /^[0-9a-f]{16}$/i.test(source2)) {
      source2 = `d/${source2}`;
    }
    if (m3 = /^https:\/\/(api\.|beta\.|)observablehq\.com\//i.exec(source2)) {
      source2 = source2.slice(m3[0].length);
    }
    return source2;
  };
  const source = extractPath(path);
  const metadataURL = `https://api.observablehq.com/document/${source}`;
  const moduleURL = `https://api.observablehq.com/${source}.js?v=3`;
  const m2 = await import(moduleURL);
  return m2.default;
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
  return async (path) => {
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
      try {
        const m2 = await import(importPath);
        return es6ImportAsObservableModule(m2);
      } catch (e2) {
        console.error(e2);
        throw e2;
      }
    } else if (moduleType === "ojs") {
      return importOjsFromURL(fetchPath);
    } else if (moduleType === "qmd") {
      const htmlPath = `${fetchPath.slice(0, -4)}.html`;
      const response = await fetch(htmlPath);
      const text = await response.text();
      return createOjsModuleFromHTMLSrc(text);
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
var OJSConnector = class {
  constructor({ paths, inspectorClass, library, allowPendingGlobals = false }) {
    this.library = library || new Oe();
    this.localResolverMap = new Map();
    this.pendingGlobals = {};
    this.allowPendingGlobals = allowPendingGlobals;
    this.runtime = new Runtime(this.library, (name) => this.global(name));
    this.mainModule = this.runtime.module();
    this.interpreter = new Interpreter({
      module: this.mainModule,
      resolveImportPath: importPathResolver(paths, this.localResolverMap)
    });
    this.inspectorClass = inspectorClass || Inspector3;
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
  finishInterpreting() {
    return Promise.all(this.chunkPromises);
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
};

// quarto-ojs.js
var makeDevhostErrorClickHandler = (line, column) => {
  return function() {
    if (!window.quartoDevhost) {
      return false;
    }
    window.quartoDevhost.openInputFile(line, column, true);
    return false;
  };
};
if (Object.fromEntries === void 0) {
  Object.fromEntries = function(obj) {
    const result = {};
    for (const [key, value] of obj) {
      result[key] = value;
    }
    return result;
  };
}
function calloutBlock(opts) {
  const {
    type,
    heading,
    message,
    onclick
  } = opts;
  const outerBlock = document.createElement("div");
  outerBlock.classList.add(`callout-${type}`, "callout", "callout-style-default", "callout-captioned");
  const header = document.createElement("div");
  header.classList.add("callout-header", "d-flex", "align-content-center");
  const iconContainer = document.createElement("div");
  iconContainer.classList.add("callout-icon-container");
  const icon = document.createElement("i");
  icon.classList.add("callout-icon");
  iconContainer.appendChild(icon);
  header.appendChild(iconContainer);
  const headingDiv = document.createElement("div");
  headingDiv.classList.add("callout-caption-container", "flex-fill");
  if (typeof heading === "string") {
    headingDiv.innerText = heading;
  } else {
    headingDiv.appendChild(heading);
  }
  header.appendChild(headingDiv);
  outerBlock.appendChild(header);
  const container = document.createElement("div");
  container.classList.add("callout-body-container", "callout-body");
  if (typeof message === "string") {
    const p2 = document.createElement("p");
    p2.innerText = message;
    container.appendChild(p2);
  } else {
    container.append(message);
  }
  outerBlock.appendChild(container);
  if (onclick) {
    outerBlock.onclick = onclick;
    outerBlock.style.cursor = "pointer";
  }
  return outerBlock;
}
var kQuartoModuleWaitClass = "ojs-in-a-box-waiting-for-module-import";
var QuartoOJSConnector = class extends OJSConnector {
  constructor(opts) {
    super(opts);
  }
  clearImportModuleWait() {
    const array = Array.from(document.querySelectorAll(`.${kQuartoModuleWaitClass}`));
    for (const node of array) {
      node.classList.remove(kQuartoModuleWaitClass);
    }
  }
  finishInterpreting() {
    return super.finishInterpreting().then(() => {
      if (this.mainModuleHasImports) {
        this.clearImportModuleWait();
      }
    });
  }
  locatePreDiv(cellDiv, ojsDiv) {
    let preDiv;
    for (const candidate of cellDiv.querySelectorAll("pre.sourceCode")) {
      if (candidate.compareDocumentPosition(ojsDiv) & ojsDiv.DOCUMENT_POSITION_FOLLOWING) {
        preDiv = candidate;
      } else {
        break;
      }
    }
    return preDiv;
  }
  findCellOutputDisplay(ojsDiv) {
    while (ojsDiv && !ojsDiv.classList.contains("cell-output-display")) {
      ojsDiv = ojsDiv.parentElement;
    }
    if (!ojsDiv) {
      throw new Error("Internal error: couldn't find output display div");
    }
    return ojsDiv;
  }
  setPreDivClasses(preDiv, hasErrors) {
    if (!hasErrors) {
      preDiv.classList.remove("numberSource");
      if (preDiv._hidden === true) {
        preDiv.parentElement.classList.add("hidden");
      }
    } else {
      preDiv.classList.add("numberSource");
      if (preDiv.parentElement.classList.contains("hidden")) {
        preDiv._hidden = true;
        preDiv.parentElement.classList.remove("hidden");
      }
    }
  }
  clearErrorPinpoints(cellDiv, ojsDiv) {
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === void 0) {
      return;
    }
    this.setPreDivClasses(preDiv, false);
    let startingOffset = 0;
    if (preDiv.parentElement.dataset.sourceOffset) {
      startingOffset = -Number(preDiv.parentElement.dataset.sourceOffset);
    }
    for (const entryPoint of preDiv._decorator.spanSelection(startingOffset, Infinity)) {
      const { node } = entryPoint;
      node.classList.remove("quarto-ojs-error-pinpoint");
      node.onclick = null;
    }
  }
  decorateOjsDivWithErrorPinpoint(ojsDiv, start, end, line, column) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    if (cellOutputDisplay._errorSpans === void 0) {
      cellOutputDisplay._errorSpans = [];
    }
    cellOutputDisplay._errorSpans.push({
      start,
      end,
      line,
      column
    });
  }
  decorateSource(cellDiv, ojsDiv) {
    this.clearErrorPinpoints(cellDiv, ojsDiv);
    const preDiv = this.locatePreDiv(cellDiv, ojsDiv);
    if (preDiv === void 0) {
      return;
    }
    let div = preDiv.parentElement.nextElementSibling;
    let foundErrors = false;
    while (div !== null && div.classList.contains("cell-output-display")) {
      for (const errorSpan of div._errorSpans || []) {
        for (const entryPoint of preDiv._decorator.spanSelection(errorSpan.start, errorSpan.end)) {
          const { node } = entryPoint;
          node.classList.add("quarto-ojs-error-pinpoint");
          node.onclick = makeDevhostErrorClickHandler(errorSpan.line, errorSpan.column);
        }
        foundErrors = true;
      }
      div = div.nextElementSibling;
    }
    this.setPreDivClasses(preDiv, foundErrors);
  }
  clearError(ojsDiv) {
    const cellOutputDisplay = this.findCellOutputDisplay(ojsDiv);
    cellOutputDisplay._errorSpans = [];
  }
  signalError(cellDiv, ojsDiv, ojsAst) {
    const buildCallout = (ojsDiv2) => {
      let onclick;
      const inspectChild = ojsDiv2.querySelector(".observablehq--inspect");
      let [heading, message] = inspectChild.textContent.split(": ");
      if (heading === "RuntimeError") {
        heading = "OJS Runtime Error";
        if (message.match(/^(.+) is not defined$/)) {
          const [varName, ...rest] = message.split(" ");
          const p2 = document.createElement("p");
          const tt2 = document.createElement("tt");
          tt2.innerText = varName;
          p2.appendChild(tt2);
          p2.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p2;
          const preDiv = this.locatePreDiv(cellDiv, ojsDiv2);
          if (preDiv !== void 0) {
            preDiv.classList.add("numberSource");
            const missingRef = ojsAst.references.find((n2) => n2.name === varName);
            if (missingRef !== void 0) {
              const { line, column } = preDiv._decorator.offsetToLineColumn(missingRef.start);
              const headingSpan = document.createElement("span");
              const headingTextEl = document.createTextNode(`${heading} (line ${line}, column ${column}) `);
              headingSpan.appendChild(headingTextEl);
              if (window.quartoDevhost) {
                const clicker = document.createElement("a");
                clicker.href = "#";
                clicker.innerText = "(source)";
                onclick = makeDevhostErrorClickHandler(line, column);
                headingSpan.appendChild(clicker);
              }
              heading = headingSpan;
              this.decorateOjsDivWithErrorPinpoint(ojsDiv2, missingRef.start, missingRef.end, line, column);
            }
          }
        } else if (message.match(/^(.+) could not be resolved$/) || message.match(/^(.+) is defined more than once$/)) {
          const [varName, ...rest] = message.split(" ");
          const p2 = document.createElement("p");
          const tt2 = document.createElement("tt");
          tt2.innerText = varName;
          p2.appendChild(tt2);
          p2.appendChild(document.createTextNode(" " + rest.join(" ")));
          message = p2;
        } else if (message === "circular definition") {
          const p2 = document.createElement("p");
          p2.appendChild(document.createTextNode("circular definition"));
          message = p2;
        } else {
          throw new Error(`Internal error, could not parse OJS error message "${message}"`);
        }
      } else {
        heading = "OJS Error";
        const p2 = document.createElement("p");
        p2.appendChild(document.createTextNode(inspectChild.textContent));
        message = p2;
      }
      const callout = calloutBlock({
        type: "important",
        heading,
        message,
        onclick
      });
      ojsDiv2.appendChild(callout);
    };
    buildCallout(ojsDiv);
  }
  interpret(src, elementGetter, elementCreator) {
    const that = this;
    const observer = (targetElement, ojsAst) => {
      return (name) => {
        const element = typeof elementCreator === "function" ? elementCreator() : elementCreator;
        targetElement.appendChild(element);
        if (ojsAst.id && ojsAst.id.type === "ViewExpression" && !name.startsWith("viewof ")) {
          element.classList.add("quarto-ojs-hide");
        }
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }
        const forceShowDeclarations = !(cellDiv && cellDiv.dataset.output !== "all");
        const config = { childList: true };
        const callback = function(mutationsList) {
          for (const mutation of mutationsList) {
            const ojsDiv = mutation.target;
            if (!forceShowDeclarations) {
              Array.from(mutation.target.childNodes).filter((n2) => {
                return n2.classList.contains("observablehq--inspect") && !n2.parentNode.classList.contains("observablehq--error") && n2.parentNode.parentNode.dataset.nodetype !== "expression";
              }).forEach((n2) => n2.classList.add("quarto-ojs-hide"));
              Array.from(mutation.target.childNodes).filter((n2) => {
                return n2.classList.contains("observablehq--inspect") && !n2.parentNode.classList.contains("observablehq--error") && n2.parentNode.parentNode.dataset.nodetype === "expression";
              }).forEach((n2) => n2.classList.remove("quarto-ojs-hide"));
            }
            if (ojsDiv.classList.contains("observablehq--error")) {
              ojsDiv.querySelector(".observablehq--inspect").style.display = "none";
              if (ojsDiv.querySelectorAll(".callout-important").length === 0) {
                that.signalError(cellDiv, ojsDiv, ojsAst);
              }
            } else {
              that.clearError(ojsDiv);
              if (ojsDiv.parentNode.dataset.nodetype !== "expression" && !forceShowDeclarations && Array.from(ojsDiv.childNodes).every((n2) => n2.classList.contains("observablehq--inspect"))) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
            that.decorateSource(cellDiv, ojsDiv);
            for (const added of mutation.addedNodes) {
              const result = added.querySelectorAll("code.javascript");
              if (result.length !== 1) {
                continue;
              }
              if (result[0].textContent.trim().startsWith("import")) {
                ojsDiv.classList.add("quarto-ojs-hide");
              }
            }
          }
          if (cellOutputDisplay) {
            const children = Array.from(cellOutputDisplay.querySelectorAll("div.observablehq"));
            if (children.every((n2) => {
              return n2.classList.contains("quarto-ojs-hide");
            })) {
              cellOutputDisplay.classList.add("quarto-ojs-hide");
            } else {
              cellOutputDisplay.classList.remove("quarto-ojs-hide");
            }
          }
        };
        new MutationObserver(callback).observe(element, config);
        element.classList.add(kQuartoModuleWaitClass);
        return new this.inspectorClass(element, ojsAst);
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
  const lib = new Oe();
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
  Array.from(document.querySelectorAll("span.co")).filter((n2) => n2.textContent === "//| echo: fenced").forEach((n2) => {
    const lineSpan = n2.parentElement;
    const lineBreak = lineSpan.nextSibling;
    if (lineBreak) {
      const nextLineSpan = lineBreak.nextSibling;
      if (nextLineSpan) {
        const lineNumber = Number(nextLineSpan.id.split("-")[1]);
        nextLineSpan.style = `counter-reset: source-line ${lineNumber - 1}`;
      }
    }
    const sourceDiv = lineSpan.parentElement.parentElement.parentElement;
    const oldOffset = Number(sourceDiv.dataset.sourceOffset);
    sourceDiv.dataset.sourceOffset = oldOffset - "//| echo: fenced\n".length;
    lineSpan.remove();
    lineBreak.remove();
  });
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
  lib.FileAttachment = () => ae(fileAttachmentPathResolver);
  const ojsConnector = new QuartoOJSConnector({
    paths: quartoOjsGlobal.paths,
    inspectorClass: isShiny ? ShinyInspector : QuartoInspector,
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
  const sourceNodes = document.querySelectorAll("pre.sourceCode code.sourceCode");
  const decorators = Array.from(sourceNodes).map((n2) => {
    n2 = n2.parentElement;
    const decorator = new PandocCodeDecorator(n2);
    n2._decorator = decorator;
    return decorator;
  });
  decorators.forEach((n2) => {
    if (n2._node.parentElement.dataset.syntaxErrorPosition === void 0) {
      return;
    }
    const offset = Number(n2._node.parentElement.dataset.syntaxErrorPosition);
    n2.decorateSpan(offset, offset + 1, ["quarto-ojs-error-pinpoint"]);
  });
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
      let targetElement;
      const getElement = () => {
        targetElement = document.getElementById(targetElementId);
        let subFigId;
        if (!targetElement) {
          subFigId = getSubfigId(targetElementId);
          targetElement = document.getElementById(subFigId);
          if (!targetElement) {
            throw new Error("Ran out of quarto subfigures.");
          }
        }
        return targetElement;
      };
      const makeElement = () => {
        return document.createElement(inline ? "span" : "div");
      };
      return ojsConnector.interpret(src, getElement, makeElement).catch((e2) => {
        let cellDiv = targetElement;
        let cellOutputDisplay;
        while (cellDiv !== null && !cellDiv.classList.contains("cell")) {
          cellDiv = cellDiv.parentElement;
          if (cellDiv && cellDiv.classList.contains("cell-output-display")) {
            cellOutputDisplay = cellDiv;
          }
        }
        const ojsDiv = targetElement.querySelector(".observablehq");
        for (const div of ojsDiv.querySelectorAll(".callout")) {
          div.remove();
        }
        const messagePre = document.createElement("pre");
        messagePre.innerText = e2.stack;
        const callout = calloutBlock({
          type: "important",
          heading: `${e2.name}: ${e2.message}`,
          message: messagePre
        });
        ojsDiv.appendChild(callout);
        ojsConnector.clearError(ojsDiv);
        ojsConnector.clearErrorPinpoints(cellDiv, ojsDiv);
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
  createRuntime
};
