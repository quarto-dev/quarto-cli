import * as xspattern from "/-/xspattern@v3.1.0-ChOssaTvtX8cZQgPaNnM/dist=es2019,mode=imports/optimized/xspattern.js";
import * as prsc from "/-/prsc@v4.0.0-yiYip3qo0YwPataeg654/dist=es2019,mode=imports/optimized/prsc.js";
const fontoxpath = function(xspattern2, prsc2) {
  const VERSION = "3.29.1";
  const fontoxpathGlobal = {};
  function aa(a, b) {
    if (!(a !== "0" && a !== "-0" || b !== "0" && b !== "-0"))
      return 0;
    var c = /(?:\+|(-))?(\d+)?(?:\.(\d+))?/;
    a = c.exec(a + "");
    var d = c.exec(b + ""), e = !a[1];
    const f = !d[1];
    b = (a[2] || "").replace(/^0*/, "");
    c = (d[2] || "").replace(/^0*/, "");
    a = a[3] || "";
    d = d[3] || "";
    if (e && !f)
      return 1;
    if (!e && f)
      return -1;
    e = e && f;
    if (b.length > c.length)
      return e ? 1 : -1;
    if (b.length < c.length)
      return e ? -1 : 1;
    if (b > c)
      return e ? 1 : -1;
    if (b < c)
      return e ? -1 : 1;
    b = Math.max(a.length, d.length);
    c = a.padEnd(b, "0");
    b = d.padEnd(b, "0");
    return c > b ? e ? 1 : -1 : c < b ? e ? -1 : 1 : 0;
  }
  function ca(a, b) {
    a = a.toString();
    if (-1 < a.indexOf(".") && b === 0)
      return false;
    a = /^[-+]?0*([1-9]\d*)?(?:\.((?:\d*[1-9])*)0*)?$/.exec(a);
    return a[2] ? a[2].length <= b : true;
  }
  function ea() {
    return function(a, b) {
      return 1 > aa(a, b);
    };
  }
  function fa() {
    return function(a, b) {
      return 0 > aa(a, b);
    };
  }
  function ha() {
    return function(a, b) {
      return -1 < aa(a, b);
    };
  }
  function ia() {
    return function(a, b) {
      return 0 < aa(a, b);
    };
  }
  function ja(a, b) {
    switch (b) {
      case "required":
        return /(Z)|([+-])([01]\d):([0-5]\d)$/.test(a.toString());
      case "prohibited":
        return !/(Z)|([+-])([01]\d):([0-5]\d)$/.test(a.toString());
      case "optional":
        return true;
    }
  }
  function ka(a) {
    switch (a) {
      case 1:
      case 0:
      case 6:
      case 3:
        return {};
      case 4:
        return {ka: ca, ua: ea(), lc: fa(), va: ha(), mc: ia()};
      case 18:
        return {};
      case 9:
      case 8:
      case 7:
      case 11:
      case 12:
      case 13:
      case 15:
      case 14:
        return {Aa: ja};
      case 22:
      case 21:
      case 20:
      case 23:
      case 44:
        return {};
      default:
        return null;
    }
  }
  var la = {}, ma = {};
  function na(a) {
    return /^([+-]?(\d*(\.\d*)?([eE][+-]?\d*)?|INF)|NaN)$/.test(a);
  }
  function oa(a) {
    return /^[_:A-Za-z][-._:A-Za-z0-9]*$/.test(a);
  }
  function pa(a) {
    return oa(a) && /^[_A-Za-z]([-._A-Za-z0-9])*$/.test(a);
  }
  function qa(a) {
    a = a.split(":");
    return a.length === 1 ? pa(a[0]) : a.length !== 2 ? false : pa(a[0]) && pa(a[1]);
  }
  function ra(a) {
    return !/[\u0009\u000A\u000D]/.test(a);
  }
  function sa(a) {
    return pa(a);
  }
  const ta = new Map([
    [45, function() {
      return true;
    }],
    [46, function() {
      return true;
    }],
    [1, function() {
      return true;
    }],
    [0, function(a) {
      return /^(0|1|true|false)$/.test(a);
    }],
    [6, function(a) {
      return na(a);
    }],
    [3, na],
    [4, function(a) {
      return /^[+-]?\d*(\.\d*)?$/.test(a);
    }],
    [18, function(a) {
      return /^(-)?P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d*)?S)?)?$/.test(a);
    }],
    [9, function(a) {
      return /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [8, function(a) {
      return /^(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](\.[0-9]+)?|(24:00:00(\.0+)?))(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [7, function(a) {
      return /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [11, function(a) {
      return /^-?([1-9][0-9]{3,}|0[0-9]{3})-(0[1-9]|1[0-2])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [12, function(a) {
      return /^-?([1-9][0-9]{3,}|0[0-9]{3})(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [13, function(a) {
      return /^--(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [15, function(a) {
      return /^---(0[1-9]|[12][0-9]|3[01])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [14, function(a) {
      return /^--(0[1-9]|1[0-2])(Z|(\+|-)((0[0-9]|1[0-3]):[0-5][0-9]|14:00))?$/.test(a);
    }],
    [22, function(a) {
      return /^([0-9A-Fa-f]{2})*$/.test(a);
    }],
    [21, function(a) {
      return new RegExp(/^((([A-Za-z0-9+/] ?){4})*((([A-Za-z0-9+/] ?){3}[A-Za-z0-9+/])|(([A-Za-z0-9+/] ?){2}[AEIMQUYcgkosw048] ?=)|(([A-Za-z0-9+/] ?)[AQgw] ?= ?=)))?$/).test(a);
    }],
    [20, function() {
      return true;
    }],
    [44, qa],
    [48, ra],
    [52, function(a) {
      return ra(a) && !/^ | {2,}| $/.test(a);
    }],
    [51, function(a) {
      return /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/.test(a);
    }],
    [50, function(a) {
      return /^[-._:A-Za-z0-9]+$/.test(a);
    }],
    [25, oa],
    [23, qa],
    [24, pa],
    [42, sa],
    [41, sa],
    [26, function(a) {
      return pa(a);
    }],
    [5, function(a) {
      return /^[+-]?\d+$/.test(a);
    }],
    [16, function(a) {
      return /^-?P[0-9]+(Y([0-9]+M)?|M)$/.test(a);
    }],
    [17, function(a) {
      return /^-?P([0-9]+D)?(T([0-9]+H)?([0-9]+M)?([0-9]+(\.[0-9]+)?S)?)?$/.test(a);
    }]
  ]);
  var ua = Object.create(null);
  [
    {C: 0, name: 59},
    {C: 0, name: 46, parent: 59, K: {whiteSpace: "preserve"}},
    {C: 0, name: 19, parent: 46},
    {C: 0, name: 1, parent: 46},
    {C: 0, name: 0, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 4, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 6, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 3, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 18, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 9, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 8, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {
      C: 0,
      name: 7,
      parent: 46,
      K: {Aa: "optional", whiteSpace: "collapse"}
    },
    {C: 0, name: 11, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 12, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 13, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 15, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 14, parent: 46, K: {Aa: "optional", whiteSpace: "collapse"}},
    {C: 0, name: 22, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 21, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 20, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 23, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 0, name: 44, parent: 46, K: {whiteSpace: "collapse"}},
    {C: 1, name: 10, R: 9, K: {whiteSpace: "collapse", Aa: "required"}},
    {C: 1, name: 48, R: 1, K: {whiteSpace: "replace"}},
    {C: 1, name: 52, R: 48, K: {whiteSpace: "collapse"}},
    {C: 1, name: 51, R: 52, K: {whiteSpace: "collapse"}},
    {C: 1, name: 50, R: 52, K: {whiteSpace: "collapse"}},
    {C: 2, name: 49, type: 50, K: {minLength: 1, whiteSpace: "collapse"}},
    {C: 1, name: 25, R: 52, K: {whiteSpace: "collapse"}},
    {C: 1, name: 24, R: 25, K: {whiteSpace: "collapse"}},
    {
      C: 1,
      name: 42,
      R: 24,
      K: {whiteSpace: "collapse"}
    },
    {C: 1, name: 41, R: 24, K: {whiteSpace: "collapse"}},
    {C: 2, name: 43, type: 41, K: {minLength: 1, whiteSpace: "collapse"}},
    {C: 1, name: 26, R: 24, K: {whiteSpace: "collapse"}},
    {C: 2, name: 40, type: 26, K: {minLength: 1, whiteSpace: "collapse"}},
    {C: 0, name: 5, parent: 4, K: {ka: 0, whiteSpace: "collapse"}},
    {C: 1, name: 27, R: 5, K: {ka: 0, ua: "0", whiteSpace: "collapse"}},
    {C: 1, name: 28, R: 27, K: {ka: 0, ua: "-1", whiteSpace: "collapse"}},
    {C: 1, name: 31, R: 5, K: {ka: 0, ua: "9223372036854775807", va: "-9223372036854775808", whiteSpace: "collapse"}},
    {C: 1, name: 32, R: 31, K: {ka: 0, ua: "2147483647", va: "-2147483648", whiteSpace: "collapse"}},
    {C: 1, name: 33, R: 32, K: {ka: 0, ua: "32767", va: "-32768", whiteSpace: "collapse"}},
    {C: 1, name: 34, R: 33, K: {ka: 0, ua: "127", va: "-128", whiteSpace: "collapse"}},
    {C: 1, name: 30, R: 5, K: {ka: 0, va: "0", whiteSpace: "collapse"}},
    {C: 1, name: 36, R: 30, K: {ka: 0, ua: "18446744073709551615", va: "0", whiteSpace: "collapse"}},
    {C: 1, name: 35, R: 36, K: {ka: 0, ua: "4294967295", va: "0", whiteSpace: "collapse"}},
    {C: 1, name: 38, R: 35, K: {ka: 0, ua: "65535", va: "0", whiteSpace: "collapse"}},
    {C: 1, name: 37, R: 38, K: {ka: 0, ua: "255", va: "0", whiteSpace: "collapse"}},
    {C: 1, name: 29, R: 30, K: {ka: 0, va: "1", whiteSpace: "collapse"}},
    {C: 1, name: 16, R: 18, K: {whiteSpace: "collapse"}},
    {C: 1, name: 17, R: 18, K: {whiteSpace: "collapse"}},
    {C: 1, name: 60, R: 59},
    {C: 3, name: 39, Ba: []},
    {C: 1, name: 61, R: 60},
    {C: 1, name: 62, R: 60},
    {C: 0, name: 53, parent: 59},
    {C: 1, name: 54, R: 53},
    {C: 1, name: 58, R: 53},
    {C: 1, name: 47, R: 53},
    {C: 1, name: 56, R: 53},
    {C: 1, name: 57, R: 53},
    {C: 1, name: 55, R: 53},
    {C: 3, name: 2, Ba: [4, 5, 6, 3]},
    {C: 3, name: 63, Ba: []}
  ].forEach((a) => {
    const b = a.name, c = a.K || {};
    switch (a.C) {
      case 0:
        a = a.parent ? ua[a.parent] : null;
        var d = ta.get(b) || null;
        ua[b] = {C: 0, type: b, Ja: c, parent: a, fb: d, Oa: ka(b), Ba: []};
        break;
      case 1:
        a = ua[a.R];
        d = ta.get(b) || null;
        ua[b] = {C: 1, type: b, Ja: c, parent: a, fb: d, Oa: a.Oa, Ba: []};
        break;
      case 2:
        ua[b] = {C: 2, type: b, Ja: c, parent: ua[a.type], fb: null, Oa: la, Ba: []};
        break;
      case 3:
        a = a.Ba.map((e) => ua[e]), ua[b] = {C: 3, type: b, Ja: c, parent: null, fb: null, Oa: ma, Ba: a};
    }
  });
  function g(a, b) {
    if (!ua[b])
      throw Error("Unknown type");
    return {type: b, value: a};
  }
  var va = g(true, 0), wa = g(false, 0);
  var ya = (a = "A wrong argument type was specified in a function call.") => Error(`FORG0006: ${a}`);
  var za = class {
    constructor(a, b) {
      this.done = a;
      this.value = b;
    }
  }, p = new za(true);
  function q(a) {
    return new za(false, a);
  }
  function Aa(a, b) {
    if (b.C === 3)
      return !!b.Ba.find((c) => Aa(a, c));
    for (; a; ) {
      if (a.type === b.type)
        return true;
      if (a.C === 3)
        return !!a.Ba.find((c) => v(c.type, b.type));
      a = a.parent;
    }
    return false;
  }
  function v(a, b) {
    return a === b ? true : Aa(ua[a], ua[b]);
  }
  var Ba = class {
    constructor(a) {
      this.o = w;
      this.h = a;
      let b = -1;
      this.value = {next: () => {
        b++;
        return b >= a.length ? p : q(a[b]);
      }};
    }
    gb() {
      return this;
    }
    filter(a) {
      let b = -1;
      return this.o.create({next: () => {
        for (b++; b < this.h.length && !a(this.h[b], b, this); )
          b++;
        return b >= this.h.length ? p : q(this.h[b]);
      }});
    }
    first() {
      return this.h[0];
    }
    O() {
      return this.h;
    }
    fa() {
      if (v(this.h[0].type, 53))
        return true;
      throw ya("Cannot determine the effective boolean value of a sequence with a length higher than one.");
    }
    Pa() {
      return this.h.length;
    }
    G() {
      return false;
    }
    sa() {
      return false;
    }
    map(a) {
      let b = -1;
      return this.o.create({next: () => ++b >= this.h.length ? p : q(a(this.h[b], b, this))}, this.h.length);
    }
    M(a) {
      return a(this.h);
    }
    Y(a) {
      return a.multiple ? a.multiple(this) : a.default(this);
    }
  };
  var Ca = class {
    constructor() {
      this.value = {next: () => p};
    }
    gb() {
      return this;
    }
    filter() {
      return this;
    }
    first() {
      return null;
    }
    O() {
      return [];
    }
    fa() {
      return false;
    }
    Pa() {
      return 0;
    }
    G() {
      return true;
    }
    sa() {
      return false;
    }
    map() {
      return this;
    }
    M(a) {
      return a([]);
    }
    Y(a) {
      return a.empty ? a.empty(this) : a.default(this);
    }
  };
  var Da = class {
    constructor(a, b) {
      this.type = a;
      this.value = b;
    }
  };
  const Ea = {
    [0]: "xs:boolean",
    [1]: "xs:string",
    [2]: "xs:numeric",
    [3]: "xs:double",
    [4]: "xs:decimal",
    [5]: "xs:integer",
    [6]: "xs:float",
    [7]: "xs:date",
    [8]: "xs:time",
    [9]: "xs:dateTime",
    [10]: "xs:dateTimeStamp",
    [11]: "xs:gYearMonth",
    [12]: "xs:gYear",
    [13]: "xs:gMonthDay",
    [14]: "xs:gMonth",
    [15]: "xs:gDay",
    [16]: "xs:yearMonthDuration",
    [17]: "xs:dayTimeDuration",
    [18]: "xs:duration",
    [19]: "xs:untypedAtomic",
    [20]: "xs:anyURI",
    [21]: "xs:base64Binary",
    [22]: "xs:hexBinary",
    [23]: "xs:QName",
    [24]: "xs:NCName",
    [25]: "xs:Name",
    [26]: "xs:ENTITY",
    [27]: "xs:nonPositiveInteger",
    [28]: "xs:negativeInteger",
    [29]: "xs:positiveInteger",
    [30]: "xs:nonNegativeInteger",
    [31]: "xs:long",
    [32]: "xs:int",
    [33]: "xs:short",
    [34]: "xs:byte",
    [35]: "xs:unsignedInt",
    [36]: "xs:unsignedLong",
    [37]: "xs:unsignedByte",
    [38]: "xs:unsignedShort",
    [39]: "xs:error",
    [40]: "xs:ENTITIES",
    [41]: "xs:IDREF",
    [42]: "xs:ID",
    [43]: "xs:IDREFS",
    [44]: "xs:NOTATION",
    [45]: "xs:anySimpleType",
    [46]: "xs:anyAtomicType",
    [47]: "attribute()",
    [48]: "xs:normalizedString",
    [49]: "xs:NMTOKENS",
    [50]: "xs:NMTOKEN",
    [51]: "xs:language",
    [52]: "xs:token",
    [53]: "node()",
    [54]: "element()",
    [55]: "document-node()",
    [56]: "text()",
    [57]: "processing-instruction()",
    [58]: "comment()",
    [59]: "item()",
    [60]: "function(*)",
    [61]: "map(*)",
    [62]: "array(*)",
    [63]: "none"
  }, Fa = {
    "xs:boolean": 0,
    "xs:string": 1,
    "xs:numeric": 2,
    "xs:double": 3,
    "xs:decimal": 4,
    "xs:integer": 5,
    "xs:float": 6,
    "xs:date": 7,
    "xs:time": 8,
    "xs:dateTime": 9,
    "xs:dateTimeStamp": 10,
    "xs:gYearMonth": 11,
    "xs:gYear": 12,
    "xs:gMonthDay": 13,
    "xs:gMonth": 14,
    "xs:gDay": 15,
    "xs:yearMonthDuration": 16,
    "xs:dayTimeDuration": 17,
    "xs:duration": 18,
    "xs:untypedAtomic": 19,
    "xs:anyURI": 20,
    "xs:base64Binary": 21,
    "xs:hexBinary": 22,
    "xs:QName": 23,
    "xs:NCName": 24,
    "xs:Name": 25,
    "xs:ENTITY": 26,
    "xs:nonPositiveInteger": 27,
    "xs:negativeInteger": 28,
    "xs:positiveInteger": 29,
    "xs:nonNegativeInteger": 30,
    "xs:long": 31,
    "xs:int": 32,
    "xs:short": 33,
    "xs:byte": 34,
    "xs:unsignedInt": 35,
    "xs:unsignedLong": 36,
    "xs:unsignedByte": 37,
    "xs:unsignedShort": 38,
    "xs:error": 39,
    "xs:ENTITIES": 40,
    "xs:IDREF": 41,
    "xs:ID": 42,
    "xs:IDREFS": 43,
    "xs:NOTATION": 44,
    "xs:anySimpleType": 45,
    "xs:anyAtomicType": 46,
    "attribute()": 47,
    "xs:normalizedString": 48,
    "xs:NMTOKENS": 49,
    "xs:NMTOKEN": 50,
    "xs:language": 51,
    "xs:token": 52,
    "node()": 53,
    "element()": 54,
    "document-node()": 55,
    "text()": 56,
    "processing-instruction()": 57,
    "comment()": 58,
    "item()": 59,
    "function(*)": 60,
    "map(*)": 61,
    "array(*)": 62
  };
  function Ha(a) {
    return a.g === 2 ? Ea[a.type] + "*" : a.g === 1 ? Ea[a.type] + "+" : a.g === 0 ? Ea[a.type] + "?" : Ea[a.type];
  }
  function Ia(a) {
    if (a === "none")
      throw Error('XPST0051: The type "none" could not be found');
    if (!a.startsWith("xs:") && 0 <= a.indexOf(":"))
      throw Error(`XPST0081: Invalid prefix for input ${a}`);
    const b = Fa[a];
    if (b === void 0)
      throw Error(`XPST0051: The type "${a}" could not be found`);
    return b;
  }
  function Ja(a) {
    switch (a[a.length - 1]) {
      case "*":
        return {type: Ia(a.substr(0, a.length - 1)), g: 2};
      case "?":
        return {type: Ia(a.substr(0, a.length - 1)), g: 0};
      case "+":
        return {type: Ia(a.substr(0, a.length - 1)), g: 1};
      default:
        return {type: Ia(a), g: 3};
    }
  }
  function Ka(a) {
    switch (a) {
      case "*":
        return 2;
      case "?":
        return 0;
      case "+":
        return 1;
      default:
        return 3;
    }
  }
  function La(a) {
    const b = a.value;
    if (v(a.type, 53))
      return true;
    if (v(a.type, 0))
      return b;
    if (v(a.type, 1) || v(a.type, 20) || v(a.type, 19))
      return b.length !== 0;
    if (v(a.type, 2))
      return !isNaN(b) && b !== 0;
    throw ya(`Cannot determine the effective boolean value of a value with the type ${Ea[a.type]}`);
  }
  function Ma(a, b = 0) {
    a.h = b;
  }
  var Na = class {
    constructor(a, b = null) {
      this.D = w;
      this.value = {next: (c) => {
        if (this.o !== null && this.h >= this.o)
          return p;
        if (this.v[this.h] !== void 0)
          return q(this.v[this.h++]);
        c = a.next(c);
        if (c.done)
          return this.o = this.h, c;
        if (this.l || 2 > this.h)
          this.v[this.h] = c.value;
        this.h++;
        return c;
      }};
      this.l = false;
      this.v = [];
      this.h = 0;
      this.o = b;
    }
    gb() {
      return this.D.create(this.O());
    }
    filter(a) {
      let b = -1;
      const c = this.value;
      return this.D.create({next: (d) => {
        b++;
        for (d = c.next(d); !d.done && !a(d.value, b, this); )
          b++, d = c.next(0);
        return d;
      }});
    }
    first() {
      if (this.v[0] !== void 0)
        return this.v[0];
      const a = this.value.next(0);
      Ma(this);
      return a.done ? null : a.value;
    }
    O() {
      if (this.h > this.v.length && this.o !== this.v.length)
        throw Error("Implementation error: Sequence Iterator has progressed.");
      const a = this.value;
      this.l = true;
      let b = a.next(0);
      for (; !b.done; )
        b = a.next(0);
      return this.v;
    }
    fa() {
      const a = this.value, b = this.h;
      Ma(this);
      var c = a.next(0);
      if (c.done)
        return Ma(this, b), false;
      c = c.value;
      if (v(c.type, 53))
        return Ma(this, b), true;
      if (!a.next(0).done)
        throw ya("Cannot determine the effective boolean value of a sequence with a length higher than one.");
      Ma(this, b);
      return La(c);
    }
    Pa(a = false) {
      if (this.o !== null)
        return this.o;
      if (a)
        return -1;
      a = this.h;
      const b = this.O().length;
      Ma(this, a);
      return b;
    }
    G() {
      return this.o === 0 ? true : this.first() === null;
    }
    sa() {
      if (this.o !== null)
        return this.o === 1;
      var a = this.value;
      const b = this.h;
      Ma(this);
      if (a.next(0).done)
        return Ma(this, b), false;
      a = a.next(0);
      Ma(this, b);
      return a.done;
    }
    map(a) {
      let b = 0;
      const c = this.value;
      return this.D.create({next: (d) => {
        d = c.next(d);
        return d.done ? p : q(a(d.value, b++, this));
      }}, this.o);
    }
    M(a, b) {
      const c = this.value;
      let d;
      const e = [];
      let f = true;
      (function() {
        for (let h = c.next(f ? 0 : b); !h.done; h = c.next(b))
          f = false, e.push(h.value);
        d = a(e).value;
      })();
      return this.D.create({next: () => d.next(0)});
    }
    Y(a) {
      let b = null;
      const c = (d) => {
        b = d.value;
        d = d.Pa(true);
        d !== -1 && (this.o = d);
      };
      return this.D.create({next: (d) => {
        if (b)
          return b.next(d);
        if (this.G())
          return c(a.empty ? a.empty(this) : a.default(this)), b.next(d);
        if (this.sa())
          return c(a.m ? a.m(this) : a.default(this)), b.next(d);
        c(a.multiple ? a.multiple(this) : a.default(this));
        return b.next(d);
      }});
    }
  };
  var Oa = class {
    constructor(a) {
      this.v = w;
      this.h = a;
      let b = false;
      this.value = {next: () => {
        if (b)
          return p;
        b = true;
        return q(a);
      }};
      this.o = null;
    }
    gb() {
      return this;
    }
    filter(a) {
      return a(this.h, 0, this) ? this : this.v.create();
    }
    first() {
      return this.h;
    }
    O() {
      return [this.h];
    }
    fa() {
      this.o === null && (this.o = La(this.h));
      return this.o;
    }
    Pa() {
      return 1;
    }
    G() {
      return false;
    }
    sa() {
      return true;
    }
    map(a) {
      return this.v.create(a(this.h, 0, this));
    }
    M(a) {
      return a([this.h]);
    }
    Y(a) {
      return a.m ? a.m(this) : a.default(this);
    }
  };
  const Pa = new Ca();
  function Qa(a = null, b = null) {
    if (a === null)
      return Pa;
    if (Array.isArray(a))
      switch (a.length) {
        case 0:
          return Pa;
        case 1:
          return new Oa(a[0]);
        default:
          return new Ba(a);
      }
    return a.next ? new Na(a, b) : new Oa(a);
  }
  var w = {create: Qa, m: (a) => new Oa(a), empty: () => Qa(), aa: () => Qa(va), V: () => Qa(wa)};
  function Ra(a) {
    const b = [], c = a.value;
    return () => {
      let d = 0;
      return w.create({next: () => {
        if (b[d] !== void 0)
          return b[d++];
        const e = c.next(0);
        return e.done ? e : b[d++] = e;
      }});
    };
  }
  var Ta = class {
    constructor(a, b, c) {
      this.namespaceURI = b || null;
      this.prefix = a || "";
      this.localName = c;
    }
    ya() {
      return this.prefix ? this.prefix + ":" + this.localName : this.localName;
    }
  };
  function Ua(a, b) {
    const c = a.value, d = b.map((e) => e === null ? null : Ra(e));
    b = b.reduce((e, f, h) => {
      f === null && e.push(a.o[h]);
      return e;
    }, []);
    b = new Va({j: b, arity: b.length, Xa: true, J: a.J, localName: "boundFunction", namespaceURI: a.l, i: a.s, value: function(e, f, h) {
      const k = Array.from(arguments).slice(3), l = d.map((n) => n === null ? k.shift() : n());
      return c.apply(void 0, [e, f, h].concat(l));
    }});
    return w.m(b);
  }
  var Va = class extends Da {
    constructor({j: a, arity: b, Xa: c = false, J: d = false, localName: e, namespaceURI: f, i: h, value: k}) {
      super(60, null);
      this.value = k;
      this.J = d;
      d = -1;
      for (k = 0; k < a.length; k++)
        a[k] === 4 && (d = k);
      -1 < d && (k = Array(b - (a.length - 1)).fill(a[d - 1]), a = a.slice(0, d).concat(k));
      this.o = a;
      this.v = b;
      this.ia = c;
      this.D = e;
      this.l = f;
      this.s = h;
    }
    Xa() {
      return this.ia;
    }
  };
  function Wa(a, b) {
    const c = [];
    a !== 2 && a !== 1 || c.push("type-1-or-type-2");
    c.push(`type-${a}`);
    b && c.push(`name-${b}`);
    return c;
  }
  function Xa(a) {
    const b = a.node.nodeType;
    let c;
    if (b === 2 || b === 1)
      c = a.node.localName;
    return Wa(b, c);
  }
  function Ya(a) {
    const b = a.nodeType;
    let c;
    if (b === 2 || b === 1)
      c = a.localName;
    return Wa(b, c);
  }
  var Za = class {
    getAllAttributes(a, b = null) {
      if (a.nodeType !== 1)
        return [];
      a = Array.from(a.attributes);
      return b === null ? a : a.filter((c) => Ya(c).includes(b));
    }
    getAttribute(a, b) {
      return a.nodeType !== 1 ? null : a.getAttribute(b);
    }
    getChildNodes(a, b = null) {
      a = Array.from(a.childNodes);
      return b === null ? a : a.filter((c) => Ya(c).includes(b));
    }
    getData(a) {
      return a.nodeType === 2 ? a.value : a.data;
    }
    getFirstChild(a, b = null) {
      for (a = a.firstChild; a; a = a.nextSibling)
        if (b === null || Ya(a).includes(b))
          return a;
      return null;
    }
    getLastChild(a, b = null) {
      for (a = a.lastChild; a; a = a.previousSibling)
        if (b === null || Ya(a).includes(b))
          return a;
      return null;
    }
    getNextSibling(a, b = null) {
      for (a = a.nextSibling; a; a = a.nextSibling)
        if (b === null || Ya(a).includes(b))
          return a;
      return null;
    }
    getParentNode(a, b = null) {
      return (a = a.nodeType === 2 ? a.ownerElement : a.parentNode) ? b === null || Ya(a).includes(b) ? a : null : null;
    }
    getPreviousSibling(a, b = null) {
      for (a = a.previousSibling; a; a = a.previousSibling)
        if (b === null || Ya(a).includes(b))
          return a;
      return null;
    }
  };
  class $a {
    insertBefore(a, b, c) {
      return a.insertBefore(b, c);
    }
    removeAttributeNS(a, b, c) {
      return a.removeAttributeNS(b, c);
    }
    removeChild(a, b) {
      return a.removeChild(b);
    }
    setAttributeNS(a, b, c, d) {
      a.setAttributeNS(b, c, d);
    }
    setData(a, b) {
      a.data = b;
    }
  }
  var ab = new $a();
  class bb {
    constructor(a) {
      this.h = a;
    }
    insertBefore(a, b, c) {
      return this.h.insertBefore(a, b, c);
    }
    removeAttributeNS(a, b, c) {
      return this.h.removeAttributeNS(a, b, c);
    }
    removeChild(a, b) {
      return this.h.removeChild(a, b);
    }
    setAttributeNS(a, b, c, d) {
      this.h.setAttributeNS(a, b, c, d);
    }
    setData(a, b) {
      this.h.setData(a, b);
    }
  }
  function cb(a) {
    return a.Ra !== void 0;
  }
  function eb(a, b, c) {
    let d = null;
    b && (cb(b.node) ? d = {F: b.F, offset: c, parent: b.node} : b.F && (d = b.F));
    return {node: a, F: d};
  }
  function fb(a, b, c = null) {
    return a.getAllAttributes(b.node, c).map((d) => eb(d, b, d.nodeName));
  }
  function gb(a, b, c) {
    b = b.node;
    return cb(b) ? (a = b.attributes.find((d) => c === d.name)) ? a.value : null : (a = a.h.getAttribute(b, c)) ? a : null;
  }
  function hb(a, b, c = null) {
    return a.getChildNodes(b.node, c).map((d, e) => eb(d, b, e));
  }
  function ib(a, b) {
    return a.getData(b.node);
  }
  function jb(a, b, c = null) {
    const d = b.node;
    cb(d) ? a = d.childNodes[0] : ((c = a.h.getFirstChild(d, c)) && c.nodeType === 10 && (c = a.h.getNextSibling(c)), a = c);
    return a ? eb(a, b, 0) : null;
  }
  function kb(a, b, c = null) {
    var d = b.node;
    cb(d) ? (a = d.childNodes.length - 1, d = d.childNodes[a]) : ((d = a.h.getLastChild(d, c)) && d.nodeType === 10 && (d = a.h.getPreviousSibling(d)), a = a.getChildNodes(b.node, c).length - 1);
    return d ? eb(d, b, a) : null;
  }
  function x(a, b, c = null) {
    const d = b.node, e = b.F;
    if (e)
      typeof e.offset === "number" && d === e.parent.childNodes[e.offset] || typeof e.offset === "string" && d === e.parent.attributes.find((f) => e.offset === f.nodeName) ? (a = e.parent, b = e.F) : (a = a.getParentNode(d, c), b = e);
    else {
      if (cb(d))
        return null;
      a = a.getParentNode(d, c);
      b = null;
    }
    return a ? {node: a, F: b} : null;
  }
  function lb(a, b, c = null) {
    const d = b.node;
    let e, f, h;
    const k = b.F;
    if (cb(d))
      k && (h = k.offset + 1, e = k.parent.childNodes[h]);
    else if (k)
      h = k.offset + 1, f = x(a, b, null), e = a.getChildNodes(f.node, c)[h];
    else {
      for (e = d; e && (!(e = a.h.getNextSibling(e, c)) || e.nodeType === 10); )
        ;
      return e ? {node: e, F: null} : null;
    }
    return e ? eb(e, f || x(a, b, c), h) : null;
  }
  function mb(a, b, c = null) {
    const d = b.node;
    let e, f;
    const h = b.F;
    let k;
    if (cb(d))
      h && (k = h.offset - 1, e = h.parent.childNodes[k]);
    else if (h)
      k = h.offset - 1, f = x(a, b, null), e = a.getChildNodes(f.node, c)[k];
    else {
      for (e = d; e && (!(e = a.h.getPreviousSibling(e, c)) || e.nodeType === 10); )
        ;
      return e ? {node: e, F: null} : null;
    }
    return e ? eb(e, f || x(a, b, c), k) : null;
  }
  var nb = class {
    constructor(a) {
      this.h = a;
      this.o = [];
    }
    getAllAttributes(a, b = null) {
      return cb(a) ? a.attributes : this.h.getAllAttributes(a, b);
    }
    getChildNodes(a, b = null) {
      b = cb(a) ? a.childNodes : this.h.getChildNodes(a, b);
      return a.nodeType === 9 ? b.filter((c) => c.nodeType !== 10) : b;
    }
    getData(a) {
      return cb(a) ? a.nodeType === 2 ? a.value : a.data : this.h.getData(a) || "";
    }
    getParentNode(a, b = null) {
      return this.h.getParentNode(a, b);
    }
  };
  var ob = (a, b, c, d, e) => e.M(([f]) => d.M(([h]) => {
    const k = f.value;
    if (0 >= k || k > h.h.length)
      throw Error("FOAY0001: array position out of bounds.");
    return h.h[k - 1]();
  }));
  var pb = class extends Va {
    constructor(a) {
      super({value: (b, c, d, e) => ob(b, c, d, w.m(this), e), localName: "get", namespaceURI: "http://www.w3.org/2005/xpath-functions/array", j: [{type: 5, g: 3}], arity: 1, i: {type: 59, g: 2}});
      this.type = 62;
      this.h = a;
    }
  };
  function qb(a) {
    switch (a.node.nodeType) {
      case 2:
        return 47;
      case 1:
        return 54;
      case 3:
      case 4:
        return 56;
      case 7:
        return 57;
      case 8:
        return 58;
      case 9:
        return 55;
      default:
        return 53;
    }
  }
  function rb(a) {
    return {type: qb(a), value: a};
  }
  function A(a, b) {
    a = a.map((c) => c.first());
    return b(a);
  }
  function sb(a, b) {
    var c = v(a.type, 1) || v(a.type, 20) || v(a.type, 19), d = v(b.type, 1) || v(b.type, 20) || v(b.type, 19);
    if (c && d)
      return a.value === b.value;
    c = v(a.type, 4) || v(a.type, 3) || v(a.type, 6);
    d = v(b.type, 4) || v(b.type, 3) || v(b.type, 6);
    if (c && d)
      return isNaN(a.value) && isNaN(b.value) ? true : a.value === b.value;
    c = v(a.type, 0) || v(a.type, 22) || v(a.type, 18) || v(a.type, 23) || v(a.type, 44);
    d = v(b.type, 0) || v(b.type, 22) || v(b.type, 18) || v(b.type, 23) || v(b.type, 44);
    return c && d ? a.value === b.value : false;
  }
  var tb = (a, b, c, d, e) => A([d, e], ([f, h]) => (f = f.h.find((k) => sb(k.key, h))) ? f.value() : w.empty());
  var ub = class extends Va {
    constructor(a) {
      super({j: [{type: 59, g: 3}], arity: 1, localName: "get", namespaceURI: "http://www.w3.org/2005/xpath-functions/map", value: (b, c, d, e) => tb(b, c, d, w.m(this), e), i: {type: 59, g: 2}});
      this.type = 61;
      this.h = a;
    }
  };
  function vb(a, b) {
    return a.h() === b.h() && a.o() === b.o();
  }
  var wb = class {
    Za() {
      return 0;
    }
    getHours() {
      return 0;
    }
    getMinutes() {
      return 0;
    }
    $a() {
      return 0;
    }
    h() {
      return 0;
    }
    o() {
      return 0;
    }
    getSeconds() {
      return 0;
    }
    ab() {
      return 0;
    }
    na() {
      return true;
    }
  };
  function xb(a) {
    var b = Math.abs(a.Za()), c = Math.abs(a.getHours());
    const d = Math.abs(a.getMinutes());
    a = Math.abs(a.getSeconds());
    b = `${b ? `${b}D` : ""}`;
    c = (c ? `${c}H` : "") + (d ? `${d}M` : "") + (a ? `${a}S` : "");
    return b && c ? `${b}T${c}` : b ? b : c ? `T${c}` : "T0S";
  }
  var yb = class extends wb {
    constructor(a) {
      super();
      if (a > Number.MAX_SAFE_INTEGER || a < Number.MIN_SAFE_INTEGER)
        throw Error("FODT0002: Number of seconds given to construct DayTimeDuration overflows MAX_SAFE_INTEGER or MIN_SAFE_INTEGER");
      this.ca = a;
    }
    Za() {
      return Math.trunc(this.ca / 86400);
    }
    getHours() {
      return Math.trunc(this.ca % 86400 / 3600);
    }
    getMinutes() {
      return Math.trunc(this.ca % 3600 / 60);
    }
    o() {
      return this.ca;
    }
    getSeconds() {
      const a = this.ca % 60;
      return Object.is(-0, a) ? 0 : a;
    }
    na() {
      return Object.is(-0, this.ca) ? false : 0 <= this.ca;
    }
    toString() {
      return (this.na() ? "P" : "-P") + xb(this);
    }
  }, zb = (a, b, c, d, e, f) => {
    a = 86400 * a + 3600 * b + 60 * c + d + e;
    return new yb(f || a === 0 ? a : -a);
  }, Ab = (a) => (a = /^(-)?P(\d+Y)?(\d+M)?(\d+D)?(?:T(\d+H)?(\d+M)?(\d+(\.\d*)?S)?)?$/.exec(a)) ? zb(a[4] ? parseInt(a[4], 10) : 0, a[5] ? parseInt(a[5], 10) : 0, a[6] ? parseInt(a[6], 10) : 0, a[7] ? parseInt(a[7], 10) : 0, a[8] ? parseFloat(a[8]) : 0, !a[1]) : null, Bb = (a) => {
    a = /^(Z)|([+-])([01]\d):([0-5]\d)$/.exec(a);
    return a[1] === "Z" ? zb(0, 0, 0, 0, 0, true) : zb(0, a[3] ? parseInt(a[3], 10) : 0, a[4] ? parseInt(a[4], 10) : 0, 0, 0, a[2] === "+");
  };
  function Cb(a, b) {
    if (isNaN(b))
      throw Error("FOCA0005: Cannot multiply xs:dayTimeDuration by NaN");
    a = a.ca * b;
    if (a > Number.MAX_SAFE_INTEGER || !Number.isFinite(a))
      throw Error("FODT0002: Value overflow while multiplying xs:dayTimeDuration");
    return new yb(a < Number.MIN_SAFE_INTEGER || Object.is(-0, a) ? 0 : a);
  }
  function Db(a) {
    return a ? parseInt(a, 10) : null;
  }
  function Fb(a) {
    a += "";
    const b = a.startsWith("-");
    b && (a = a.substring(1));
    return (b ? "-" : "") + a.padStart(4, "0");
  }
  function Gb(a) {
    return (a + "").padStart(2, "0");
  }
  function Hb(a) {
    a += "";
    a.split(".")[0].length === 1 && (a = a.padStart(a.length + 1, "0"));
    return a;
  }
  function Ib(a) {
    return a.getHours() === 0 && a.getMinutes() === 0 ? "Z" : (a.na() ? "+" : "-") + Gb(Math.abs(a.getHours())) + ":" + Gb(Math.abs(a.getMinutes()));
  }
  function Jb(a) {
    var b = /^(?:(-?\d{4,}))?(?:--?(\d\d))?(?:-{1,3}(\d\d))?(T)?(?:(\d\d):(\d\d):(\d\d))?(\.\d+)?(Z|(?:[+-]\d\d:\d\d))?$/.exec(a);
    a = b[1] ? parseInt(b[1], 10) : null;
    const c = Db(b[2]), d = Db(b[3]), e = b[4], f = Db(b[5]), h = Db(b[6]), k = Db(b[7]), l = b[8] ? parseFloat(b[8]) : 0;
    b = b[9] ? Bb(b[9]) : null;
    if (a && (-271821 > a || 273860 < a))
      throw Error("FODT0001: Datetime year is out of bounds");
    return e ? new Kb(a, c, d, f, h, k, l, b, 9) : f !== null && h !== null && k !== null ? new Kb(1972, 12, 31, f, h, k, l, b, 8) : a !== null && c !== null && d !== null ? new Kb(a, c, d, 0, 0, 0, 0, b, 7) : a !== null && c !== null ? new Kb(a, c, 1, 0, 0, 0, 0, b, 11) : c !== null && d !== null ? new Kb(1972, c, d, 0, 0, 0, 0, b, 13) : a !== null ? new Kb(a, 1, 1, 0, 0, 0, 0, b, 12) : c !== null ? new Kb(1972, c, 1, 0, 0, 0, 0, b, 14) : new Kb(1972, 12, d, 0, 0, 0, 0, b, 15);
  }
  function Lb(a, b) {
    switch (b) {
      case 15:
        return new Kb(1972, 12, a.o, 0, 0, 0, 0, a.X, 15);
      case 14:
        return new Kb(1972, a.h, 1, 0, 0, 0, 0, a.X, 14);
      case 12:
        return new Kb(a.v, 1, 1, 0, 0, 0, 0, a.X, 12);
      case 13:
        return new Kb(1972, a.h, a.o, 0, 0, 0, 0, a.X, 13);
      case 11:
        return new Kb(a.v, a.h, 1, 0, 0, 0, 0, a.X, 11);
      case 8:
        return new Kb(1972, 12, 31, a.l, a.s, a.D, a.pa, a.X, 8);
      case 7:
        return new Kb(a.v, a.h, a.o, 0, 0, 0, 0, a.X, 7);
      default:
        return new Kb(a.v, a.h, a.o, a.l, a.s, a.D, a.pa, a.X, 9);
    }
  }
  function Mb(a, b) {
    b = a.X || b || Bb("Z");
    return new Date(Date.UTC(a.v, a.h - 1, a.o, a.l - b.getHours(), a.s - b.getMinutes(), a.D, 1e3 * a.pa));
  }
  var Kb = class {
    constructor(a, b, c, d, e, f, h, k, l = 9) {
      this.v = a;
      this.h = b;
      this.o = c + (d === 24 ? 1 : 0);
      this.l = d === 24 ? 0 : d;
      this.s = e;
      this.D = f;
      this.pa = h;
      this.X = k;
      this.type = l;
    }
    getDay() {
      return this.o;
    }
    getHours() {
      return this.l;
    }
    getMinutes() {
      return this.s;
    }
    getMonth() {
      return this.h;
    }
    getSeconds() {
      return this.D;
    }
    getYear() {
      return this.v;
    }
    toString() {
      switch (this.type) {
        case 9:
          return Fb(this.v) + "-" + Gb(this.h) + "-" + Gb(this.o) + "T" + Gb(this.l) + ":" + Gb(this.s) + ":" + Hb(this.D + this.pa) + (this.X ? Ib(this.X) : "");
        case 7:
          return Fb(this.v) + "-" + Gb(this.h) + "-" + Gb(this.o) + (this.X ? Ib(this.X) : "");
        case 8:
          return Gb(this.l) + ":" + Gb(this.s) + ":" + Hb(this.D + this.pa) + (this.X ? Ib(this.X) : "");
        case 15:
          return "---" + Gb(this.o) + (this.X ? Ib(this.X) : "");
        case 14:
          return "--" + Gb(this.h) + (this.X ? Ib(this.X) : "");
        case 13:
          return "--" + Gb(this.h) + "-" + Gb(this.o) + (this.X ? Ib(this.X) : "");
        case 12:
          return Fb(this.v) + (this.X ? Ib(this.X) : "");
        case 11:
          return Fb(this.v) + "-" + Gb(this.h) + (this.X ? Ib(this.X) : "");
      }
      throw Error("Unexpected subType");
    }
  };
  function Nb(a, b, c) {
    const d = Mb(a, c).getTime();
    c = Mb(b, c).getTime();
    return d === c ? a.pa === b.pa ? 0 : a.pa > b.pa ? 1 : -1 : d > c ? 1 : -1;
  }
  function Ob(a, b, c) {
    return Nb(a, b, c) === 0;
  }
  function Pb(a, b, c) {
    a = (Mb(a, c).getTime() - Mb(b, c).getTime()) / 1e3;
    return new yb(a);
  }
  function Qb(a) {
    throw Error(`Not implemented: adding durations to ${Ea[a.type]}`);
  }
  function Rb(a) {
    throw Error(`Not implemented: subtracting durations from ${Ea[a.type]}`);
  }
  function Sb(a, b) {
    if (a === null)
      return null;
    switch (typeof a) {
      case "boolean":
        return a ? va : wa;
      case "number":
        return g(a, 3);
      case "string":
        return g(a, 1);
      case "object":
        if ("nodeType" in a)
          return rb({node: a, F: null});
        if (Array.isArray(a))
          return new pb(a.map((c) => {
            if (c === void 0)
              return () => w.empty();
            c = Sb(c);
            c = c === null ? w.empty() : w.m(c);
            return Ra(c);
          }));
        if (a instanceof Date) {
          const c = Jb(a.toISOString());
          return g(c, c.type);
        }
        return new ub(Object.keys(a).filter((c) => a[c] !== void 0).map((c) => {
          var d = Sb(a[c]);
          d = d === null ? w.empty() : w.m(d);
          return {key: g(c, 1), value: Ra(d)};
        }));
    }
    throw Error(`Value ${String(a)} of type "${typeof a}" is not adaptable to an XPath value.`);
  }
  function Tb(a, b) {
    if (typeof a !== "number" && (typeof a !== "string" || !ta.get(b)(a)))
      throw Error(`Cannot convert JavaScript value '${a}' to the XPath type ${Ea[b]} since it is not valid.`);
  }
  function Ub(a, b, c) {
    if (b === null)
      return null;
    switch (a) {
      case 0:
        return b ? va : wa;
      case 1:
        return g(b + "", 1);
      case 3:
      case 2:
        return Tb(b, 3), g(+b, 3);
      case 4:
        return Tb(b, a), g(+b, 4);
      case 5:
        return Tb(b, a), g(b | 0, 5);
      case 6:
        return Tb(b, a), g(+b, 6);
      case 7:
      case 8:
      case 9:
      case 11:
      case 12:
      case 13:
      case 14:
      case 15:
        if (!(b instanceof Date))
          throw Error(`The JavaScript value ${b} with type ${typeof b} is not a valid type to be converted to an XPath ${Ea[a]}.`);
        return g(Lb(Jb(b.toISOString()), a), a);
      case 53:
      case 47:
      case 55:
      case 54:
      case 56:
      case 57:
      case 58:
        if (typeof b !== "object" || !("nodeType" in b))
          throw Error(`The JavaScript value ${b} with type ${typeof b} is not a valid type to be converted to an XPath ${Ea[a]}.`);
        return rb({node: b, F: null});
      case 59:
        return Sb(b);
      case 61:
        return Sb(b);
      default:
        throw Error(`Values of the type "${Ea[a]}" can not be adapted from JavaScript to equivalent XPath values.`);
    }
  }
  function Yb(a, b, c) {
    if (c.g === 0)
      return b = Ub(c.type, b), b === null ? [] : [b];
    if (c.g === 2 || c.g === 1) {
      if (!Array.isArray(b))
        throw Error(`The JavaScript value ${b} should be an array if it is to be converted to ${Ha(c)}.`);
      return b.map((e) => Ub(c.type, e)).filter((e) => e !== null);
    }
    const d = Ub(c.type, b);
    if (d === null)
      throw Error(`The JavaScript value ${b} should be a single entry if it is to be converted to ${Ha(c)}.`);
    return [d];
  }
  function Zb(a, b, c = {type: 59, g: 0}) {
    return w.create(Yb(a, b, c));
  }
  var ac = class {
    constructor() {
      this.h = Math.abs(Math.floor(Math.random() * $b) % $b);
    }
  }, $b = 2 ** 32;
  function bc(a, b, c, d) {
    return new cc({N: c, Fa: b, za: d || a.za, wa: a.wa}, a.h, a.o);
  }
  function dc(a, b) {
    let c = 0;
    const d = b.value;
    return {next: (e) => {
      e = d.next(e);
      return e.done ? p : q(bc(a, c++, e.value, b));
    }};
  }
  function ec(a) {
    a.h.hb || (a.h.hb = true, a.h.ob = Jb(new Date().toISOString()), a.h.tb = Ab("PT0S"));
    return a.h.ob;
  }
  function fc(a) {
    a.h.hb || (a.h.hb = true, a.h.ob = Jb(new Date().toISOString()), a.h.tb = Ab("PT0S"));
    return a.h.tb;
  }
  function gc(a, b = null) {
    a = 29421 * (b !== null && b !== void 0 ? b : a.o.h) % $b;
    return {pb: Math.floor(a), Yb: a / $b};
  }
  function hc(a, b) {
    return new cc({N: a.N, Fa: a.Fa, za: a.za, wa: Object.assign(Object.create(null), a.wa, b)}, a.h, a.o);
  }
  var cc = class {
    constructor(a, b = {ob: null, tb: null, hb: false}, c = new ac()) {
      this.h = b;
      this.Fa = a.Fa;
      this.za = a.za;
      this.N = a.N;
      this.wa = a.wa || Object.create(null);
      this.o = c;
    }
  };
  var ic = class {
    constructor(a, b, c, d, e, f, h, k, l) {
      this.debug = a;
      this.Ga = b;
      this.h = c;
      this.Ia = d;
      this.Ma = e;
      this.o = f;
      this.v = h;
      this.ib = k;
      this.Ua = l;
    }
  };
  function jc(a) {
    let b = 0, c = null, d = true;
    return w.create({next: (e) => {
      for (; b < a.length; ) {
        c || (c = a[b].value, d = true);
        const f = c.next(d ? 0 : e);
        d = false;
        if (f.done)
          b++, c = null;
        else
          return f;
      }
      return p;
    }});
  }
  var kc = (a, b, c) => Error(`FORG0001: Cannot cast ${a} to ${Ea[b]}${c ? `, ${c}` : ""}`), lc = (a) => Error(`XPDY0002: ${a}`), mc = (a) => Error(`XPTY0004: ${a}`), nc = (a) => Error(`FOTY0013: Atomization is not supported for ${Ea[a]}.`), oc = (a) => Error(`XPST0081: The prefix ${a} could not be resolved.`);
  function pc(a, b) {
    if (v(a.type, 46) || v(a.type, 19) || v(a.type, 0) || v(a.type, 4) || v(a.type, 3) || v(a.type, 6) || v(a.type, 5) || v(a.type, 2) || v(a.type, 23) || v(a.type, 1))
      return w.create(a);
    const c = b.h;
    if (v(a.type, 53)) {
      const d = a.value;
      if (d.node.nodeType === 2 || d.node.nodeType === 3)
        return w.create(g(ib(c, d), 19));
      if (d.node.nodeType === 8 || d.node.nodeType === 7)
        return w.create(g(ib(c, d), 1));
      const e = [];
      (function k(h) {
        if (d.node.nodeType !== 8 && d.node.nodeType !== 7) {
          var l = h.nodeType;
          l === 3 || l === 4 ? e.push(c.getData(h)) : l !== 1 && l !== 9 || c.getChildNodes(h).forEach((n) => {
            k(n);
          });
        }
      })(d.node);
      return w.create(g(e.join(""), 19));
    }
    if (v(a.type, 60) && !v(a.type, 62))
      throw nc(a.type);
    if (v(a.type, 62))
      return jc(a.h.map((d) => qc(d(), b)));
    throw Error(`Atomizing ${a.type} is not implemented.`);
  }
  function qc(a, b) {
    let c = false;
    const d = a.value;
    let e = null;
    return w.create({next: () => {
      for (; !c; ) {
        if (!e) {
          var f = d.next(0);
          if (f.done) {
            c = true;
            break;
          }
          e = pc(f.value, b).value;
        }
        f = e.next(0);
        if (f.done)
          e = null;
        else
          return f;
      }
      return p;
    }});
  }
  function rc(a) {
    for (a = ua[a]; a && a.C !== 0; )
      a = a.parent;
    return a ? a.type : null;
  }
  function sc(a, b) {
    b = ua[b];
    const c = b.Ja;
    if (!c || !c.whiteSpace)
      return b.parent ? sc(a, b.parent.type) : a;
    switch (b.Ja.whiteSpace) {
      case "replace":
        return a.replace(/[\u0009\u000A\u000D]/g, " ");
      case "collapse":
        return a.replace(/[\u0009\u000A\u000D]/g, " ").replace(/ {2,}/g, " ").replace(/^ | $/g, "");
    }
    return a;
  }
  function tc(a, b) {
    for (b = ua[b]; b && b.fb === null; ) {
      if (b.C === 2 || b.C === 3)
        return true;
      b = b.parent;
    }
    return b ? b.fb(a) : true;
  }
  function xc(a, b) {
    for (; a; ) {
      if (a.Oa && a.Oa[b])
        return a.Oa[b];
      a = a.parent;
    }
    return () => true;
  }
  function yc(a, b) {
    let c = ua[b];
    for (; c; ) {
      if (c.Ja && !Object.keys(c.Ja).every((d) => {
        if (d === "whiteSpace")
          return true;
        const e = xc(c, d);
        return e ? e(a, c.Ja[d]) : true;
      }))
        return false;
      c = c.parent;
    }
    return true;
  }
  function zc(a) {
    return a ? a.g === 2 || a.g === 0 : true;
  }
  function Ac(a) {
    return a(1) || a(19) ? (b) => ({u: true, value: g(b, 20)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:anyURI or any of its derived types.")});
  }
  function Bc(a) {
    return a(22) ? (b) => {
      let c = "";
      for (let d = 0; d < b.length; d += 2)
        c += String.fromCharCode(parseInt(b.substr(d, 2), 16));
      return {u: true, value: g(btoa(c), 21)};
    } : a(1) || a(19) ? (b) => ({u: true, value: g(b, 21)}) : () => ({error: Error("XPTY0004: Casting not supported from given type to xs:base64Binary or any of its derived types."), u: false});
  }
  function Cc(a) {
    return a(2) ? (b) => ({u: true, value: b === 0 || isNaN(b) ? wa : va}) : a(1) || a(19) ? (b) => {
      switch (b) {
        case "true":
        case "1":
          return {u: true, value: va};
        case "false":
        case "0":
          return {u: true, value: wa};
        default:
          return {u: false, error: Error("XPTY0004: Casting not supported from given type to xs:boolean or any of its derived types.")};
      }
    } : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:boolean or any of its derived types.")});
  }
  function Dc(a) {
    return a(9) ? (b) => ({u: true, value: g(Lb(b, 7), 7)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 7)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:date or any of its derived types.")});
  }
  function Ec(a) {
    return a(7) ? (b) => ({u: true, value: g(Lb(b, 9), 9)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 9)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:dateTime or any of its derived types.")});
  }
  function Fc(a) {
    return a(18) && !a(16) ? (b) => ({u: true, value: g(b.Ea, 17)}) : a(16) ? () => ({u: true, value: g(Ab("PT0.0S"), 17)}) : a(19) || a(1) ? (b) => {
      const c = Ab(b);
      return c ? {u: true, value: g(c, 17)} : {u: false, error: Error(`FORG0001: Can not cast ${b} to xs:dayTimeDuration`)};
    } : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:dayTimeDuration or any of its derived types.")});
  }
  function Gc(a) {
    return a(5) ? (b) => ({u: true, value: g(b, 4)}) : a(6) || a(3) ? (b) => isNaN(b) || !isFinite(b) ? {u: false, error: Error(`FOCA0002: Can not cast ${b} to xs:decimal`)} : Math.abs(b) > Number.MAX_VALUE ? {u: false, error: Error(`FOAR0002: Can not cast ${b} to xs:decimal, it is out of bounds for JavaScript numbers`)} : {u: true, value: g(b, 4)} : a(0) ? (b) => ({u: true, value: g(b ? 1 : 0, 4)}) : a(1) || a(19) ? (b) => {
      const c = parseFloat(b);
      return !isNaN(c) || isFinite(c) ? {u: true, value: g(c, 4)} : {u: false, error: Error(`FORG0001: Can not cast ${b} to xs:decimal`)};
    } : () => ({
      u: false,
      error: Error("XPTY0004: Casting not supported from given type to xs:decimal or any of its derived types.")
    });
  }
  function Hc(a, b) {
    return a(2) ? (c) => ({u: true, value: c}) : a(0) ? (c) => ({u: true, value: c ? 1 : 0}) : a(1) || a(19) ? (c) => {
      switch (c) {
        case "NaN":
          return {u: true, value: NaN};
        case "INF":
        case "+INF":
          return {u: true, value: Infinity};
        case "-INF":
          return {u: true, value: -Infinity};
        case "0":
        case "+0":
          return {u: true, value: 0};
        case "-0":
          return {u: true, value: -0};
      }
      const d = parseFloat(c);
      return isNaN(d) ? {u: false, error: kc(c, b)} : {u: true, value: d};
    } : () => ({u: false, error: Error(`XPTY0004: Casting not supported from given type to ${b} or any of its derived types.`)});
  }
  function Ic(a) {
    const b = Hc(a, 3);
    return (c) => {
      c = b(c);
      return c.u ? {u: true, value: g(c.value, 3)} : c;
    };
  }
  function Jc(a) {
    const b = Math.abs(a.ab());
    a = Math.abs(a.$a());
    return `${b ? `${b}Y` : ""}${a ? `${a}M` : ""}` || "0M";
  }
  var Kc = class extends wb {
    constructor(a) {
      super();
      if (a > Number.MAX_SAFE_INTEGER || a < Number.MIN_SAFE_INTEGER)
        throw Error("FODT0002: Number of months given to construct YearMonthDuration overflows MAX_SAFE_INTEGER or MIN_SAFE_INTEGER");
      this.ea = a;
    }
    $a() {
      const a = this.ea % 12;
      return a === 0 ? 0 : a;
    }
    h() {
      return this.ea;
    }
    ab() {
      return Math.trunc(this.ea / 12);
    }
    na() {
      return Object.is(-0, this.ea) ? false : 0 <= this.ea;
    }
    toString() {
      return (this.na() ? "P" : "-P") + Jc(this);
    }
  }, Lc = (a) => {
    var b = /^(-)?P(\d+Y)?(\d+M)?(\d+D)?(?:T(\d+H)?(\d+M)?(\d+(\.\d*)?S)?)?$/.exec(a);
    if (b) {
      a = !b[1];
      b = 12 * (b[2] ? parseInt(b[2], 10) : 0) + (b[3] ? parseInt(b[3], 10) : 0);
      if (b > Number.MAX_SAFE_INTEGER || !Number.isFinite(b))
        throw Error("FODT0002: Value overflow while constructing xs:yearMonthDuration");
      a = new Kc(a || b === 0 ? b : -b);
    } else
      a = null;
    return a;
  };
  function Mc(a, b) {
    if (isNaN(b))
      throw Error("FOCA0005: Cannot multiply xs:yearMonthDuration by NaN");
    a = Math.round(a.ea * b);
    if (a > Number.MAX_SAFE_INTEGER || !Number.isFinite(a))
      throw Error("FODT0002: Value overflow while constructing xs:yearMonthDuration");
    return new Kc(a < Number.MIN_SAFE_INTEGER || a === 0 ? 0 : a);
  }
  var Nc = class extends wb {
    constructor(a, b) {
      super();
      this.Va = a;
      this.Ea = b;
    }
    Za() {
      return this.Ea.Za();
    }
    getHours() {
      return this.Ea.getHours();
    }
    getMinutes() {
      return this.Ea.getMinutes();
    }
    $a() {
      return this.Va.$a();
    }
    h() {
      return this.Va.h();
    }
    o() {
      return this.Ea.o();
    }
    getSeconds() {
      return this.Ea.getSeconds();
    }
    ab() {
      return this.Va.ab();
    }
    na() {
      return this.Va.na() && this.Ea.na();
    }
    toString() {
      const a = this.na() ? "P" : "-P", b = Jc(this.Va), c = xb(this.Ea);
      return b === "0M" ? a + c : c === "T0S" ? a + b : a + b + c;
    }
  };
  function Oc(a) {
    return a(16) ? (b) => ({u: true, value: g(new Nc(b, new yb(b.na() ? 0 : -0)), 18)}) : a(17) ? (b) => {
      b = new Nc(new Kc(b.na() ? 0 : -0), b);
      return {u: true, value: g(b, 18)};
    } : a(18) ? (b) => ({u: true, value: g(b, 18)}) : a(19) || a(1) ? (b) => {
      var c;
      return c = new Nc(Lc(b), Ab(b)), {u: true, value: g(c, 18)};
    } : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:duration or any of its derived types.")});
  }
  function Pc(a) {
    const b = Hc(a, 6);
    return (c) => {
      c = b(c);
      return c.u ? {u: true, value: g(c.value, 6)} : c;
    };
  }
  function Qc(a) {
    return a(7) || a(9) ? (b) => ({u: true, value: g(Lb(b, 15), 15)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 15)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:gDay or any of its derived types.")});
  }
  function Rc(a) {
    return a(7) || a(9) ? (b) => ({u: true, value: g(Lb(b, 14), 14)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 14)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:gMonth or any of its derived types.")});
  }
  function Sc(a) {
    return a(7) || a(9) ? (b) => ({u: true, value: g(Lb(b, 13), 13)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 13)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:gMonthDay or any of its derived types.")});
  }
  function Tc(a) {
    return a(7) || a(9) ? (b) => ({u: true, value: g(Lb(b, 12), 12)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 12)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:gYear or any of its derived types.")});
  }
  function Uc(a) {
    return a(7) || a(9) ? (b) => ({u: true, value: g(Lb(b, 11), 11)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 11)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:gYearMonth or any of its derived types.")});
  }
  function Vc(a) {
    return a(21) ? (b) => {
      b = atob(b);
      let c = "";
      for (let d = 0, e = b.length; d < e; d++)
        c += Number(b.charCodeAt(d)).toString(16);
      return {u: true, value: g(c.toUpperCase(), 22)};
    } : a(1) || a(19) ? (b) => ({u: true, value: g(b, 22)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:hexBinary or any of its derived types.")});
  }
  function Wc(a) {
    return a(0) ? (b) => ({u: true, value: g(b ? 1 : 0, 5)}) : a(2) ? (b) => {
      const c = Math.trunc(b);
      return !isFinite(c) || isNaN(c) ? {u: false, error: Error(`FOCA0002: can not cast ${b} to xs:integer`)} : Number.isSafeInteger(c) ? {u: true, value: g(c, 5)} : {u: false, error: Error(`FOAR0002: can not cast ${b} to xs:integer, it is out of bounds for JavaScript numbers.`)};
    } : a(1) || a(19) ? (b) => {
      const c = parseInt(b, 10);
      return isNaN(c) ? {u: false, error: kc(b, 5)} : Number.isSafeInteger(c) ? {u: true, value: g(c, 5)} : {u: false, error: Error(`FOCA0003: can not cast ${b} to xs:integer, it is out of bounds for JavaScript numbers.`)};
    } : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:integer or any of its derived types.")});
  }
  const Xc = [3, 6, 4, 5];
  function Yc(a) {
    var b = Zc;
    return (c) => {
      for (const d of Xc) {
        const e = b(a, d)(c);
        if (e.u)
          return e;
      }
      return {u: false, error: Error(`XPTY0004: Casting not supported from "${c}" given type to xs:numeric or any of its derived types.`)};
    };
  }
  function $c(a) {
    if (a(1) || a(19))
      return (b) => ({u: true, value: b + ""});
    if (a(20))
      return (b) => ({u: true, value: b});
    if (a(23))
      return (b) => ({u: true, value: b.prefix ? `${b.prefix}:${b.localName}` : b.localName});
    if (a(44))
      return (b) => ({u: true, value: b.toString()});
    if (a(2)) {
      if (a(5) || a(4))
        return (b) => ({u: true, value: (b + "").replace("e", "E")});
      if (a(6) || a(3))
        return (b) => isNaN(b) ? {u: true, value: "NaN"} : isFinite(b) ? Object.is(b, -0) ? {u: true, value: "-0"} : {u: true, value: (b + "").replace("e", "E").replace("E+", "E")} : {u: true, value: `${0 > b ? "-" : ""}INF`};
    }
    return a(9) || a(7) || a(8) || a(15) || a(14) || a(13) || a(12) || a(11) ? (b) => ({u: true, value: b.toString()}) : a(16) ? (b) => ({u: true, value: b.toString()}) : a(17) ? (b) => ({u: true, value: b.toString()}) : a(18) ? (b) => ({u: true, value: b.toString()}) : a(22) ? (b) => ({u: true, value: b.toUpperCase()}) : (b) => ({u: true, value: b + ""});
  }
  function ad(a) {
    const b = $c(a);
    return (c) => {
      c = b(c);
      return c.u ? {u: true, value: g(c.value, 1)} : c;
    };
  }
  function cd(a) {
    return a(9) ? (b) => ({u: true, value: g(Lb(b, 8), 8)}) : a(19) || a(1) ? (b) => ({u: true, value: g(Jb(b), 8)}) : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:time or any of its derived types.")});
  }
  function dd(a) {
    const b = $c(a);
    return (c) => {
      c = b(c);
      return c.u ? {u: true, value: g(c.value, 19)} : c;
    };
  }
  function ed(a) {
    return a(18) && !a(17) ? (b) => ({u: true, value: g(b.Va, 16)}) : a(17) ? () => ({u: true, value: g(Lc("P0M"), 16)}) : a(19) || a(1) ? (b) => {
      const c = Lc(b);
      return c ? {u: true, value: g(c, 16)} : {u: false, error: kc(b, 16)};
    } : () => ({u: false, error: Error("XPTY0004: Casting not supported from given type to xs:yearMonthDuration or any of its derived types.")});
  }
  const fd = [2, 5, 17, 16];
  function Zc(a, b) {
    const c = (d) => v(a, d);
    if (b === 39)
      return () => ({u: false, error: Error("FORG0001: Casting to xs:error is always invalid.")});
    switch (b) {
      case 19:
        return dd(c);
      case 1:
        return ad(c);
      case 6:
        return Pc(c);
      case 3:
        return Ic(c);
      case 4:
        return Gc(c);
      case 5:
        return Wc(c);
      case 2:
        return Yc(a);
      case 18:
        return Oc(c);
      case 16:
        return ed(c);
      case 17:
        return Fc(c);
      case 9:
        return Ec(c);
      case 8:
        return cd(c);
      case 7:
        return Dc(c);
      case 11:
        return Uc(c);
      case 12:
        return Tc(c);
      case 13:
        return Sc(c);
      case 15:
        return Qc(c);
      case 14:
        return Rc(c);
      case 0:
        return Cc(c);
      case 21:
        return Bc(c);
      case 22:
        return Vc(c);
      case 20:
        return Ac(c);
      case 23:
        throw Error("Casting to xs:QName is not implemented.");
    }
    return () => ({u: false, error: Error(`XPTY0004: Casting not supported from ${a} to ${b}.`)});
  }
  const gd = Object.create(null);
  function hd(a, b) {
    if (a === 19 && b === 1)
      return (f) => ({u: true, value: g(f, 1)});
    if (b === 44)
      return () => ({u: false, error: Error("XPST0080: Casting to xs:NOTATION is not permitted.")});
    if (b === 39)
      return () => ({u: false, error: Error("FORG0001: Casting to xs:error is not permitted.")});
    if (a === 45 || b === 45)
      return () => ({u: false, error: Error("XPST0080: Casting from or to xs:anySimpleType is not permitted.")});
    if (a === 46 || b === 46)
      return () => ({u: false, error: Error("XPST0080: Casting from or to xs:anyAtomicType is not permitted.")});
    if (v(a, 60) && b === 1)
      return () => ({u: false, error: Error("FOTY0014: Casting from function item to xs:string is not permitted.")});
    if (a === b)
      return (f) => ({u: true, value: {type: b, value: f}});
    const c = fd.includes(a) ? a : rc(a), d = fd.includes(b) ? b : rc(b);
    if (d === null || c === null)
      return () => ({u: false, error: Error(`XPST0081: Can not cast: type ${d ? Ea[a] : Ea[b]} is unknown.`)});
    const e = [];
    c !== 1 && c !== 19 || e.push((f) => {
      const h = sc(f, b);
      return tc(h, b) ? {u: true, value: h} : {u: false, error: kc(f, b, "pattern validation failed.")};
    });
    c !== d && (e.push(Zc(c, d)), e.push((f) => ({
      u: true,
      value: f.value
    })));
    d !== 19 && d !== 1 || e.push((f) => tc(f, b) ? {u: true, value: f} : {u: false, error: kc(f, b, "pattern validation failed.")});
    e.push((f) => yc(f, b) ? {u: true, value: f} : {u: false, error: kc(f, b, "pattern validation failed.")});
    e.push((f) => ({u: true, value: {type: b, value: f}}));
    return (f) => {
      f = {u: true, value: f};
      for (let h = 0, k = e.length; h < k && (f = e[h](f.value), f.u !== false); ++h)
        ;
      return f;
    };
  }
  function id(a, b) {
    const c = a.type + 1e4 * b;
    let d = gd[c];
    d || (d = gd[c] = hd(a.type, b));
    return d.call(void 0, a.value, b);
  }
  function jd(a, b) {
    a = id(a, b);
    if (a.u === true)
      return a.value;
    throw a.error;
  }
  function kd(a) {
    let b = false;
    return {next: () => {
      if (b)
        return p;
      b = true;
      return q(a);
    }};
  }
  function ld(a, b) {
    return a === b ? true : a && b && a.offset === b.offset && a.parent === b.parent ? ld(a.F, b.F) : false;
  }
  function md(a, b) {
    return a === b || a.node === b.node && ld(a.F, b.F) ? true : false;
  }
  function nd(a, b, c) {
    var d = x(a, b, null);
    a = hb(a, d, null);
    for (let e = 0, f = a.length; e < f; ++e) {
      d = a[e];
      if (md(d, b))
        return -1;
      if (md(d, c))
        return 1;
    }
  }
  function od(a, b) {
    const c = [];
    for (; b; b = x(a, b, null))
      c.unshift(b);
    return c;
  }
  function pd(a, b) {
    const c = [];
    for (; b; b = a.getParentNode(b, null))
      c.unshift(b);
    return c;
  }
  function qd(a, b, c, d) {
    if (c.F || d.F || cb(c.node) || cb(d.node)) {
      if (md(c, d))
        return 0;
      c = od(b, c);
      d = od(b, d);
      const f = c[0], h = d[0];
      if (!md(f, h))
        return b = a.findIndex((k) => md(k, f)), c = a.findIndex((k) => md(k, h)), b === -1 && (b = a.push(f)), c === -1 && (c = a.push(h)), b - c;
      a = 1;
      for (var e = Math.min(c.length, d.length); a < e && md(c[a], d[a]); ++a)
        ;
      return c[a] ? d[a] ? nd(b, c[a], d[a]) : 1 : -1;
    }
    c = c.node;
    e = d.node;
    if (c === e)
      return 0;
    d = pd(b, c);
    c = pd(b, e);
    if (d[0] !== c[0]) {
      const f = {node: d[0], F: null}, h = {node: c[0], F: null};
      b = a.findIndex((k) => md(k, f));
      c = a.findIndex((k) => md(k, h));
      b === -1 && (b = a.push(f));
      c === -1 && (c = a.push(h));
      return b - c;
    }
    a = 1;
    for (e = Math.min(d.length, c.length); a < e && d[a] === c[a]; ++a)
      ;
    d = d[a];
    e = c[a];
    if (!d)
      return -1;
    if (!e)
      return 1;
    b = b.getChildNodes(c[a - 1], null);
    for (let f = 0, h = b.length; f < h; ++f) {
      a = b[f];
      if (a === d)
        return -1;
      if (a === e)
        return 1;
    }
  }
  function rd(a, b, c, d) {
    const e = v(c.type, 47), f = v(d.type, 47);
    if (e && !f) {
      if (c = x(b, c.value), d = d.value, md(c, d))
        return 1;
    } else if (f && !e) {
      if (c = c.value, d = x(b, d.value), md(c, d))
        return -1;
    } else if (e && f) {
      if (md(x(b, d.value), x(b, c.value)))
        return c.value.node.localName > d.value.node.localName ? 1 : -1;
      c = x(b, c.value);
      d = x(b, d.value);
    } else
      c = c.value, d = d.value;
    return qd(a, b, c, d);
  }
  function sd(a, b, c) {
    return rd(a.o, a, b, c);
  }
  function td(a, b) {
    return ud(b, (c, d) => rd(a.o, a, c, d)).filter((c, d, e) => d === 0 ? true : !md(c.value, e[d - 1].value));
  }
  const vd = (a, b) => a < b ? -1 : 0;
  function ud(a, b = vd) {
    if (1 >= a.length)
      return a;
    var c = Math.floor(a.length / 2);
    const d = ud(a.slice(0, c), b);
    a = ud(a.slice(c), b);
    for (c = []; d.length && a.length; )
      0 > b(d[0], a[0]) ? c.push(d.shift()) : c.push(a.shift());
    return c.concat(d.concat(a));
  }
  var wd = xspattern2;
  function xd(a, b) {
    if (v(a.type, 2)) {
      if (v(a.type, 6))
        return b === 3 ? g(a.value, 3) : null;
      if (v(a.type, 4)) {
        if (b === 6)
          return g(a.value, 6);
        if (b === 3)
          return g(a.value, 3);
      }
      return null;
    }
    return v(a.type, 20) && b === 1 ? g(a.value, 1) : null;
  }
  function yd(a, b, c, d, e) {
    if (v(a.type, b.type))
      return a;
    v(b.type, 46) && v(a.type, 53) && (a = pc(a, c).first());
    if (v(a.type, b.type) || b.type === 46)
      return a;
    if (v(a.type, 19)) {
      c = jd(a, b.type);
      if (!c)
        throw Error(`XPTY0004 Unable to convert ${e ? "return" : "argument"} of type ${Ea[a.type]} to type ${Ha(b)} while calling ${d}`);
      return c;
    }
    c = xd(a, b.type);
    if (!c)
      throw Error(`XPTY0004 Unable to cast ${e ? "return" : "argument"} of type ${Ea[a.type]} to type ${Ha(b)} while calling ${d}`);
    return c;
  }
  function zd(a) {
    switch (a) {
      case 2:
        return "*";
      case 1:
        return "+";
      case 0:
        return "?";
      case 3:
        return "";
    }
  }
  var Ad = (a, b, c, d, e) => a.g === 0 ? b.Y({default: () => b.map((f) => yd(f, a, c, d, e)), multiple: () => {
    throw Error(`XPTY0004: Multiplicity of ${e ? "function return value" : "function argument"} of type ${Ea[a.type]}${zd(a.g)} for ${d} is incorrect. Expected "?", but got "+".`);
  }}) : a.g === 1 ? b.Y({empty: () => {
    throw Error(`XPTY0004: Multiplicity of ${e ? "function return value" : "function argument"} of type ${Ea[a.type]}${zd(a.g)} for ${d} is incorrect. Expected "+", but got "empty-sequence()"`);
  }, default: () => b.map((f) => yd(f, a, c, d, e))}) : a.g === 2 ? b.map((f) => yd(f, a, c, d, e)) : b.Y({m: () => b.map((f) => yd(f, a, c, d, e)), default: () => {
    throw Error(`XPTY0004: Multiplicity of ${e ? "function return value" : "function argument"} of type ${Ea[a.type]}${zd(a.g)} for ${d} is incorrect. Expected exactly one`);
  }});
  function Bd(a, b) {
    return v(a, 5) ? g(b, 5) : v(a, 6) ? g(b, 6) : v(a, 3) ? g(b, 3) : g(b, 4);
  }
  const Cd = [{la: "M", ja: 1e3}, {la: "CM", ja: 900}, {la: "D", ja: 500}, {la: "CD", ja: 400}, {la: "C", ja: 100}, {la: "XC", ja: 90}, {la: "L", ja: 50}, {la: "XL", ja: 40}, {la: "X", ja: 10}, {la: "IX", ja: 9}, {la: "V", ja: 5}, {la: "IV", ja: 4}, {la: "I", ja: 1}];
  function Dd(a, b) {
    let c = parseInt(a, 10);
    a = 0 > c;
    c = Math.abs(c);
    if (!c)
      return "-";
    let d = Cd.reduce((e, f) => {
      const h = Math.floor(c / f.ja);
      c -= h * f.ja;
      return e + f.la.repeat(h);
    }, "");
    b && (d = d.toLowerCase());
    a && (d = `-${d}`);
    return d;
  }
  const Ed = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  function Fd(a, b) {
    a = parseInt(a, 10);
    const c = 0 > a;
    a = Math.abs(a);
    if (!a)
      return "-";
    let d = "", e;
    for (; 0 < a; )
      e = (a - 1) % Ed.length, d = Ed[e] + d, a = (a - e) / Ed.length | 0;
    b && (d = d.toLowerCase());
    c && (d = `-${d}`);
    return d;
  }
  function Gd(a) {
    if (Math.floor(a) === a || isNaN(a))
      return 0;
    a = /\d+(?:\.(\d*))?(?:[Ee](-)?(\d+))*/.exec(`${a}`);
    const b = a[1] ? a[1].length : 0;
    if (a[3]) {
      if (a[2])
        return b + parseInt(a[3], 10);
      a = b - parseInt(a[3], 10);
      return 0 > a ? 0 : a;
    }
    return b;
  }
  function Hd(a, b, c) {
    return b && a * c % 1 % 0.5 === 0 ? Math.floor(a * c) % 2 === 0 ? Math.floor(a * c) / c : Math.ceil(a * c) / c : Math.round(a * c) / c;
  }
  function Id(a, b, c, d, e, f) {
    let h = false;
    return w.create({next: () => {
      if (h)
        return p;
      const k = e.first();
      if (!k)
        return h = true, p;
      if ((v(k.type, 6) || v(k.type, 3)) && (k.value === 0 || isNaN(k.value) || k.value === Infinity || k.value === -Infinity))
        return h = true, q(k);
      var l;
      f ? l = f.first().value : l = 0;
      h = true;
      if (Gd(k.value) < l)
        return q(k);
      const n = [5, 4, 3, 6].find((u) => v(k.type, u)), t = jd(k, 4);
      l = Hd(t.value, a, Math.pow(10, l));
      switch (n) {
        case 4:
          return q(g(l, 4));
        case 3:
          return q(g(l, 3));
        case 6:
          return q(g(l, 6));
        case 5:
          return q(g(l, 5));
      }
    }});
  }
  const Jd = (a, b, c, d) => qc(d, b).Y({empty: () => w.m(g(NaN, 3)), m: () => {
    const e = id(d.first(), 3);
    return e.u ? w.m(e.value) : w.m(g(NaN, 3));
  }, multiple: () => {
    throw Error("fn:number may only be called with zero or one values");
  }});
  function Kd(a) {
    let b = 5381;
    for (let c = 0; c < a.length; ++c)
      b = 33 * b + a.charCodeAt(c), b %= Number.MAX_SAFE_INTEGER;
    return b;
  }
  const Ld = (a, b, c, d = w.empty()) => {
    function e(f) {
      const h = (k, l, n, t) => {
        if (t.G() || t.sa())
          return t;
        k = t.O();
        l = f;
        for (n = k.length - 1; 1 < n; n--) {
          l = gc(a, l).pb;
          t = l % n;
          const u = k[t];
          k[t] = k[n];
          k[n] = u;
        }
        return w.create(k);
      };
      return w.m(new ub([{key: g("number", 1), value: () => w.m(g(gc(a, f).Yb, 3))}, {key: g("next", 1), value: () => w.m(new Va({value: () => e(gc(a, f).pb), Xa: true, localName: "", namespaceURI: "", j: [], arity: 0, i: {type: 61, g: 3}}))}, {key: g("permute", 1), value: () => w.m(new Va({
        value: h,
        Xa: true,
        localName: "",
        namespaceURI: "",
        j: [{type: 59, g: 2}],
        arity: 1,
        i: {type: 59, g: 2}
      }))}]));
    }
    b = d.G() ? gc(a) : gc(a, Kd(jd(d.first(), 1).value));
    return e(b.pb);
  };
  var Md = [
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "abs", j: [{type: 2, g: 0}], i: {type: 2, g: 0}, callFunction: (a, b, c, d) => d.map((e) => Bd(e.type, Math.abs(e.value)))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "format-integer", j: [{type: 5, g: 0}, {type: 1, g: 3}], i: {type: 1, g: 3}, callFunction: (a, b, c, d, e) => {
      a = d.first();
      e = e.first();
      if (d.G())
        return w.m(g("", 1));
      switch (e.value) {
        case "I":
          return d = Dd(a.value), w.m(g(d, 1));
        case "i":
          return d = Dd(a.value, true), w.m(g(d, 1));
        case "A":
          return w.m(g(Fd(a.value), 1));
        case "a":
          return w.m(g(Fd(a.value, true), 1));
        default:
          throw Error(`Picture: ${e.value} is not implemented yet. The supported picture strings are "A", "a", "I", and "i"`);
      }
    }},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "ceiling", j: [{type: 2, g: 0}], i: {type: 2, g: 0}, callFunction: (a, b, c, d) => d.map((e) => Bd(e.type, Math.ceil(e.value)))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "floor", j: [{type: 2, g: 0}], i: {type: 2, g: 0}, callFunction: (a, b, c, d) => d.map((e) => Bd(e.type, Math.floor(e.value)))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "round", j: [{type: 2, g: 0}], i: {type: 2, g: 0}, callFunction: Id.bind(null, false)},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "round", j: [{type: 2, g: 0}, {type: 5, g: 3}], i: {type: 2, g: 0}, callFunction: Id.bind(null, false)},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "round-half-to-even", j: [{type: 2, g: 0}], i: {type: 2, g: 0}, callFunction: Id.bind(null, true)},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions",
      localName: "round-half-to-even",
      j: [{type: 2, g: 0}, {type: 5, g: 3}],
      i: {type: 2, g: 0},
      callFunction: Id.bind(null, true)
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "number", j: [{type: 46, g: 0}], i: {type: 3, g: 3}, callFunction: Jd},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "number", j: [], i: {type: 3, g: 3}, callFunction: (a, b, c) => {
      const d = a.N && Ad({type: 46, g: 0}, w.m(a.N), b, "fn:number", false);
      if (!d)
        throw lc("fn:number needs an atomizable context item.");
      return Jd(a, b, c, d);
    }},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions",
      localName: "random-number-generator",
      j: [],
      i: {type: 61, g: 3},
      callFunction: Ld
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "random-number-generator", j: [{type: 46, g: 0}], i: {type: 61, g: 3}, callFunction: Ld}
  ];
  function Nd() {
    throw Error("FOCH0002: No collations are supported");
  }
  function Od(a, b, c, d) {
    if (b.N === null)
      throw lc("The function which was called depends on dynamic context, which is absent.");
    return a(b, c, d, w.m(b.N));
  }
  const Pd = (a, b, c, d) => d.Y({empty: () => w.m(g("", 1)), default: () => d.map((e) => {
    if (v(e.type, 53)) {
      const f = pc(e, b).first();
      return v(e.type, 47) ? jd(f, 1) : f;
    }
    return jd(e, 1);
  })}), Qd = (a, b, c, d, e) => A([e], ([f]) => qc(d, b).M((h) => {
    h = h.map((k) => jd(k, 1).value).join(f.value);
    return w.m(g(h, 1));
  })), Rd = (a, b, c, d) => {
    if (d.G())
      return w.m(g(0, 5));
    a = d.first().value;
    return w.m(g(Array.from(a).length, 5));
  }, Sd = (a, b, c, d, e, f) => {
    const h = Id(false, a, b, c, e, null), k = f !== null ? Id(false, a, b, c, f, null) : null;
    let l = false, n = null, t = null, u = null;
    return w.create({next: () => {
      if (l)
        return p;
      if (!n && (n = d.first(), n === null))
        return l = true, q(g("", 1));
      t || (t = h.first());
      !u && f && (u = null, u = k.first());
      l = true;
      return q(g(Array.from(n.value).slice(Math.max(t.value - 1, 0), f ? t.value + u.value - 1 : void 0).join(""), 1));
    }});
  }, Ud = (a, b, c, d, e) => {
    if (d.G() || d.first().value.length === 0)
      return w.empty();
    a = d.first().value;
    e = e.first().value;
    e = Td(e);
    return w.create(a.split(e).map((f) => g(f, 1)));
  }, Vd = (a, b, c, d) => {
    if (d.G())
      return w.m(g("", 1));
    a = d.first().value.trim();
    return w.m(g(a.replace(/\s+/g, " "), 1));
  }, Wd = new Map(), Xd = new Map();
  function Td(a) {
    if (Xd.has(a))
      return Xd.get(a);
    let b;
    try {
      b = new RegExp(a, "g");
    } catch (c) {
      throw Error(`FORX0002: ${c}`);
    }
    if (b.test(""))
      throw Error(`FORX0003: the pattern ${a} matches the zero length string`);
    Xd.set(a, b);
    return b;
  }
  var Yd = [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "compare", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 5, g: 0}, callFunction: (a, b, c, d, e) => {
    if (d.G() || e.G())
      return w.empty();
    a = d.first().value;
    e = e.first().value;
    return a > e ? w.m(g(1, 5)) : a < e ? w.m(g(-1, 5)) : w.m(g(0, 5));
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "compare", j: [{type: 1, g: 0}, {type: 1, g: 0}, {type: 1, g: 3}], i: {type: 5, g: 0}, callFunction: Nd}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "concat",
    j: [{type: 46, g: 0}, {type: 46, g: 0}, 4],
    i: {type: 1, g: 3},
    callFunction: (a, b, c, ...d) => {
      d = d.map((e) => qc(e, b).M((f) => w.m(g(f.map((h) => h === null ? "" : jd(h, 1).value).join(""), 1))));
      return A(d, (e) => w.m(g(e.map((f) => f.value).join(""), 1)));
    }
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "contains", j: [{type: 1, g: 0}, {type: 1, g: 0}, {type: 1, g: 0}], i: {type: 0, g: 3}, callFunction: Nd}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "contains", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 0, g: 3}, callFunction: (a, b, c, d, e) => {
    a = d.G() ? "" : d.first().value;
    e = e.G() ? "" : e.first().value;
    return e.length === 0 ? w.aa() : a.length === 0 ? w.V() : a.includes(e) ? w.aa() : w.V();
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "ends-with", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 0, g: 3}, callFunction: (a, b, c, d, e) => {
    a = e.G() ? "" : e.first().value;
    if (a.length === 0)
      return w.aa();
    d = d.G() ? "" : d.first().value;
    return d.length === 0 ? w.V() : d.endsWith(a) ? w.aa() : w.V();
  }}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "ends-with",
    j: [{type: 1, g: 0}, {type: 1, g: 0}, {type: 1, g: 3}],
    i: {type: 0, g: 3},
    callFunction: Nd
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "normalize-space", j: [{type: 1, g: 0}], i: {type: 1, g: 3}, callFunction: Vd}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "normalize-space", j: [], i: {type: 1, g: 3}, callFunction: Od.bind(null, (a, b, c, d) => Vd(a, b, c, Pd(a, b, c, d)))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "starts-with", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 0, g: 3}, callFunction: (a, b, c, d, e) => {
    a = e.G() ? "" : e.first().value;
    if (a.length === 0)
      return w.aa();
    d = d.G() ? "" : d.first().value;
    return d.length === 0 ? w.V() : d.startsWith(a) ? w.aa() : w.V();
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "starts-with", j: [{type: 1, g: 0}, {type: 1, g: 0}, {type: 1, g: 3}], i: {type: 0, g: 3}, callFunction: Nd}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "string", j: [{type: 59, g: 0}], i: {type: 1, g: 3}, callFunction: Pd}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "string",
    j: [],
    i: {type: 1, g: 3},
    callFunction: Od.bind(null, Pd)
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "substring-before", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 1, g: 3}, callFunction: (a, b, c, d, e) => {
    a = d.G() ? "" : d.first().value;
    e = e.G() ? "" : e.first().value;
    if (e === "")
      return w.m(g("", 1));
    e = a.indexOf(e);
    return e === -1 ? w.m(g("", 1)) : w.m(g(a.substring(0, e), 1));
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "substring-after", j: [{type: 1, g: 0}, {type: 1, g: 0}], i: {type: 1, g: 3}, callFunction: (a, b, c, d, e) => {
    a = d.G() ? "" : d.first().value;
    e = e.G() ? "" : e.first().value;
    if (e === "")
      return w.m(g(a, 1));
    b = a.indexOf(e);
    return b === -1 ? w.m(g("", 1)) : w.m(g(a.substring(b + e.length), 1));
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "substring", j: [{type: 1, g: 0}, {type: 3, g: 3}], i: {type: 1, g: 3}, callFunction: Sd}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "substring", j: [{type: 1, g: 0}, {type: 3, g: 3}, {type: 3, g: 3}], i: {type: 1, g: 3}, callFunction: Sd}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "upper-case",
    j: [{type: 1, g: 0}],
    i: {type: 1, g: 3},
    callFunction: (a, b, c, d) => d.G() ? w.m(g("", 1)) : d.map((e) => g(e.value.toUpperCase(), 1))
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "lower-case", j: [{type: 1, g: 0}], i: {type: 1, g: 3}, callFunction: (a, b, c, d) => d.G() ? w.m(g("", 1)) : d.map((e) => g(e.value.toLowerCase(), 1))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "string-join", j: [{type: 46, g: 2}, {type: 1, g: 3}], i: {type: 1, g: 3}, callFunction: Qd}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "string-join",
    j: [{type: 46, g: 2}],
    i: {type: 1, g: 3},
    callFunction(a, b, c, d) {
      return Qd(a, b, c, d, w.m(g("", 1)));
    }
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "string-length", j: [{type: 1, g: 0}], i: {type: 5, g: 3}, callFunction: Rd}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "string-length", j: [], i: {type: 5, g: 3}, callFunction: Od.bind(null, (a, b, c, d) => Rd(a, b, c, Pd(a, b, c, d)))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "tokenize", j: [{type: 1, g: 0}, {
    type: 1,
    g: 3
  }, {type: 1, g: 3}], i: {type: 1, g: 2}, callFunction() {
    throw Error("Not implemented: Using flags in tokenize is not supported");
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "tokenize", j: [{type: 1, g: 0}, {type: 1, g: 3}], i: {type: 1, g: 2}, callFunction: Ud}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "tokenize", j: [{type: 1, g: 0}], i: {type: 1, g: 2}, callFunction(a, b, c, d) {
    return Ud(a, b, c, Vd(a, b, c, d), w.m(g(" ", 1)));
  }}, {j: [{type: 1, g: 0}, {type: 1, g: 3}, {type: 1, g: 3}], callFunction: (a, b, c, d, e, f) => A([d, e, f], ([h, k, l]) => {
    h = Array.from(h ? h.value : "");
    const n = Array.from(k.value), t = Array.from(l.value);
    k = h.map((u) => {
      if (n.includes(u)) {
        if (u = n.indexOf(u), u <= t.length)
          return t[u];
      } else
        return u;
    });
    return w.m(g(k.join(""), 1));
  }), localName: "translate", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [{type: 5, g: 2}], callFunction: (a, b, c, d) => d.M((e) => {
    e = e.map((f) => {
      f = f.value;
      if (f === 9 || f === 10 || f === 13 || 32 <= f && 55295 >= f || 57344 <= f && 65533 >= f || 65536 <= f && 1114111 >= f)
        return String.fromCodePoint(f);
      throw Error("FOCH0001");
    }).join("");
    return w.m(g(e, 1));
  }), localName: "codepoints-to-string", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [{type: 1, g: 0}], callFunction: (a, b, c, d) => A([d], ([e]) => {
    e = e ? e.value.split("") : [];
    return e.length === 0 ? w.empty() : w.create(e.map((f) => g(f.codePointAt(0), 5)));
  }), localName: "string-to-codepoints", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 5, g: 2}}, {j: [{type: 1, g: 0}], callFunction: (a, b, c, d) => A([d], ([e]) => e === null || e.value.length === 0 ? w.create(g("", 1)) : w.create(g(encodeURIComponent(e.value).replace(/[!'()*]/g, (f) => "%" + f.charCodeAt(0).toString(16).toUpperCase()), 1))), localName: "encode-for-uri", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {
    j: [{type: 1, g: 0}],
    callFunction: (a, b, c, d) => A([d], ([e]) => e === null || e.value.length === 0 ? w.create(g("", 1)) : w.create(g(e.value.replace(/([\u00A0-\uD7FF\uE000-\uFDCF\uFDF0-\uFFEF "<>{}|\\^`/\n\u007f\u0080-\u009f]|[\uD800-\uDBFF][\uDC00-\uDFFF])/g, (f) => encodeURI(f)), 1))),
    localName: "iri-to-uri",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 1, g: 3}
  }, {j: [{type: 1, g: 0}, {type: 1, g: 0}], callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
    if (f === null || h === null)
      return w.empty();
    f = f.value;
    var k = h.value;
    if (f.length !== k.length)
      return w.V();
    h = f.split("");
    f = k.split("");
    for (k = 0; k < h.length; k++)
      if (h[k].codePointAt(0) !== f[k].codePointAt(0))
        return w.V();
    return w.aa();
  }), localName: "codepoint-equal", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 0}}, {j: [{type: 1, g: 0}, {type: 1, g: 3}], callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
    f = f ? f.value : "";
    h = h.value;
    let k = Wd.get(h);
    if (!k) {
      try {
        k = (0, wd.compile)(h, {language: "xpath"});
      } catch (l) {
        throw Error(`FORX0002: ${l}`);
      }
      Wd.set(h, k);
    }
    return k(f) ? w.aa() : w.V();
  }), localName: "matches", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 3}}, {j: [{type: 1, g: 0}, {type: 1, g: 3}, {type: 1, g: 3}], callFunction: (a, b, c, d, e, f) => A([d, e, f], ([h, k, l]) => {
    h = h ? h.value : "";
    k = k.value;
    l = l.value;
    if (l.includes("$0"))
      throw Error("Using $0 in fn:replace to replace substrings with full matches is not supported.");
    l = l.split(/((?:\$\$)|(?:\\\$)|(?:\\\\))/).map((n) => {
      switch (n) {
        case "\\$":
          return "$$";
        case "\\\\":
          return "\\";
        case "$$":
          throw Error('FORX0004: invalid replacement: "$$"');
        default:
          return n;
      }
    }).join("");
    k = Td(k);
    h = h.replace(k, l);
    return w.m(g(h, 1));
  }), localName: "replace", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [{type: 1, g: 0}, {type: 1, g: 3}, {type: 1, g: 3}, {type: 1, g: 3}], localName: "replace", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}, callFunction() {
    throw Error("Not implemented: Using flags in replace is not supported");
  }}];
  function Zd(a, b, c, d, e) {
    if (c.N === null)
      throw lc(`The function ${a} depends on dynamic context, which is absent.`);
    return b(c, d, e, w.m(c.N));
  }
  const $d = (a, b, c, d) => A([d], ([e]) => {
    if (e === null)
      return w.empty();
    e = e.value;
    switch (e.node.nodeType) {
      case 1:
      case 2:
        return w.m(g(new Ta(e.node.prefix, e.node.namespaceURI, e.node.localName), 23));
      case 7:
        return w.m(g(new Ta("", "", e.node.target), 23));
      default:
        return w.empty();
    }
  }), ae = (a, b, c, d) => d.Y({default: () => Pd(a, b, c, $d(a, b, c, d)), empty: () => w.m(g("", 1))}), ce = (a, b, c, d) => qc(d, b), de = (a, b, c, d) => A([d], ([e]) => {
    e = e ? e.value : null;
    return e !== null && jb(b.h, e, null) ? w.aa() : w.V();
  }), ee = (a, b, c, d) => A([d], ([e]) => {
    function f(n) {
      let t = 0, u = n;
      for (; u !== null; )
        (n.node.nodeType !== u.node.nodeType ? 0 : u.node.nodeType === 1 ? u.node.localName === n.node.localName && u.node.namespaceURI === n.node.namespaceURI : u.node.nodeType === 7 ? u.node.target === n.node.target : 1) && t++, u = mb(h, u, null);
      return t;
    }
    if (e === null)
      return w.empty();
    const h = b.h;
    let k = "";
    for (e = e.value; x(b.h, e, null) !== null; e = x(b.h, e, null))
      switch (e.node.nodeType) {
        case 1:
          var l = e;
          k = `/Q{${l.node.namespaceURI || ""}}${l.node.localName}[${f(l)}]${k}`;
          break;
        case 2:
          l = e;
          k = `/@${l.node.namespaceURI ? `Q{${l.node.namespaceURI}}` : ""}${l.node.localName}${k}`;
          break;
        case 3:
          k = `/text()[${f(e)}]${k}`;
          break;
        case 7:
          l = e;
          k = `/processing-instruction(${l.node.target})[${f(l)}]${k}`;
          break;
        case 8:
          k = `/comment()[${f(e)}]${k}`;
      }
    return e.node.nodeType === 9 ? w.create(g(k || "/", 1)) : w.create(g("Q{http://www.w3.org/2005/xpath-functions}root()" + k, 1));
  }), fe = (a, b, c, d) => d.map((e) => g(e.value.node.namespaceURI || "", 20)), ge = (a, b, c, d) => d.Y({default: () => d.map((e) => e.value.node.nodeType === 7 ? g(e.value.node.target, 1) : g(e.value.node.localName || "", 1)), empty: () => w.m(g("", 1))});
  function he(a, b, c) {
    if (b.node.nodeType === 2)
      return md(b, c);
    for (; c; ) {
      if (md(b, c))
        return true;
      if (c.node.nodeType === 9)
        break;
      c = x(a, c, null);
    }
    return false;
  }
  const ie = (a, b, c, d) => d.map((e) => {
    if (!v(e.type, 53))
      throw Error("XPTY0004 Argument passed to fn:root() should be of the type node()");
    let f;
    for (e = e.value; e; )
      f = e, e = x(b.h, f, null);
    return rb(f);
  });
  var je = [{j: [{type: 53, g: 0}], callFunction: ae, localName: "name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [], callFunction: Zd.bind(null, "name", ae), localName: "name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [{type: 53, g: 3}], callFunction: fe, localName: "namespace-uri", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 20, g: 3}}, {
    j: [],
    callFunction: Zd.bind(null, "namespace-uri", fe),
    localName: "namespace-uri",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 20, g: 3}
  }, {j: [{type: 53, g: 2}], callFunction: (a, b, c, d) => d.M((e) => {
    if (!e.length)
      return w.empty();
    e = td(b.h, e).reduceRight((f, h, k, l) => {
      if (k === l.length - 1)
        return f.push(h), f;
      if (he(b.h, h.value, f[0].value))
        return f;
      f.unshift(h);
      return f;
    }, []);
    return w.create(e);
  }), localName: "innermost", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 53, g: 2}}, {j: [{type: 53, g: 2}], callFunction: (a, b, c, d) => d.M((e) => {
    if (!e.length)
      return w.empty();
    e = td(b.h, e).reduce((f, h, k) => {
      if (k === 0)
        return f.push(h), f;
      if (he(b.h, f[f.length - 1].value, h.value))
        return f;
      f.push(h);
      return f;
    }, []);
    return w.create(e);
  }, 1), localName: "outermost", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 53, g: 2}}, {j: [{type: 53, g: 0}], callFunction: de, localName: "has-children", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 3}}, {j: [], callFunction: Zd.bind(null, "has-children", de), localName: "has-children", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 3}}, {
    j: [{type: 53, g: 0}],
    callFunction: ee,
    localName: "path",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 1, g: 0}
  }, {j: [], callFunction: Zd.bind(null, "path", ee), localName: "path", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 0}}, {j: [{type: 53, g: 0}], callFunction: $d, localName: "node-name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 23, g: 0}}, {j: [], callFunction: Zd.bind(null, "node-name", $d), localName: "node-name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 23, g: 0}}, {
    j: [{type: 53, g: 0}],
    callFunction: ge,
    localName: "local-name",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 1, g: 3}
  }, {j: [], callFunction: Zd.bind(null, "local-name", ge), localName: "local-name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}, {j: [{type: 53, g: 0}], callFunction: ie, localName: "root", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 53, g: 0}}, {j: [], callFunction: Zd.bind(null, "root", ie), localName: "root", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 53, g: 0}}, {
    j: [],
    callFunction: Zd.bind(null, "data", ce),
    localName: "data",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 46, g: 2}
  }, {j: [{type: 59, g: 2}], callFunction: ce, localName: "data", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 2}}];
  function ke(a, b) {
    let c = 0;
    const d = a.length;
    let e = false, f = null;
    return {next: () => {
      if (!e) {
        for (; c < d; ) {
          f || (f = b(a[c], c, a));
          const h = f.next(0);
          f = null;
          if (h.value)
            c++;
          else
            return q(false);
        }
        e = true;
        return q(true);
      }
      return p;
    }};
  }
  function le(a) {
    a = a.node.nodeType;
    return a === 1 || a === 3;
  }
  function me(a, b) {
    if ((v(a.type, 4) || v(a.type, 6)) && (v(b.type, 4) || v(b.type, 6))) {
      var c = jd(a, 6), d = jd(b, 6);
      return c.value === d.value || isNaN(a.value) && isNaN(b.value);
    }
    return (v(a.type, 4) || v(a.type, 6) || v(a.type, 3)) && (v(b.type, 4) || v(b.type, 6) || v(b.type, 3)) ? (c = jd(a, 3), d = jd(b, 3), c.value === d.value || isNaN(a.value) && isNaN(b.value)) : v(a.type, 23) && v(b.type, 23) ? a.value.namespaceURI === b.value.namespaceURI && a.value.localName === b.value.localName : (v(a.type, 9) || v(a.type, 7) || v(a.type, 8) || v(a.type, 11) || v(a.type, 12) || v(a.type, 13) || v(a.type, 14) || v(a.type, 15)) && (v(b.type, 9) || v(b.type, 7) || v(b.type, 8) || v(b.type, 11) || v(b.type, 12) || v(b.type, 13) || v(b.type, 14) || v(b.type, 15)) ? Ob(a.value, b.value) : (v(a.type, 16) || v(a.type, 17) || v(a.type, 18)) && (v(b.type, 16) || v(b.type, 17) || v(b.type, 17)) ? vb(a.value, b.value) : a.value === b.value;
  }
  function ne(a, b, c) {
    const [d, e] = [b, c].map((f) => ({type: 1, value: f.reduce((h, k) => h += pc(k, a).first().value, "")}));
    return q(me(d, e));
  }
  function oe(a, b, c, d) {
    for (; a.value && v(a.value.type, 56); ) {
      b.push(a.value);
      const e = lb(d, a.value.value);
      a = c.next(0);
      if (e && e.node.nodeType !== 3)
        break;
    }
    return a;
  }
  function pe(a, b, c, d, e) {
    const f = b.h, h = d.value, k = e.value;
    let l = null, n = null, t = null, u;
    const y = [], z = [];
    return {next: () => {
      for (; !u; )
        if (l || (l = h.next(0)), l = oe(l, y, h, f), n || (n = k.next(0)), n = oe(n, z, k, f), y.length || z.length) {
          var F = ne(b, y, z);
          y.length = 0;
          z.length = 0;
          if (F.value === false)
            return u = true, F;
        } else {
          if (l.done || n.done)
            return u = true, q(l.done === n.done);
          t || (t = qe(a, b, c, l.value, n.value));
          F = t.next(0);
          t = null;
          if (F.value === false)
            return u = true, F;
          n = l = null;
        }
      return p;
    }};
  }
  function re(a, b, c, d, e) {
    return d.h.length !== e.h.length ? kd(false) : ke(d.h, (f) => {
      const h = e.h.find((k) => me(k.key, f.key));
      return h ? pe(a, b, c, f.value(), h.value()) : kd(false);
    });
  }
  function se(a, b, c, d, e) {
    return d.h.length !== e.h.length ? kd(false) : ke(d.h, (f, h) => {
      h = e.h[h];
      return pe(a, b, c, f(), h());
    });
  }
  function te(a, b, c, d, e) {
    d = hb(b.h, d.value);
    e = hb(b.h, e.value);
    d = d.filter((f) => le(f));
    e = e.filter((f) => le(f));
    d = w.create(d.map((f) => rb(f)));
    e = w.create(e.map((f) => rb(f)));
    return pe(a, b, c, d, e);
  }
  function ue(a, b, c, d, e) {
    const f = pe(a, b, c, $d(a, b, c, w.m(d)), $d(a, b, c, w.m(e))), h = te(a, b, c, d, e);
    d = fb(b.h, d.value).filter((n) => n.node.namespaceURI !== "http://www.w3.org/2000/xmlns/").sort((n, t) => n.node.nodeName > t.node.nodeName ? 1 : -1).map((n) => rb(n));
    e = fb(b.h, e.value).filter((n) => n.node.namespaceURI !== "http://www.w3.org/2000/xmlns/").sort((n, t) => n.node.nodeName > t.node.nodeName ? 1 : -1).map((n) => rb(n));
    const k = pe(a, b, c, w.create(d), w.create(e));
    let l = false;
    return {next: () => {
      if (l)
        return p;
      var n = f.next(0);
      if (!n.done && n.value === false)
        return l = true, n;
      n = k.next(0);
      if (!n.done && n.value === false)
        return l = true, n;
      n = h.next(0);
      l = true;
      return n;
    }};
  }
  function ve(a, b, c, d, e) {
    const f = pe(a, b, c, $d(a, b, c, w.m(d)), $d(a, b, c, w.m(e)));
    let h = false;
    return {next: () => {
      if (h)
        return p;
      const k = f.next(0);
      return k.done || k.value !== false ? q(me(pc(d, b).first(), pc(e, b).first())) : (h = true, k);
    }};
  }
  function qe(a, b, c, d, e) {
    if (v(d.type, 46) && v(e.type, 46))
      return kd(me(d, e));
    if (v(d.type, 61) && v(e.type, 61))
      return re(a, b, c, d, e);
    if (v(d.type, 62) && v(e.type, 62))
      return se(a, b, c, d, e);
    if (v(d.type, 53) && v(e.type, 53)) {
      if (v(d.type, 55) && v(e.type, 55))
        return te(a, b, c, d, e);
      if (v(d.type, 54) && v(e.type, 54))
        return ue(a, b, c, d, e);
      if (v(d.type, 47) && v(e.type, 47) || v(d.type, 57) && v(e.type, 57) || v(d.type, 58) && v(e.type, 58))
        return ve(a, b, c, d, e);
    }
    return kd(false);
  }
  var we = (a = "Can not execute an updating expression in a non-updating context.") => Error(`XUST0001: ${a}`), xe = (a) => Error(`XUTY0004: The attribute ${a.name}="${a.value}" follows a node that is not an attribute node.`), ye = () => Error("XUTY0005: The target of a insert expression with into must be a single element or document node."), ze = () => Error("XUTY0006: The target of a insert expression with before or after must be a single element, text, comment, or processing instruction node."), Ae = () => Error("XUTY0008: The target of a replace expression must be a single element, attribute, text, comment, or processing instruction node."), Be = () => Error("XUTY0012: The target of a rename expression must be a single element, attribute, or processing instruction node."), Ce = (a) => Error(`XUDY0017: The target ${a.outerHTML} is used in more than one replace value of expression.`), De = (a) => Error(`XUDY0021: Applying the updates will result in the XDM instance violating constraint: '${a}'`), Ee = (a) => Error(`XUDY0023: The namespace binding ${a} is conflicting.`), Fe = (a) => Error(`XUDY0024: The namespace binding ${a} is conflicting.`), Ge = () => Error("XUDY0027: The target for an insert, replace, or rename expression expression should not be empty.");
  function B(a, b, c) {
    b && b.N !== null ? a.B ? (a.nb === null && (a.nb = Ra(a.h(null, c).gb())), a = a.nb()) : a = a.h(b, c) : a = a.h(b, c);
    return a;
  }
  var D = class {
    constructor(a, b, c = {B: false, W: false, P: "unsorted", subtree: false}, d = false, e) {
      this.o = a;
      this.ia = c.P || "unsorted";
      this.subtree = !!c.subtree;
      this.W = !!c.W;
      this.B = !!c.B;
      this.Ka = b;
      this.J = false;
      this.nb = null;
      this.Nb = d;
      this.type = e;
    }
    D() {
      return null;
    }
    v(a) {
      this.Ka.forEach((b) => b.v(a));
      if (!this.Nb && this.Ka.some((b) => b.J))
        throw we();
    }
  };
  var He = class {
    constructor(a, b) {
      this.I = a;
      this.da = b;
    }
  };
  var Ie = class {
    constructor(a) {
      a && typeof a === "object" && "nodeType" in a && (a = a.ownerDocument || a, typeof a.createElementNS === "function" && typeof a.createProcessingInstruction === "function" && typeof a.createTextNode === "function" && typeof a.createComment === "function" && (this.h = a));
      this.h || (this.h = null);
    }
    createAttributeNS(a, b) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createAttributeNS(a, b);
    }
    createCDATASection(a) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createCDATASection(a);
    }
    createComment(a) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createComment(a);
    }
    createDocument() {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.implementation.createDocument(null, null, null);
    }
    createElementNS(a, b) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createElementNS(a, b);
    }
    createProcessingInstruction(a, b) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createProcessingInstruction(a, b);
    }
    createTextNode(a) {
      if (!this.h)
        throw Error("Please pass a node factory if an XQuery script uses node constructors");
      return this.h.createTextNode(a);
    }
  };
  var Je = (a, b, c, d) => {
    const e = x(c, a).node, f = (a = lb(c, a)) ? a.node : null;
    b.forEach((h) => {
      d.insertBefore(e, h.node, f);
    });
  }, Ke = (a, b, c, d) => {
    const e = x(c, a).node;
    b.forEach((f) => {
      d.insertBefore(e, f.node, a.node);
    });
  }, Le = (a, b, c, d) => {
    const e = (c = jb(c, a)) ? c.node : null;
    b.forEach((f) => {
      d.insertBefore(a.node, f.node, e);
    });
  }, Me = (a, b, c) => {
    b.forEach((d) => {
      c.insertBefore(a.node, d.node, null);
    });
  }, Ne = (a, b, c, d) => {
    b.forEach((e) => {
      const f = e.node.nodeName;
      if (gb(c, a, f))
        throw De(`An attribute ${f} already exists.`);
      d.setAttributeNS(a.node, e.node.namespaceURI, f, ib(c, e));
    });
  }, Pe = (a, b, c, d, e) => {
    d || (d = new Ie(a ? a.node : null));
    let f;
    switch (a.node.nodeType) {
      case 1:
        const h = c.getAllAttributes(a.node), k = c.getChildNodes(a.node), l = d.createElementNS(b.namespaceURI, b.ya());
        f = {node: l, F: null};
        h.forEach((n) => {
          e.setAttributeNS(l, n.namespaceURI, n.nodeName, n.value);
        });
        k.forEach((n) => {
          e.insertBefore(l, n, null);
        });
        break;
      case 2:
        b = d.createAttributeNS(b.namespaceURI, b.ya());
        b.value = ib(c, a);
        f = {node: b, F: null};
        break;
      case 7:
        f = {node: d.createProcessingInstruction(b.ya(), ib(c, a)), F: null};
    }
    if (!x(c, a))
      throw Error("Not supported: renaming detached nodes.");
    Oe(a, [f], c, e);
  }, Qe = (a, b, c, d) => {
    c.getChildNodes(a.node).forEach((e) => d.removeChild(a.node, e));
    b && d.insertBefore(a.node, b.node, null);
  }, Oe = (a, b, c, d) => {
    const e = x(c, a);
    var f = a.node.nodeType;
    if (f === 2) {
      if (b.some((k) => k.node.nodeType !== 2))
        throw Error('Constraint "If $target is an attribute node, $replacement must consist of zero or more attribute nodes." failed.');
      const h = e ? e.node : null;
      d.removeAttributeNS(h, a.node.namespaceURI, a.node.nodeName);
      b.forEach((k) => {
        const l = k.node.nodeName;
        if (gb(c, e, l))
          throw De(`An attribute ${l} already exists.`);
        d.setAttributeNS(h, k.node.namespaceURI, l, ib(c, k));
      });
    }
    if (f === 1 || f === 3 || f === 8 || f === 7) {
      const h = (f = lb(c, a)) ? f.node : null;
      d.removeChild(e.node, a.node);
      b.forEach((k) => {
        d.insertBefore(e.node, k.node, h);
      });
    }
  };
  var Se = (a, b, c, d) => {
    Re(a, b);
    a.filter((e) => ["insertInto", "insertAttributes", "replaceValue", "rename"].indexOf(e.type) !== -1).forEach((e) => {
      switch (e.type) {
        case "insertInto":
          Me(e.target, e.content, d);
          break;
        case "insertAttributes":
          Ne(e.target, e.content, b, d);
          break;
        case "rename":
          Pe(e.target, e.o, b, c, d);
          break;
        case "replaceValue":
          var f = e.target;
          e = e.o;
          if (f.node.nodeType === 2) {
            const h = x(b, f);
            h ? d.setAttributeNS(h.node, f.node.namespaceURI, f.node.nodeName, e) : f.node.value = e;
          } else
            d.setData(f.node, e);
      }
    });
    a.filter((e) => [
      "insertBefore",
      "insertAfter",
      "insertIntoAsFirst",
      "insertIntoAsLast"
    ].indexOf(e.type) !== -1).forEach((e) => {
      switch (e.type) {
        case "insertAfter":
          Je(e.target, e.content, b, d);
          break;
        case "insertBefore":
          Ke(e.target, e.content, b, d);
          break;
        case "insertIntoAsFirst":
          Le(e.target, e.content, b, d);
          break;
        case "insertIntoAsLast":
          Me(e.target, e.content, d);
      }
    });
    a.filter((e) => e.type === "replaceNode").forEach((e) => {
      Oe(e.target, e.o, b, d);
    });
    a.filter((e) => e.type === "replaceElementContent").forEach((e) => {
      Qe(e.target, e.text, b, d);
    });
    a.filter((e) => e.type === "delete").forEach((e) => {
      e = e.target;
      var f = x(b, e);
      (f = f ? f.node : null) && (e.node.nodeType === 2 ? d.removeAttributeNS(f, e.node.namespaceURI, e.node.nodeName) : d.removeChild(f, e.node));
    });
    if (a.some((e) => e.type === "put"))
      throw Error('Not implemented: the execution for pendingUpdate "put" is not yet implemented.');
  };
  const Re = (a, b) => {
    function c(f, h) {
      const k = new Set();
      a.filter((l) => l.type === f).map((l) => l.target).forEach((l) => {
        l = l ? l.node : null;
        k.has(l) && h(l);
        k.add(l);
      });
    }
    c("rename", (f) => {
      throw Error(`XUDY0015: The target ${f.outerHTML} is used in more than one rename expression.`);
    });
    c("replaceNode", (f) => {
      throw Error(`XUDY0016: The target ${f.outerHTML} is used in more than one replace expression.`);
    });
    c("replaceValue", (f) => {
      throw Ce(f);
    });
    c("replaceElementContent", (f) => {
      throw Ce(f);
    });
    const d = new Map(), e = (f) => new Ta(f.node.prefix, f.node.namespaceURI, f.node.localName);
    a.filter((f) => f.type === "replaceNode" && f.target.node.nodeType === 2).forEach((f) => {
      var h = x(b, f.target);
      h = h ? h.node : null;
      const k = d.get(h);
      k ? k.push(...f.o.map(e)) : d.set(h, f.o.map(e));
    });
    a.filter((f) => f.type === "rename" && f.target.node.nodeType === 2).forEach((f) => {
      var h = x(b, f.target);
      if (h) {
        h = h.node;
        var k = d.get(h);
        k ? k.push(f.o) : d.set(h, [f.o]);
      }
    });
    d.forEach((f) => {
      const h = {};
      f.forEach((k) => {
        h[k.prefix] || (h[k.prefix] = k.namespaceURI);
        if (h[k.prefix] !== k.namespaceURI)
          throw Fe(k.namespaceURI);
      });
    });
  };
  var Te = (a, ...b) => a.concat(...b.filter(Boolean));
  function Ue(a) {
    return a.J ? (b, c) => a.s(b, c) : (b, c) => {
      const d = a.h(b, c);
      return {next: () => {
        const e = d.O();
        return q({da: [], I: e});
      }};
    };
  }
  var Ve = class extends D {
    constructor(a, b, c, d) {
      super(a, b, c, true, d);
      this.J = true;
    }
    h() {
      throw we();
    }
  };
  function We(a, b) {
    a = a.next(0);
    b(a.value.da);
    return w.create(a.value.I);
  }
  function Xe(a) {
    a.Ka.some((b) => b.J) && (a.J = true);
  }
  var Ye = class extends Ve {
    constructor(a, b, c, d) {
      super(a, b, c, d);
      this.J = this.Ka.some((e) => e.J);
    }
    h(a, b) {
      return this.A(a, b, this.Ka.map((c) => (d) => c.h(d, b)));
    }
    s(a, b) {
      let c = [];
      const d = this.A(a, b, this.Ka.map((f) => f.J ? (h) => {
        h = f.s(h, b);
        return We(h, (k) => c = Te(c, k));
      } : (h) => f.h(h, b)));
      let e = false;
      return {next: () => {
        if (e)
          return p;
        const f = d.O();
        e = true;
        return q(new He(f, c));
      }};
    }
    v(a) {
      super.v(a);
      Xe(this);
    }
  };
  const Ze = ["external", "attribute", "nodeName", "nodeType", "universal"], $e = Ze.length;
  function af(a, b) {
    for (let c = 0; c < $e; ++c) {
      if (b.h[c] < a.h[c])
        return 1;
      if (b.h[c] > a.h[c])
        return -1;
    }
    return 0;
  }
  var bf = class {
    constructor(a) {
      this.h = Ze.map((b) => a[b] || 0);
      if (Object.keys(a).some((b) => !Ze.includes(b)))
        throw Error("Invalid specificity kind passed");
    }
    add(a) {
      const b = Ze.reduce((c, d, e) => {
        c[d] = this.h[e] + a.h[e];
        return c;
      }, Object.create(null));
      return new bf(b);
    }
  };
  const cf = () => mc("Expected base expression of a function call to evaluate to a sequence of single function item");
  function df(a, b, c, d) {
    const e = [];
    for (let f = 0; f < b.length; ++f) {
      if (b[f] === null) {
        e.push(null);
        continue;
      }
      const h = Ad(a[f], b[f], c, d, false);
      e.push(h);
    }
    return e;
  }
  function ef(a, b) {
    if (!v(a.type, 60))
      throw mc("Expected base expression to evaluate to a function item");
    if (a.v !== b)
      throw cf();
    return a;
  }
  function ff(a, b, c, d, e, f, h) {
    let k = 0;
    e = e.map((l) => l ? null : f[k++](c));
    e = df(a.o, e, d, a.D);
    if (0 <= e.indexOf(null))
      return Ua(a, e);
    b = b.apply(void 0, [c, d, h, ...e]);
    return Ad(a.s, b, d, a.D, true);
  }
  var hf = class extends Ye {
    constructor(a, b, c) {
      super(new bf({external: 1}), [a].concat(b.filter((d) => !!d)), {P: "unsorted", W: false, subtree: false, B: false}, c);
      this.ma = b.length;
      this.S = b.map((d) => d === null);
      this.L = null;
      this.xa = a;
      this.La = b;
    }
    s(a, b) {
      if (!this.l || !this.l.J)
        return super.s(a, b);
      let c = [];
      const d = ff(this.l, (f, h, k, ...l) => We(this.l.value(f, h, k, ...l), (n) => {
        c = Te(c, n);
      }), a, b, this.S, this.La.map((f) => () => f.J ? We(f.s(a, b), (h) => {
        c = Te(c, h);
      }) : B(f, a, b)), this.L);
      let e = false;
      return {next: () => {
        if (e)
          return p;
        const f = d.O();
        e = true;
        return q({
          da: c,
          I: f
        });
      }};
    }
    A(a, b, [c, ...d]) {
      if (this.l)
        return ff(this.l, (f, h, k, ...l) => this.l.value(f, h, k, ...l), a, b, this.S, d, this.L);
      const e = c(a);
      return e.Y({default: () => {
        throw cf();
      }, m: () => e.M(([f]) => {
        f = ef(f, this.ma);
        if (f.J)
          throw Error("XUDY0038: The function returned by the PrimaryExpr of a dynamic function invocation can not be an updating function");
        return ff(f, f.value, a, b, this.S, d, this.L);
      })});
    }
    v(a) {
      this.L = gf(a);
      super.v(a);
      if (this.xa.B) {
        a = B(this.xa, null, null);
        if (!a.sa())
          throw cf();
        this.l = ef(a.first(), this.ma);
        this.l.J && (this.J = true);
      }
    }
  };
  const jf = (a, b, c, d, e, f) => A([d, e, f], ([h, k, l]) => {
    k = k.value;
    l = l.value;
    if (k > h.h.length || 0 >= k)
      throw Error("FOAY0001: subarray start out of bounds.");
    if (0 > l)
      throw Error("FOAY0002: subarray length out of bounds.");
    if (k + l > h.h.length + 1)
      throw Error("FOAY0001: subarray start + length out of bounds.");
    return w.m(new pb(h.h.slice(k - 1, l + k - 1)));
  }), kf = (a, b, c, d, e) => A([d], ([f]) => e.M((h) => {
    h = h.map((l) => l.value).sort((l, n) => n - l).filter((l, n, t) => t[n - 1] !== l);
    const k = f.h.concat();
    for (let l = 0, n = h.length; l < n; ++l) {
      const t = h[l];
      if (t > f.h.length || 0 >= t)
        throw Error("FOAY0001: subarray position out of bounds.");
      k.splice(t - 1, 1);
    }
    return w.m(new pb(k));
  })), lf = (a) => v(a, 1) || v(a, 20) || v(a, 19), mf = (a, b, c, d, e) => d.length === 0 ? e.length !== 0 : e.length !== 0 && qe(a, b, c, d[0], e[0]).next(0).value ? mf(a, b, c, d.slice(1), e.slice(1)) : d[0].value !== d[0].value ? true : lf(d[0].type) && e.length !== 0 && lf(e[0].type) ? d[0].value < e[0].value : e.length === 0 ? false : d[0].value < e[0].value, nf = (a, b, c, d) => {
    d.sort((e, f) => pe(a, b, c, w.create(e), w.create(f)).next(0).value ? 0 : mf(a, b, c, e, f) ? -1 : 1);
    return w.m(new pb(d.map((e) => () => w.create(e))));
  };
  function of(a, b) {
    return v(b.type, 62) ? b.h.reduce((c, d) => d().M((e) => e.reduce(of, c)), a) : jc([a, w.m(b)]);
  }
  var pf = [
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "size", j: [{type: 62, g: 3}], i: {type: 5, g: 3}, callFunction: (a, b, c, d) => A([d], ([e]) => w.m(g(e.h.length, 5)))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "get", j: [{type: 62, g: 3}, {type: 5, g: 3}], i: {type: 59, g: 2}, callFunction: ob},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "put", j: [{type: 62, g: 3}, {type: 5, g: 3}, {type: 59, g: 2}], i: {type: 62, g: 3}, callFunction: (a, b, c, d, e, f) => A([e, d], ([h, k]) => {
      h = h.value;
      if (0 >= h || h > k.h.length)
        throw Error("FOAY0001: array position out of bounds.");
      k = k.h.concat();
      k.splice(h - 1, 1, Ra(f));
      return w.m(new pb(k));
    })},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "append", j: [{type: 62, g: 3}, {type: 59, g: 2}], i: {type: 62, g: 3}, callFunction: (a, b, c, d, e) => A([d], ([f]) => w.m(new pb(f.h.concat([Ra(e)]))))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "subarray", j: [{type: 62, g: 3}, {type: 5, g: 3}, {type: 5, g: 3}], i: {type: 62, g: 3}, callFunction: jf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "subarray", j: [{type: 62, g: 3}, {type: 5, g: 3}], i: {type: 62, g: 3}, callFunction(a, b, c, d, e) {
      const f = w.m(g(d.first().value.length - e.first().value + 1, 5));
      return jf(a, b, c, d, e, f);
    }},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "remove", j: [{type: 62, g: 3}, {type: 5, g: 2}], i: {type: 62, g: 3}, callFunction: kf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "insert-before", j: [{type: 62, g: 3}, {type: 5, g: 3}, {
      type: 59,
      g: 2
    }], i: {type: 62, g: 3}, callFunction: (a, b, c, d, e, f) => A([d, e], ([h, k]) => {
      k = k.value;
      if (k > h.h.length + 1 || 0 >= k)
        throw Error("FOAY0001: subarray position out of bounds.");
      h = h.h.concat();
      h.splice(k - 1, 0, Ra(f));
      return w.m(new pb(h));
    })},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "head", j: [{type: 62, g: 3}], i: {type: 59, g: 2}, callFunction(a, b, c, d) {
      return ob(a, b, c, d, w.m(g(1, 5)));
    }},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions/array",
      localName: "tail",
      j: [{type: 62, g: 3}],
      i: {type: 59, g: 2},
      callFunction(a, b, c, d) {
        return kf(a, b, c, d, w.m(g(1, 5)));
      }
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "reverse", j: [{type: 62, g: 3}], i: {type: 62, g: 3}, callFunction: (a, b, c, d) => A([d], ([e]) => w.m(new pb(e.h.concat().reverse())))},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "join", j: [{type: 62, g: 2}], i: {type: 62, g: 3}, callFunction: (a, b, c, d) => d.M((e) => {
      e = e.reduce((f, h) => f.concat(h.h), []);
      return w.m(new pb(e));
    })},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions/array",
      localName: "for-each",
      j: [{type: 62, g: 3}, {type: 60, g: 3}],
      i: {type: 62, g: 3},
      callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
        if (h.v !== 1)
          throw mc("The callback passed into array:for-each has a wrong arity.");
        f = f.h.map((k) => Ra(h.value.call(void 0, a, b, c, df(h.o, [k()], b, "array:for-each")[0])));
        return w.m(new pb(f));
      })
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "filter", j: [{type: 62, g: 3}, {type: 60, g: 3}], i: {type: 62, g: 3}, callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
      if (h.v !== 1)
        throw mc("The callback passed into array:filter has a wrong arity.");
      const k = f.h.map((t) => {
        t = df(h.o, [t()], b, "array:filter")[0];
        const u = h.value;
        return u(a, b, c, t);
      }), l = [];
      let n = false;
      return w.create({next: () => {
        if (n)
          return p;
        for (let u = 0, y = f.h.length; u < y; ++u) {
          var t = k[u].fa();
          l[u] = t;
        }
        t = f.h.filter((u, y) => l[y]);
        n = true;
        return q(new pb(t));
      }});
    })},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "fold-left", j: [{type: 62, g: 3}, {type: 59, g: 2}, {type: 60, g: 3}], i: {type: 59, g: 2}, callFunction: (a, b, c, d, e, f) => A([d, f], ([h, k]) => {
      if (k.v !== 2)
        throw mc("The callback passed into array:fold-left has a wrong arity.");
      return h.h.reduce((l, n) => {
        n = df(k.o, [n()], b, "array:fold-left")[0];
        return k.value.call(void 0, a, b, c, l, n);
      }, e);
    })},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "fold-right", j: [{type: 62, g: 3}, {type: 59, g: 2}, {type: 60, g: 3}], i: {type: 59, g: 2}, callFunction: (a, b, c, d, e, f) => A([d, f], ([h, k]) => {
      if (k.v !== 2)
        throw mc("The callback passed into array:fold-right has a wrong arity.");
      return h.h.reduceRight((l, n) => {
        n = df(k.o, [n()], b, "array:fold-right")[0];
        return k.value.call(void 0, a, b, c, l, n);
      }, e);
    })},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "for-each-pair", j: [{type: 62, g: 3}, {type: 62, g: 3}, {type: 60, g: 3}], i: {type: 62, g: 3}, callFunction: (a, b, c, d, e, f) => A([d, e, f], ([h, k, l]) => {
      if (l.v !== 2)
        throw mc("The callback passed into array:for-each-pair has a wrong arity.");
      const n = [];
      for (let t = 0, u = Math.min(h.h.length, k.h.length); t < u; ++t) {
        const [y, z] = df(l.o, [h.h[t](), k.h[t]()], b, "array:for-each-pair");
        n[t] = Ra(l.value.call(void 0, a, b, c, y, z));
      }
      return w.m(new pb(n));
    })},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions/array",
      localName: "sort",
      j: [{type: 62, g: 3}],
      i: {type: 62, g: 3},
      callFunction: (a, b, c, d) => A([d], ([e]) => {
        e = e.h.map((f) => f().O());
        return nf(a, b, c, e);
      })
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions/array", localName: "flatten", j: [{type: 59, g: 2}], i: {type: 59, g: 2}, callFunction: (a, b, c, d) => d.M((e) => e.reduce(of, w.empty()))}
  ];
  function E(a, b, c, d, e) {
    return e.G() ? e : w.m(jd(e.first(), a));
  }
  var vf = [{namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "untypedAtomic", j: [{type: 46, g: 0}], i: {type: 19, g: 0}, callFunction: E.bind(null, 19)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "error", j: [{type: 46, g: 0}], i: {type: 39, g: 0}, callFunction: E.bind(null, 39)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "string", j: [{type: 46, g: 0}], i: {type: 1, g: 0}, callFunction: E.bind(null, 1)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "boolean", j: [{type: 46, g: 0}], i: {
    type: 0,
    g: 0
  }, callFunction: E.bind(null, 0)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "decimal", j: [{type: 46, g: 0}], i: {type: 4, g: 0}, callFunction: E.bind(null, 4)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "float", j: [{type: 46, g: 0}], i: {type: 6, g: 0}, callFunction: E.bind(null, 6)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "double", j: [{type: 46, g: 0}], i: {type: 3, g: 0}, callFunction: E.bind(null, 3)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "duration", j: [{
    type: 46,
    g: 0
  }], i: {type: 18, g: 0}, callFunction: E.bind(null, 18)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "dateTime", j: [{type: 46, g: 0}], i: {type: 9, g: 0}, callFunction: E.bind(null, 9)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "dateTimeStamp", j: [{type: 46, g: 0}], i: {type: 10, g: 0}, callFunction: E.bind(null, 10)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "time", j: [{type: 46, g: 0}], i: {type: 8, g: 0}, callFunction: E.bind(null, 8)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "date",
    j: [{type: 46, g: 0}],
    i: {type: 7, g: 0},
    callFunction: E.bind(null, 7)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "gYearMonth", j: [{type: 46, g: 0}], i: {type: 11, g: 0}, callFunction: E.bind(null, 11)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "gYear", j: [{type: 46, g: 0}], i: {type: 12, g: 0}, callFunction: E.bind(null, 12)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "gMonthDay", j: [{type: 46, g: 0}], i: {type: 13, g: 0}, callFunction: E.bind(null, 13)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "gDay",
    j: [{type: 46, g: 0}],
    i: {type: 15, g: 0},
    callFunction: E.bind(null, 15)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "gMonth", j: [{type: 46, g: 0}], i: {type: 14, g: 0}, callFunction: E.bind(null, 14)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "hexBinary", j: [{type: 46, g: 0}], i: {type: 22, g: 0}, callFunction: E.bind(null, 22)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "base64Binary", j: [{type: 46, g: 0}], i: {type: 21, g: 0}, callFunction: E.bind(null, 21)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "QName",
    j: [{type: 46, g: 0}],
    i: {type: 23, g: 0},
    callFunction: (a, b, c, d) => {
      if (d.G())
        return d;
      a = d.first();
      if (v(a.type, 2))
        throw Error("XPTY0004: The provided QName is not a string-like value.");
      a = jd(a, 1).value;
      a = sc(a, 23);
      if (!tc(a, 23))
        throw Error("FORG0001: The provided QName is invalid.");
      if (!a.includes(":"))
        return c = c.$(""), w.m(g(new Ta("", c, a), 23));
      const [e, f] = a.split(":");
      c = c.$(e);
      if (!c)
        throw Error(`FONS0004: The value ${a} can not be cast to a QName. Did you mean to use fn:QName?`);
      return w.m(g(new Ta(e, c, f), 23));
    }
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "anyURI", j: [{type: 46, g: 0}], i: {type: 20, g: 0}, callFunction: E.bind(null, 20)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "normalizedString", j: [{type: 46, g: 0}], i: {type: 48, g: 0}, callFunction: E.bind(null, 48)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "token", j: [{type: 46, g: 0}], i: {type: 52, g: 0}, callFunction: E.bind(null, 52)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "language",
    j: [{type: 46, g: 0}],
    i: {type: 51, g: 0},
    callFunction: E.bind(null, 51)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "NMTOKEN", j: [{type: 46, g: 0}], i: {type: 50, g: 0}, callFunction: E.bind(null, 50)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "NMTOKENS", j: [{type: 46, g: 0}], i: {type: 49, g: 2}, callFunction: E.bind(null, 49)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "Name", j: [{type: 46, g: 0}], i: {type: 25, g: 0}, callFunction: E.bind(null, 25)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "NCName",
    j: [{type: 46, g: 0}],
    i: {type: 24, g: 0},
    callFunction: E.bind(null, 24)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "ID", j: [{type: 46, g: 0}], i: {type: 42, g: 0}, callFunction: E.bind(null, 42)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "IDREF", j: [{type: 46, g: 0}], i: {type: 41, g: 0}, callFunction: E.bind(null, 41)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "IDREFS", j: [{type: 46, g: 0}], i: {type: 43, g: 2}, callFunction: E.bind(null, 43)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "ENTITY",
    j: [{type: 46, g: 0}],
    i: {type: 26, g: 0},
    callFunction: E.bind(null, 26)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "ENTITIES", j: [{type: 46, g: 0}], i: {type: 40, g: 2}, callFunction: E.bind(null, 40)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "integer", j: [{type: 46, g: 0}], i: {type: 5, g: 0}, callFunction: E.bind(null, 5)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "nonPositiveInteger", j: [{type: 46, g: 0}], i: {type: 27, g: 0}, callFunction: E.bind(null, 27)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "negativeInteger",
    j: [{type: 46, g: 0}],
    i: {type: 28, g: 0},
    callFunction: E.bind(null, 28)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "long", j: [{type: 46, g: 0}], i: {type: 31, g: 0}, callFunction: E.bind(null, 31)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "int", j: [{type: 46, g: 0}], i: {type: 32, g: 0}, callFunction: E.bind(null, 32)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "short", j: [{type: 46, g: 0}], i: {type: 33, g: 0}, callFunction: E.bind(null, 33)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "byte",
    j: [{type: 46, g: 0}],
    i: {type: 34, g: 0},
    callFunction: E.bind(null, 34)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "nonNegativeInteger", j: [{type: 46, g: 0}], i: {type: 30, g: 0}, callFunction: E.bind(null, 30)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "unsignedLong", j: [{type: 46, g: 0}], i: {type: 36, g: 0}, callFunction: E.bind(null, 36)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "unsignedInt", j: [{type: 46, g: 0}], i: {type: 35, g: 0}, callFunction: E.bind(null, 35)}, {
    namespaceURI: "http://www.w3.org/2001/XMLSchema",
    localName: "unsignedShort",
    j: [{type: 46, g: 0}],
    i: {type: 38, g: 0},
    callFunction: E.bind(null, 38)
  }, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "unsignedByte", j: [{type: 46, g: 0}], i: {type: 37, g: 0}, callFunction: E.bind(null, 37)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "positiveInteger", j: [{type: 46, g: 0}], i: {type: 29, g: 0}, callFunction: E.bind(null, 29)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "yearMonthDuration", j: [{type: 46, g: 0}], i: {type: 16, g: 0}, callFunction: E.bind(null, 16)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "dayTimeDuration", j: [{type: 46, g: 0}], i: {type: 17, g: 0}, callFunction: E.bind(null, 17)}, {namespaceURI: "http://www.w3.org/2001/XMLSchema", localName: "dateTimeStamp", j: [{type: 46, g: 0}], i: {type: 10, g: 0}, callFunction: E.bind(null, 10)}];
  const wf = (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getYear(), 5)), xf = (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getMonth(), 5)), yf = (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getDay(), 5)), zf = (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getHours(), 5)), Af = (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getMinutes(), 5)), Bf = (a, b, c, d) => {
    d.G() || (a = w, b = a.m, d = d.first().value, d = b.call(a, g(d.D + d.pa, 4)));
    return d;
  }, Cf = (a, b, c, d) => d.G() ? d : (a = d.first().value.X) ? w.m(g(a, 17)) : w.empty();
  var Df = [
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "dateTime", j: [{type: 7, g: 0}, {type: 8, g: 0}], i: {type: 9, g: 0}, callFunction: (a, b, c, d, e) => {
      if (d.G())
        return d;
      if (e.G())
        return e;
      a = d.first().value;
      e = e.first().value;
      b = a.X;
      c = e.X;
      if (b || c) {
        if (!b || c) {
          if (!b && c)
            b = c;
          else if (!vb(b, c))
            throw Error("FORG0008: fn:dateTime: got a date and time value with different timezones.");
        }
      } else
        b = null;
      return w.m(g(new Kb(a.getYear(), a.getMonth(), a.getDay(), e.getHours(), e.getMinutes(), e.getSeconds(), e.pa, b), 9));
    }},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "year-from-dateTime", j: [{type: 9, g: 0}], i: {type: 5, g: 0}, callFunction: wf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "month-from-dateTime", j: [{type: 9, g: 0}], i: {type: 5, g: 0}, callFunction: xf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "day-from-dateTime", j: [{type: 9, g: 0}], i: {type: 5, g: 0}, callFunction: yf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "hours-from-dateTime", j: [{
      type: 9,
      g: 0
    }], i: {type: 5, g: 0}, callFunction: zf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "minutes-from-dateTime", j: [{type: 9, g: 0}], i: {type: 5, g: 0}, callFunction: Af},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "seconds-from-dateTime", j: [{type: 9, g: 0}], i: {type: 4, g: 0}, callFunction: Bf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "timezone-from-dateTime", j: [{type: 9, g: 0}], i: {type: 17, g: 0}, callFunction: Cf},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions",
      localName: "year-from-date",
      j: [{type: 7, g: 0}],
      i: {type: 5, g: 0},
      callFunction: wf
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "month-from-date", j: [{type: 7, g: 0}], i: {type: 5, g: 0}, callFunction: xf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "day-from-date", j: [{type: 7, g: 0}], i: {type: 5, g: 0}, callFunction: yf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "timezone-from-date", j: [{type: 7, g: 0}], i: {type: 17, g: 0}, callFunction: Cf},
    {
      namespaceURI: "http://www.w3.org/2005/xpath-functions",
      localName: "hours-from-time",
      j: [{type: 8, g: 0}],
      i: {type: 5, g: 0},
      callFunction: zf
    },
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "minutes-from-time", j: [{type: 8, g: 0}], i: {type: 5, g: 0}, callFunction: Af},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "seconds-from-time", j: [{type: 8, g: 0}], i: {type: 4, g: 0}, callFunction: Bf},
    {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "timezone-from-time", j: [{type: 8, g: 0}], i: {type: 17, g: 0}, callFunction: Cf}
  ];
  function Ef(a, b) {
    const c = b.h, d = b.Ia, e = b.Ma;
    switch (a.node.nodeType) {
      case 1:
        const h = d.createElementNS(a.node.namespaceURI, a.node.nodeName);
        c.getAllAttributes(a.node).forEach((k) => e.setAttributeNS(h, k.namespaceURI, k.nodeName, k.value));
        for (var f of hb(c, a))
          a = Ef(f, b), e.insertBefore(h, a.node, null);
        return {node: h, F: null};
      case 2:
        return b = d.createAttributeNS(a.node.namespaceURI, a.node.nodeName), b.value = ib(c, a), {node: b, F: null};
      case 4:
        return {node: d.createCDATASection(ib(c, a)), F: null};
      case 8:
        return {node: d.createComment(ib(c, a)), F: null};
      case 9:
        f = d.createDocument();
        for (const k of hb(c, a))
          a = Ef(k, b), e.insertBefore(f, a.node, null);
        return {node: f, F: null};
      case 7:
        return {node: d.createProcessingInstruction(a.node.target, ib(c, a)), F: null};
      case 3:
        return {node: d.createTextNode(ib(c, a)), F: null};
    }
  }
  function Ff(a, b) {
    const c = b.Ma;
    var d = b.Ia;
    const e = b.h;
    if (cb(a.node))
      switch (a.node.nodeType) {
        case 2:
          return d = d.createAttributeNS(a.node.namespaceURI, a.node.nodeName), d.value = ib(e, a), d;
        case 8:
          return d.createComment(ib(e, a));
        case 1:
          const f = a.node.prefix, h = a.node.localName, k = d.createElementNS(a.node.namespaceURI, f ? f + ":" + h : h);
          hb(e, a).forEach((l) => {
            l = Ff(l, b);
            c.insertBefore(k, l, null);
          });
          fb(e, a).forEach((l) => {
            c.setAttributeNS(k, l.node.namespaceURI, l.node.nodeName, ib(e, l));
          });
          k.normalize();
          return k;
        case 7:
          return d.createProcessingInstruction(a.node.target, ib(e, a));
        case 3:
          return d.createTextNode(ib(e, a));
      }
    else
      return Ef(a, b).node;
  }
  function Gf(a, b, c) {
    let d = a;
    for (a = x(c, d); a !== null; ) {
      if (d.node.nodeType === 2)
        b.push(d.node.nodeName);
      else {
        const e = hb(c, a);
        b.push(e.findIndex((f) => md(f, d)));
      }
      d = a;
      a = x(c, d);
    }
    return d;
  }
  function Hf(a, b, c) {
    for (; 0 < b.length; ) {
      const d = b.pop();
      typeof d === "string" ? a = fb(c, a).find((e) => e.node.nodeName === d) : a = hb(c, a)[d];
    }
    return a.node;
  }
  function If(a, b, c) {
    var d = a.node;
    if (!(cb(d) || c || a.F))
      return d;
    d = b.v;
    const e = [];
    if (c)
      return Ff(a, b);
    a = Gf(a, e, b.h);
    c = d.get(a.node);
    c || (c = {node: Ff(a, b), F: null}, d.set(a.node, c));
    return Hf(c, e, b.h);
  }
  const Jf = (a, b, c, d, e) => d.M((f) => {
    let h = "";
    for (let k = 0; k < f.length; k++) {
      const l = f[k], n = b.Ua && v(l.type, 53) ? b.Ua.serializeToString(If(l.value, b, false)) : qc(w.m(l), b).map((t) => jd(t, 1)).first().value;
      h += `{type: ${Ea[l.type]}, value: ${n}}
`;
    }
    e !== void 0 && (h += e.first().value);
    b.ib.trace(h);
    return w.create(f);
  });
  var Kf = [{j: [{type: 59, g: 2}], callFunction: Jf, localName: "trace", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {j: [{type: 59, g: 2}, {type: 1, g: 3}], callFunction: Jf, localName: "trace", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}];
  const Lf = (a, b, c, d, e) => {
    a = d === void 0 || d.G() ? new Ta("err", "http://www.w3.org/2005/xqt-errors", "FOER0000") : d.first().value;
    b = "";
    e === void 0 || e.G() || (b = `: ${e.first().value}`);
    throw Error(`${a.localName}${b}`);
  };
  var Mf = [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "error", j: [], i: {type: 63, g: 3}, callFunction: Lf}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "error", j: [{type: 23, g: 0}], i: {type: 63, g: 3}, callFunction: Lf}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "error", j: [{type: 23, g: 0}, {type: 1, g: 3}], i: {type: 63, g: 3}, callFunction: Lf}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "error", j: [{type: 23, g: 0}, {type: 1, g: 3}, {type: 59, g: 2}], i: {
    type: 63,
    g: 3
  }, callFunction() {
    throw Error("Not implemented: Using an error object in error is not supported");
  }}];
  function Nf(a) {
    return typeof a === "string" ? a : (a = new Za().getChildNodes(a).find((b) => b.nodeType === 8)) ? a.data : "some expression";
  }
  var Of = class extends Error {
    constructor(a, b) {
      super(a);
      this.position = {end: {ha: b.end.ha, line: b.end.line, offset: b.end.offset}, start: {ha: b.start.ha, line: b.start.line, offset: b.start.offset}};
    }
  };
  function Pf(a, b) {
    if (b instanceof Error)
      throw b;
    typeof a !== "string" && (a = Nf(a));
    const c = Qf(b);
    a = a.replace(/\r/g, "").split("\n");
    const d = Math.floor(Math.log10(Math.min(c.end.line + 2, a.length))) + 1;
    a = a.reduce((e, f, h) => {
      var k = h + 1;
      if (2 < c.start.line - k || 2 < k - c.end.line)
        return e;
      h = `${Array(d).fill(" ", 0, Math.floor(Math.log10(k)) + 1 - d).join("")}${k}: `;
      e.push(`${h}${f}`);
      if (k >= c.start.line && k <= c.end.line) {
        const l = k < c.end.line ? f.length + h.length : c.end.ha - 1 + h.length;
        k = k > c.start.line ? h.length : c.start.ha - 1 + h.length;
        f = " ".repeat(h.length) + Array.from(f.substring(0, k - h.length), (n) => n === "	" ? "	" : " ").join("") + "^".repeat(l - k);
        e.push(f);
      }
      return e;
    }, []);
    b = Rf(b).join("\n");
    throw new Of(a.join("\n") + "\n\n" + b, c);
  }
  const Sf = Object.create(null);
  function Tf(a, b) {
    const c = new Map();
    for (let d = 0; d < a.length + 1; ++d)
      c.set(d, new Map());
    return function h(e, f) {
      if (e === 0)
        return f;
      if (f === 0)
        return e;
      if (c.get(e).has(f))
        return c.get(e).get(f);
      var k = 0;
      a[e - 1] !== b[f - 1] && (k = 1);
      k = Math.min(h(e - 1, f) + 1, h(e, f - 1) + 1, h(e - 1, f - 1) + k);
      c.get(e).set(f, k);
      return k;
    }(a.length, b.length);
  }
  function Uf(a) {
    const b = Sf[a] ? Sf[a] : Object.keys(Sf).map((c) => ({name: c, qb: Tf(a, c.slice(c.lastIndexOf(":") + 1))})).sort((c, d) => c.qb - d.qb).slice(0, 5).filter((c) => c.qb < a.length / 2).reduce((c, d) => c.concat(Sf[d.name]), []).slice(0, 5);
    return b.length ? b.map((c) => `"Q{${c.namespaceURI}}${c.localName} (${c.j.map((d) => d === 4 ? "..." : Ha(d)).join(", ")})"`).reduce((c, d, e, f) => e === 0 ? c + d : c + ((e !== f.length - 1 ? ", " : " or ") + d), "Did you mean ") + "?" : "No similar functions found.";
  }
  function Vf(a, b, c) {
    var d = Sf[a + ":" + b];
    return d ? (d = d.find((e) => e.j.some((f) => f === 4) ? e.j.length - 1 <= c : e.j.length === c)) ? {j: d.j, arity: c, callFunction: d.callFunction, J: d.J, localName: b, namespaceURI: a, i: d.i} : null : null;
  }
  function Wf(a, b, c, d, e) {
    Sf[a + ":" + b] || (Sf[a + ":" + b] = []);
    Sf[a + ":" + b].push({j: c, arity: c.length, callFunction: e, J: false, localName: b, namespaceURI: a, i: d});
  }
  var Xf = {xml: "http://www.w3.org/XML/1998/namespace", xs: "http://www.w3.org/2001/XMLSchema", fn: "http://www.w3.org/2005/xpath-functions", map: "http://www.w3.org/2005/xpath-functions/map", array: "http://www.w3.org/2005/xpath-functions/array", math: "http://www.w3.org/2005/xpath-functions/math", fontoxpath: "http://fontoxml.com/fontoxpath", local: "http://www.w3.org/2005/xquery-local-functions"};
  var Yf = class {
    constructor(a, b, c, d) {
      this.Ca = [Object.create(null)];
      this.Da = Object.create(null);
      this.s = a;
      this.ia = Object.keys(b).reduce((e, f) => {
        if (b[f] === void 0)
          return e;
        e[f] = `Q{}${f}[0]`;
        return e;
      }, Object.create(null));
      this.o = Object.create(null);
      this.h = Object.create(null);
      this.v = c;
      this.l = d;
      this.D = [];
    }
    ta(a, b, c) {
      return Vf(a, b, c);
    }
    cb(a, b) {
      if (a)
        return null;
      a = this.ia[b];
      this.o[b] || (this.o[b] = {name: b});
      return a;
    }
    Sa(a, b) {
      const c = this.l(a, b);
      if (c)
        this.D.push({ac: a, arity: b, Bb: c});
      else if (a.prefix === "") {
        if (this.v)
          return {
            namespaceURI: this.v,
            localName: a.localName
          };
      } else if (b = this.$(a.prefix, true))
        return {namespaceURI: b, localName: a.localName};
      return c;
    }
    $(a, b = true) {
      if (!b)
        return null;
      if (Xf[a])
        return Xf[a];
      b = this.s(a);
      this.h[a] || (this.h[a] = {namespaceURI: b, prefix: a});
      return b !== void 0 || a ? b : null;
    }
  };
  var Zf = (a, b) => {
    a = a.node.nodeType === 2 ? `${a.node.nodeName}="${ib(b, a)}"` : a.node.outerHTML;
    return Error(`XQTY0024: The node ${a} follows a node that is not an attribute node or a namespace node.`);
  }, $f = (a) => Error(`XQDY0044: The node name "${a.ya()}" is invalid for a computed attribute constructor.`), ag = () => Error("XQST0045: Functions and variables may not be declared in one of the reserved namespace URIs."), bg = (a, b) => Error(`XQST0049: The function or variable "Q{${a}}${b}" is declared more than once.`), cg = () => Error("XQST0060: Functions declared in a module or as an external function must reside in a namespace."), dg = () => Error("XQST0066: A Prolog may contain at most one default function namespace declaration."), eg = () => Error("XQST0070: The prefixes xml and xmlns may not be used in a namespace declaration or be bound to another namespaceURI."), fg = (a) => Error(`XQDY0074: The value "${a}" of a name expressions cannot be converted to an expanded QName.`), gg = (a) => Error(`XPST0081: The prefix "${a}" could not be resolved`);
  function hg(a, b) {
    return `Q{${a || ""}}${b}`;
  }
  function ig(a, b) {
    for (let c = a.length - 1; 0 <= c; --c)
      if (b in a[c])
        return a[c][b];
  }
  function gf(a) {
    const b = new jg(a.o);
    for (let c = 0; c < a.h + 1; ++c)
      b.D = [Object.assign(Object.create(null), b.D[0], a.D[c])], b.Ca = [Object.assign(Object.create(null), b.Ca[0], a.Ca[c])], b.l = Object.assign(Object.create(null), a.l), b.Da = a.Da, b.v = a.v;
    return b;
  }
  function kg(a) {
    a.s++;
    a.h++;
    a.D[a.h] = Object.create(null);
    a.Ca[a.h] = Object.create(null);
  }
  function lg(a, b, c) {
    return (a = a.Da[hg(b, c)]) ? a : null;
  }
  function mg(a, b, c, d, e) {
    d = hg(b, c) + "~" + d;
    if (a.l[d])
      throw bg(b, c);
    a.l[d] = e;
  }
  function ng(a, b, c) {
    a.D[a.h][b] = c;
  }
  function og(a, b, c) {
    b = hg(b || "", c);
    return a.Ca[a.h][b] = `${b}[${a.s}]`;
  }
  function pg(a, b, c, d) {
    a.Da[`${hg(b || "", c)}[${a.s}]`] = d;
  }
  function qg(a) {
    a.D.length = a.h;
    a.Ca.length = a.h;
    a.h--;
  }
  var jg = class {
    constructor(a) {
      this.o = a;
      this.s = this.h = 0;
      this.D = [Object.create(null)];
      this.l = Object.create(null);
      this.v = null;
      this.Da = a && a.Da;
      this.Ca = a && a.Ca;
    }
    ta(a, b, c, d = false) {
      const e = this.l[hg(a, b) + "~" + c];
      return !e || d && e.ub ? this.o === null ? null : this.o.ta(a, b, c, d) : e;
    }
    cb(a, b) {
      const c = ig(this.Ca, hg(a, b));
      return c ? c : this.o === null ? null : this.o.cb(a, b);
    }
    Sa(a, b) {
      var c = a.prefix;
      const d = a.localName;
      return c === "" && this.v ? {localName: d, namespaceURI: this.v} : c && (c = this.$(c, false)) ? {localName: d, namespaceURI: c} : this.o === null ? null : this.o.Sa(a, b);
    }
    $(a, b = true) {
      const c = ig(this.D, a || "");
      return c === void 0 ? this.o === null ? void 0 : this.o.$(a || "", b) : c;
    }
  };
  function G(a, b) {
    b === "*" || Array.isArray(b) || (b = [b]);
    for (let c = 1; c < a.length; ++c) {
      if (!Array.isArray(a[c]))
        continue;
      const d = a[c];
      if (b === "*" || b.includes(d[0]))
        return d;
    }
    return null;
  }
  function H(a) {
    return 2 > a.length ? "" : typeof a[1] === "object" ? a[2] || "" : a[1] || "";
  }
  function I(a, b) {
    if (!Array.isArray(a))
      return null;
    a = a[1];
    return typeof a !== "object" || Array.isArray(a) ? null : b in a ? a[b] : null;
  }
  function J(a, b) {
    return b.reduce(G, a);
  }
  function K(a, b) {
    const c = [];
    for (let d = 1; d < a.length; ++d) {
      if (!Array.isArray(a[d]))
        continue;
      const e = a[d];
      b !== "*" && e[0] !== b || c.push(e);
    }
    return c;
  }
  function rg(a) {
    return {localName: H(a), namespaceURI: I(a, "URI"), prefix: I(a, "prefix")};
  }
  function sg(a) {
    const b = G(a, "typeDeclaration");
    if (!b || G(b, "voidSequenceType"))
      return {type: 59, g: 2};
    const c = (f) => {
      switch (f[0]) {
        case "documentTest":
          return 55;
        case "elementTest":
          return 54;
        case "attributeTest":
          return 47;
        case "piTest":
          return 57;
        case "commentTest":
          return 58;
        case "textTest":
          return 56;
        case "anyKindTest":
          return 53;
        case "anyItemType":
          return 59;
        case "anyFunctionTest":
        case "functionTest":
        case "typedFunctionTest":
          return 60;
        case "anyMapTest":
        case "typedMapTest":
          return 61;
        case "anyArrayTest":
        case "typedArrayTest":
          return 62;
        case "atomicType":
          return Ia([I(f, "prefix"), H(f)].join(":"));
        case "parenthesizedItemType":
          return c(G(f, "*"));
        default:
          throw Error(`Type declaration "${G(b, "*")[0]}" is not supported.`);
      }
    };
    a = {type: c(G(b, "*")), g: 3};
    let d = null;
    const e = G(b, "occurrenceIndicator");
    e && (d = H(e));
    switch (d) {
      case "*":
        return a.g = 2, a;
      case "?":
        return a.g = 0, a;
      case "+":
        return a.g = 1, a;
      case "":
      case null:
        return a;
    }
  }
  function L(a, b, c) {
    if (typeof a[1] !== "object" || Array.isArray(a[1])) {
      const d = {};
      d[b] = c;
      a.splice(1, 0, d);
    } else
      a[1][b] = c;
  }
  function tg(a) {
    const b = {type: 62, g: 3};
    L(a, "type", b);
    return b;
  }
  function ug(a, b) {
    if (!b || !b.ga)
      return {type: 59, g: 2};
    var c = G(a, "EQName");
    if (!c)
      return {type: 59, g: 2};
    var d = rg(c);
    c = d.localName;
    const e = d.prefix;
    d = K(G(a, "arguments"), "*");
    c = b.ga.Sa({localName: c, prefix: e}, d.length);
    if (!c)
      return {type: 59, g: 2};
    b = b.ga.ta(c.namespaceURI, c.localName, d.length + 1);
    if (!b)
      return {type: 59, g: 2};
    b.i.type !== 59 && L(a, "type", b.i);
    return b.i;
  }
  function M(a, b, c) {
    return (a << 20) + (b << 12) + (c.charCodeAt(0) << 8) + c.charCodeAt(1);
  }
  var vg = {[M(2, 2, "idivOp")]: 5, [M(16, 16, "addOp")]: 16, [M(16, 16, "subtractOp")]: 16, [M(16, 16, "divOp")]: 4, [M(16, 2, "multiplyOp")]: 16, [M(16, 2, "divOp")]: 16, [M(2, 16, "multiplyOp")]: 16, [M(17, 17, "addOp")]: 17, [M(17, 17, "subtractOp")]: 17, [M(17, 17, "divOp")]: 4, [M(17, 2, "multiplyOp")]: 17, [M(17, 2, "divOp")]: 17, [M(2, 17, "multiplyOp")]: 17, [M(9, 9, "subtractOp")]: 17, [M(7, 7, "subtractOp")]: 17, [M(8, 8, "subtractOp")]: 17, [M(9, 16, "addOp")]: 9, [M(9, 16, "subtractOp")]: 9, [M(9, 17, "addOp")]: 9, [M(9, 17, "subtractOp")]: 9, [M(7, 16, "addOp")]: 7, [M(7, 16, "subtractOp")]: 7, [M(7, 17, "addOp")]: 7, [M(7, 17, "subtractOp")]: 7, [M(8, 17, "addOp")]: 8, [M(8, 17, "subtractOp")]: 8, [M(9, 16, "addOp")]: 9, [M(9, 16, "subtractOp")]: 9, [M(9, 17, "addOp")]: 9, [M(9, 17, "subtractOp")]: 9, [M(7, 17, "addOp")]: 7, [M(7, 17, "subtractOp")]: 7, [M(7, 16, "addOp")]: 7, [M(7, 16, "subtractOp")]: 7, [M(8, 17, "addOp")]: 8, [M(8, 17, "subtractOp")]: 8}, wg = {
    [M(2, 2, "addOp")]: (a, b) => a + b,
    [M(2, 2, "subtractOp")]: (a, b) => a - b,
    [M(2, 2, "multiplyOp")]: (a, b) => a * b,
    [M(2, 2, "divOp")]: (a, b) => a / b,
    [M(2, 2, "modOp")]: (a, b) => a % b,
    [M(2, 2, "idivOp")]: (a, b) => Math.trunc(a / b),
    [M(16, 16, "addOp")]: function(a, b) {
      return new Kc(a.ea + b.ea);
    },
    [M(16, 16, "subtractOp")]: function(a, b) {
      return new Kc(a.ea - b.ea);
    },
    [M(16, 16, "divOp")]: function(a, b) {
      return a.ea / b.ea;
    },
    [M(16, 2, "multiplyOp")]: Mc,
    [M(16, 2, "divOp")]: function(a, b) {
      if (isNaN(b))
        throw Error("FOCA0005: Cannot divide xs:yearMonthDuration by NaN");
      a = Math.round(a.ea / b);
      if (a > Number.MAX_SAFE_INTEGER || !Number.isFinite(a))
        throw Error("FODT0002: Value overflow while dividing xs:yearMonthDuration");
      return new Kc(a < Number.MIN_SAFE_INTEGER || a === 0 ? 0 : a);
    },
    [M(2, 16, "multiplyOp")]: (a, b) => Mc(b, a),
    [M(17, 17, "addOp")]: function(a, b) {
      return new yb(a.ca + b.ca);
    },
    [M(17, 17, "subtractOp")]: function(a, b) {
      return new yb(a.ca - b.ca);
    },
    [M(17, 17, "divOp")]: function(a, b) {
      if (b.ca === 0)
        throw Error("FOAR0001: Division by 0");
      return a.ca / b.ca;
    },
    [M(17, 2, "multiplyOp")]: Cb,
    [M(17, 2, "divOp")]: function(a, b) {
      if (isNaN(b))
        throw Error("FOCA0005: Cannot divide xs:dayTimeDuration by NaN");
      a = a.ca / b;
      if (a > Number.MAX_SAFE_INTEGER || !Number.isFinite(a))
        throw Error("FODT0002: Value overflow while dividing xs:dayTimeDuration");
      return new yb(a < Number.MIN_SAFE_INTEGER || Object.is(-0, a) ? 0 : a);
    },
    [M(2, 17, "multiplyOp")]: (a, b) => Cb(b, a),
    [M(9, 9, "subtractOp")]: Pb,
    [M(7, 7, "subtractOp")]: Pb,
    [M(8, 8, "subtractOp")]: Pb,
    [M(9, 16, "addOp")]: Qb,
    [M(9, 16, "subtractOp")]: Rb,
    [M(9, 17, "addOp")]: Qb,
    [M(9, 17, "subtractOp")]: Rb,
    [M(7, 16, "addOp")]: Qb,
    [M(7, 16, "subtractOp")]: Rb,
    [M(7, 17, "addOp")]: Qb,
    [M(7, 17, "subtractOp")]: Rb,
    [M(8, 17, "addOp")]: Qb,
    [M(8, 17, "subtractOp")]: Rb,
    [M(9, 16, "addOp")]: Qb,
    [M(9, 16, "subtractOp")]: Rb,
    [M(9, 17, "addOp")]: Qb,
    [M(9, 17, "subtractOp")]: Rb,
    [M(7, 17, "addOp")]: Qb,
    [M(7, 17, "subtractOp")]: Rb,
    [M(7, 16, "addOp")]: Qb,
    [M(7, 16, "subtractOp")]: Rb,
    [M(8, 17, "addOp")]: Qb,
    [M(8, 17, "subtractOp")]: Rb
  };
  function xg(a, b) {
    return v(a, 5) && v(b, 5) ? 5 : v(a, 4) && v(b, 4) ? 4 : v(a, 6) && v(b, 6) ? 6 : 3;
  }
  const yg = [2, 16, 17, 9, 7, 8];
  function zg(a, b, c) {
    function d(l, n) {
      return {T: e ? e(l) : l, U: f ? f(n) : n};
    }
    let e = null, f = null;
    v(b, 19) && (e = (l) => jd(l, 3), b = 3);
    v(c, 19) && (f = (l) => jd(l, 3), c = 3);
    const h = yg.filter((l) => v(b, l)), k = yg.filter((l) => v(c, l));
    if (h.includes(2) && k.includes(2)) {
      const l = wg[M(2, 2, a)];
      let n = vg[M(2, 2, a)];
      n || (n = xg(b, c));
      a === "divOp" && n === 5 && (n = 4);
      return a === "idivOp" ? Ag(d, l)[0] : (t, u) => {
        const {T: y, U: z} = d(t, u);
        return g(l(y.value, z.value), n);
      };
    }
    for (const l of h)
      for (const n of k) {
        const t = wg[M(l, n, a)], u = vg[M(l, n, a)];
        if (t && u !== void 0)
          return (y, z) => {
            const {
              T: F,
              U: O
            } = d(y, z);
            return g(t(F.value, O.value), u);
          };
      }
  }
  function Bg(a, b, c) {
    function d(n, t) {
      return {T: f ? f(n) : n, U: h ? h(t) : t};
    }
    var e = [2, 53, 59, 46, 47];
    if (e.includes(b) || e.includes(c))
      return 2;
    let f = null, h = null;
    v(b, 19) && (f = (n) => jd(n, 3), b = 3);
    v(c, 19) && (h = (n) => jd(n, 3), c = 3);
    var k = yg.filter((n) => v(b, n));
    e = yg.filter((n) => v(c, n));
    if (k.includes(2) && e.includes(2)) {
      var l = vg[M(2, 2, a)];
      l === void 0 && (l = xg(b, c));
      a === "divOp" && l === 5 && (l = 4);
      return a === "idivOp" ? Ag(d, (n, t) => Math.trunc(n / t))[1] : l;
    }
    for (l of k)
      for (const n of e)
        if (k = vg[M(l, n, a)], k !== void 0)
          return k;
  }
  function Ag(a, b) {
    return [(c, d) => {
      const {T: e, U: f} = a(c, d);
      if (f.value === 0)
        throw Error("FOAR0001: Divisor of idiv operator cannot be (-)0");
      if (Number.isNaN(e.value) || Number.isNaN(f.value) || !Number.isFinite(e.value))
        throw Error("FOAR0002: One of the operands of idiv is NaN or the first operand is (-)INF");
      return Number.isFinite(e.value) && !Number.isFinite(f.value) ? g(0, 5) : g(b(e.value, f.value), 5);
    }, 5];
  }
  const Cg = Object.create(null);
  var Dg = class extends D {
    constructor(a, b, c, d, e) {
      super(b.o.add(c.o), [b, c], {B: false}, false, d);
      this.A = b;
      this.L = c;
      this.l = a;
      this.s = e;
    }
    h(a, b) {
      return qc(B(this.A, a, b), b).M((c) => c.length === 0 ? w.empty() : qc(B(this.L, a, b), b).M((d) => {
        if (d.length === 0)
          return w.empty();
        if (1 < c.length || 1 < d.length)
          throw Error('XPTY0004: the operands of the "' + this.l + '" operator should be empty or singleton.');
        const e = c[0];
        d = d[0];
        if (this.s && this.type)
          return w.m(this.s(e, d));
        var f = e.type;
        var h = d.type, k = this.l;
        const l = `${f}~${h}~${k}`;
        let n = Cg[l];
        n || (n = Cg[l] = zg(k, f, h));
        f = n;
        if (!f)
          throw Error(`XPTY0004: ${this.l} not available for types ${Ea[e.type]} and ${Ea[d.type]}`);
        return w.m(f(e, d));
      }));
    }
  };
  function Eg(a, b) {
    var c = N;
    let d = false;
    for (var e = 1; e < a.length; e++)
      switch (a[e][0]) {
        case "letClause":
          Fg(b);
          var f = a[e], h = b, k = c, l = J(f, ["letClauseItem", "typedVariableBinding", "varName"]);
          l = rg(l);
          f = J(f, ["letClauseItem", "letExpr"]);
          k = k(f[1], h);
          Gg(h, l.localName, k);
          break;
        case "forClause":
          d = true;
          Fg(b);
          Hg(a[e], b, c);
          break;
        case "whereClause":
          Fg(b);
          h = a[e];
          c(h, b);
          L(h, "type", {type: 0, g: 3});
          break;
        case "orderByClause":
          Fg(b);
          break;
        case "returnClause":
          e = a[e];
          h = c;
          c = J(e, ["*"]);
          b = h(c, b);
          L(c, "type", b);
          L(e, "type", b);
          c = b;
          if (!c)
            return {
              type: 59,
              g: 2
            };
          d && (c = {type: c.type, g: 2});
          c.type !== 59 && L(a, "type", c);
          return c;
        default:
          c = c(a[e], b);
          if (!c)
            return {type: 59, g: 2};
          d && (c = {type: c.type, g: 2});
          c.type !== 59 && L(a, "type", c);
          return c;
      }
    if (0 < b.h)
      b.h--, b.o.pop(), b.v.pop();
    else
      throw Error("Variable scope out of bound");
  }
  function Hg(a, b, c) {
    const d = rg(J(a, ["forClauseItem", "typedVariableBinding", "varName"]));
    if (a = J(a, ["forClauseItem", "forExpr", "sequenceExpr"]))
      a = K(a, "*").map((e) => c(e, b)), a.includes(void 0) || a.includes(null) || (a = Ig(a), a.length === 1 && Gg(b, d.localName, a[0]));
  }
  function Ig(a) {
    return a.filter((b, c, d) => d.findIndex((e) => e.type === b.type && e.g === b.g) === c);
  }
  function Jg(a, b) {
    if (!b || !b.ga)
      return {type: 59, g: 2};
    const c = G(a, "functionName");
    var d = rg(c);
    let e = d.localName;
    var f = d.prefix;
    let h = d.namespaceURI;
    d = K(G(a, "arguments"), "*");
    if (h === null) {
      f = b.ga.Sa({localName: e, prefix: f}, d.length);
      if (!f)
        return {type: 59, g: 2};
      e = f.localName;
      h = f.namespaceURI;
      L(c, "URI", h);
      c[2] = e;
    }
    b = b.ga.ta(h, e, d.length);
    if (!b || b.i.type === 63)
      return {type: 59, g: 2};
    b.i.type !== 59 && L(a, "type", b.i);
    return b.i;
  }
  function Kg(a) {
    const b = {type: 61, g: 3};
    L(a, "type", b);
    return b;
  }
  function Lg(a, b) {
    if (!b || !b.ga)
      return {type: 59, g: 2};
    const c = G(a, "functionName");
    var d = rg(c);
    let e = d.localName;
    var f = d.namespaceURI;
    const h = d.prefix;
    d = Number(J(a, ["integerConstantExpr", "value"])[1]);
    if (!f) {
      f = b.ga.Sa({localName: e, prefix: h}, d);
      if (!f)
        return {type: 59, g: 2};
      e = f.localName;
      f = f.namespaceURI;
      L(c, "URI", f);
    }
    b = b.ga.ta(f, e, d) || null;
    if (!b)
      return {type: 59, g: 2};
    b.i.type !== 59 && b.i.type !== 63 && L(a, "type", b.i);
    return b.i;
  }
  function Mg(a, b) {
    var c = K(a, "stepExpr");
    if (!c)
      return {type: 59, g: 2};
    for (const f of c) {
      a: {
        c = f;
        var d = b;
        let h = null;
        if (!c)
          break a;
        var e = K(c, "*");
        let k = "";
        for (const l of e)
          switch (l[0]) {
            case "filterExpr":
              h = I(J(l, ["*"]), "type");
              break;
            case "xpathAxis":
              k = l[1];
              b: {
                switch (k) {
                  case "attribute":
                    h = {type: 47, g: 2};
                    break b;
                  case "child":
                  case "decendant":
                  case "self":
                  case "descendant-or-self":
                  case "following-sibling":
                  case "following":
                  case "namespace":
                  case "parent":
                  case "ancestor":
                  case "preceding-sibling":
                  case "preceding":
                  case "ancestor-or-self":
                    h = {type: 53, g: 2};
                    break b;
                }
                h = void 0;
              }
              break;
            case "nameTest":
              e = rg(l);
              if (e.namespaceURI !== null)
                break;
              if (k === "attribute" && !e.prefix)
                break;
              e = d.$(e.prefix || "");
              e !== void 0 && L(l, "URI", e);
              break;
            case "lookup":
              h = {type: 59, g: 2};
          }
        h && h.type !== 59 && L(c, "type", h);
      }
      d = I(f, "type");
    }
    d && d.type !== 59 && L(a, "type", d);
    return d;
  }
  function Ng(a) {
    const b = {type: 0, g: 3};
    L(a, "type", b);
    return b;
  }
  function Og(a, b, c) {
    b === 0 ? b = {type: 53, g: 2} : b === 1 ? b = c[0] : c.includes(void 0) || c.includes(null) ? b = {type: 59, g: 2} : (b = Ig(c), b = 1 < b.length ? {type: 59, g: 2} : {type: b[0].type, g: 2});
    b && b.type !== 59 && L(a, "type", b);
    return b;
  }
  function Pg(a, b, c, d) {
    if (!b || c.includes(void 0))
      return {type: 59, g: 2};
    var e = K(a, "typeswitchExprCaseClause");
    for (let h = 0; h < c.length; h++) {
      var f = G(e[h], "*");
      switch (f[0]) {
        case "sequenceType":
          if (f = Qg(f, b, c[h]))
            return f.type !== 59 && L(a, "type", f), f;
          continue;
        case "sequenceTypeUnion":
          for (d = K(f, "*"), e = 0; 2 > e; e++)
            if (f = Qg(d[e], b, c[h]))
              return f.type !== 59 && L(a, "type", f), f;
        default:
          return {type: 59, g: 2};
      }
    }
    d.type !== 59 && L(a, "type", d);
    return d;
  }
  function Qg(a, b, c) {
    const d = K(a, "*"), e = G(a, "atomicType");
    if (!e)
      return {type: 59, g: 2};
    if (Ia(I(e, "prefix") + ":" + e[2]) === b.type) {
      if (d.length === 1) {
        if (b.g === 3)
          return c;
      } else if (a = G(a, "occurrenceIndicator")[1], b.g === Ka(a))
        return c;
    }
  }
  function Rg(a, b) {
    N(a, b);
  }
  function N(a, b) {
    var c = Sg.get(a[0]);
    if (c)
      return c(a, b);
    for (c = 1; c < a.length; c++)
      a[c] && N(a[c], b);
  }
  const Tg = (a, b) => {
    var c = N(G(a, "firstOperand")[1], b);
    const d = N(G(a, "secondOperand")[1], b);
    var e = a[0];
    if (c && d)
      if (b = Bg(e, c.type, d.type))
        c = {type: b, g: c.g}, b !== 2 && b !== 59 && L(a, "type", c), a = c;
      else
        throw Error(`XPTY0004: ${e} not available for types ${Ha(c)} and ${Ha(d)}`);
    else
      a = {type: 2, g: 3};
    return a;
  }, Ug = (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    a: {
      switch (a[0]) {
        case "orOp":
          b = {type: 0, g: 3};
          L(a, "type", b);
          a = b;
          break a;
        case "andOp":
          b = {type: 0, g: 3};
          L(a, "type", b);
          a = b;
          break a;
      }
      a = void 0;
    }
    return a;
  }, Vg = (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    a: {
      switch (a[0]) {
        case "unionOp":
          b = {type: 53, g: 2};
          L(a, "type", b);
          a = b;
          break a;
        case "intersectOp":
          b = {type: 53, g: 2};
          L(a, "type", b);
          a = b;
          break a;
        case "exceptOp":
          b = {type: 53, g: 2};
          L(a, "type", b);
          a = b;
          break a;
      }
      a = void 0;
    }
    return a;
  }, Wg = (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    b = {type: 0, g: 3};
    L(a, "type", b);
    return b;
  }, Xg = (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    b = I(J(a, ["firstOperand", "*"]), "type");
    const c = I(J(a, ["secondOperand", "*"]), "type");
    b = {type: 0, g: zc(b) || zc(c) ? 0 : 3};
    L(a, "type", b);
    return b;
  }, Yg = (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    b = I(J(a, ["firstOperand", "*"]), "type");
    const c = I(J(a, ["secondOperand", "*"]), "type");
    b = {type: 0, g: zc(b) || zc(c) ? 0 : 3};
    L(a, "type", b);
    return b;
  }, Sg = new Map([["unaryMinusOp", (a, b) => {
    b = N(G(a, "operand")[1], b);
    b ? v(b.type, 2) ? (b = {type: b.type, g: b.g}, L(a, "type", b), a = b) : (b = {type: 3, g: 3}, L(a, "type", b), a = b) : (b = {type: 2, g: 2}, L(a, "type", b), a = b);
    return a;
  }], [
    "unaryPlusOp",
    (a, b) => {
      b = N(G(a, "operand")[1], b);
      b ? v(b.type, 2) ? (b = {type: b.type, g: b.g}, L(a, "type", b), a = b) : (b = {type: 3, g: 3}, L(a, "type", b), a = b) : (b = {type: 2, g: 2}, L(a, "type", b), a = b);
      return a;
    }
  ], ["addOp", Tg], ["subtractOp", Tg], ["divOp", Tg], ["idivOp", Tg], ["modOp", Tg], ["multiplyOp", Tg], ["andOp", Ug], ["orOp", Ug], ["sequenceExpr", (a, b) => {
    const c = K(a, "*"), d = c.map((e) => N(e, b));
    return Og(a, c.length, d);
  }], ["unionOp", Vg], ["intersectOp", Vg], ["exceptOp", Vg], ["stringConcatenateOp", (a, b) => {
    N(G(a, "firstOperand")[1], b);
    N(G(a, "secondOperand")[1], b);
    b = {type: 1, g: 3};
    L(a, "type", b);
    return b;
  }], ["rangeSequenceExpr", (a, b) => {
    N(G(a, "startExpr")[1], b);
    N(G(a, "endExpr")[1], b);
    b = {type: 5, g: 1};
    L(a, "type", b);
    return b;
  }], ["equalOp", Wg], ["notEqualOp", Wg], ["lessThanOrEqualOp", Wg], ["lessThanOp", Wg], ["greaterThanOrEqualOp", Wg], ["greaterThanOp", Wg], ["eqOp", Xg], ["neOp", Xg], ["ltOp", Xg], ["leOp", Xg], ["gtOp", Xg], ["geOp", Xg], ["isOp", Yg], ["nodeBeforeOp", Yg], ["nodeAfterOp", Yg], ["pathExpr", (a, b) => {
    const c = G(a, "rootExpr");
    c && c[1] && N(c[1], b);
    K(a, "stepExpr").map((d) => N(d, b));
    return Mg(a, b);
  }], ["contextItemExpr", () => ({type: 59, g: 2})], ["ifThenElseExpr", (a, b) => {
    N(G(G(a, "ifClause"), "*"), b);
    const c = N(G(G(a, "thenClause"), "*"), b);
    b = N(G(G(a, "elseClause"), "*"), b);
    c && b ? c.type === b.type && c.g === b.g ? (c.type !== 59 && L(a, "type", c), a = c) : a = {type: 59, g: 2} : a = {type: 59, g: 2};
    return a;
  }], ["instanceOfExpr", (a, b) => {
    N(G(a, "argExpr"), b);
    N(G(a, "sequenceType"), b);
    b = {type: 0, g: 3};
    L(a, "type", b);
    return b;
  }], ["integerConstantExpr", (a) => {
    const b = {type: 5, g: 3};
    L(a, "type", b);
    return b;
  }], ["doubleConstantExpr", (a) => {
    const b = {type: 3, g: 3};
    L(a, "type", b);
    return b;
  }], ["decimalConstantExpr", (a) => {
    const b = {type: 4, g: 3};
    L(a, "type", b);
    return b;
  }], ["stringConstantExpr", (a) => {
    const b = {type: 1, g: 3};
    L(a, "type", b);
    return b;
  }], ["functionCallExpr", (a, b) => {
    const c = G(a, "arguments");
    K(c, "*").map((d) => N(d, b));
    return Jg(a, b);
  }], ["arrowExpr", (a, b) => {
    N(G(a, "argExpr")[1], b);
    return ug(a, b);
  }], ["dynamicFunctionInvocationExpr", (a, b) => {
    N(J(a, ["functionItem", "*"]), b);
    (a = G(a, "arguments")) && N(a, b);
    return {type: 59, g: 2};
  }], ["namedFunctionRef", (a, b) => Lg(a, b)], [
    "inlineFunctionExpr",
    (a, b) => {
      N(G(a, "functionBody")[1], b);
      b = {type: 60, g: 3};
      L(a, "type", b);
      return b;
    }
  ], ["castExpr", (a) => {
    var b = J(a, ["singleType", "atomicType"]);
    b = {type: Ia(I(b, "prefix") + ":" + b[2]), g: 3};
    b.type !== 59 && L(a, "type", b);
    return b;
  }], ["castableExpr", (a) => {
    const b = {type: 0, g: 3};
    L(a, "type", b);
    return b;
  }], ["simpleMapExpr", (a, b) => {
    const c = K(a, "pathExpr");
    let d;
    for (let e = 0; e < c.length; e++)
      d = N(c[e], b);
    d !== void 0 && d !== null ? ((b = {type: d.type, g: 2}, b.type !== 59) && L(a, "type", b), a = b) : a = {type: 59, g: 2};
    return a;
  }], ["mapConstructor", (a, b) => {
    K(a, "mapConstructorEntry").map((c) => ({key: N(J(c, ["mapKeyExpr", "*"]), b), value: N(J(c, ["mapValueExpr", "*"]), b)}));
    return Kg(a);
  }], ["arrayConstructor", (a, b) => {
    K(G(a, "*"), "arrayElem").map((c) => N(c, b));
    return tg(a);
  }], ["unaryLookup", (a) => {
    G(a, "NCName");
    return {type: 59, g: 2};
  }], ["typeswitchExpr", (a, b) => {
    const c = N(G(a, "argExpr")[1], b), d = K(a, "typeswitchExprCaseClause").map((f) => N(J(f, ["resultExpr"])[1], b)), e = N(J(a, ["typeswitchExprDefaultClause", "resultExpr"])[1], b);
    return Pg(a, c, d, e);
  }], ["quantifiedExpr", (a, b) => {
    K(a, "*").map((c) => N(c, b));
    return Ng(a);
  }], ["x:stackTrace", (a, b) => {
    a = K(a, "*");
    return N(a[0], b);
  }], ["queryBody", (a, b) => N(a[1], b)], ["flworExpr", (a, b) => Eg(a, b)], ["varRef", (a, b) => {
    const c = rg(G(a, "name"));
    var d;
    a: {
      for (d = b.h; 0 <= d; d--) {
        const e = b.o[d][c.localName];
        if (e) {
          d = e;
          break a;
        }
      }
      d = void 0;
    }
    d && d.type !== 59 && L(a, "type", d);
    c.namespaceURI === null && (b = b.$(c.prefix), b !== void 0 && L(a, "URI", b));
    return d;
  }]]);
  function Fg(a) {
    a.h++;
    a.o.push({});
    a.v.push({});
  }
  function Gg(a, b, c) {
    if (a.o[a.h][b])
      throw Error(`Another variable of in the scope ${a.h} with the same name ${b} already exists`);
    a.o[a.h][b] = c;
  }
  var Zg = class {
    constructor(a) {
      this.h = 0;
      this.ga = a;
      this.o = [{}];
      this.v = [{}];
    }
    $(a) {
      for (let b = this.h; 0 <= b; b--) {
        const c = this.v[b][a];
        if (c !== void 0)
          return c;
      }
      return this.ga ? this.ga.$(a) : void 0;
    }
  };
  var $g = class extends D {
    constructor(a, b) {
      super(new bf({external: 1}), a, {B: a.every((c) => c.B)}, false, b);
      this.l = a;
    }
    h(a, b) {
      return this.l.length === 0 ? w.m(new pb([])) : B(this.l[0], a, b).M((c) => w.m(new pb(c.map((d) => Ra(w.m(d))))));
    }
  };
  var ah = class extends D {
    constructor(a, b) {
      super(new bf({external: 1}), a, {B: a.every((c) => c.B)}, false, b);
      this.l = a;
    }
    h(a, b) {
      return w.m(new pb(this.l.map((c) => Ra(B(c, a, b)))));
    }
  };
  function bh(a) {
    if (a === null)
      throw lc("context is absent, it needs to be present to use axes.");
    if (!v(a.type, 53))
      throw Error("XPTY0020: Axes can only be applied to nodes.");
    return a.value;
  }
  function ch(a, b, c) {
    let d = b;
    return {next: () => {
      if (!d)
        return p;
      const e = d;
      d = x(a, e, c);
      return q(rb(e));
    }};
  }
  var dh = class extends D {
    constructor(a, b) {
      b = b || {Qa: false};
      super(a.o, [a], {P: "reverse-sorted", W: false, subtree: false, B: false});
      this.l = a;
      this.s = !!b.Qa;
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      var c = this.l.D();
      c = c && (c.startsWith("name-") || c === "type-1") ? "type-1" : null;
      return w.create(ch(b, this.s ? a : x(b, a, c), c)).filter((d) => this.l.l(d));
    }
  };
  const eh = new Map([["type-1-or-type-2", ["name", "type-1", "type-2"]], ["type-1", ["name"]], ["type-2", ["name"]]]);
  function fh(a, b) {
    if (a === null)
      return b;
    if (b === null || a === b)
      return a;
    const c = a.startsWith("name-") ? "name" : a, d = b.startsWith("name-") ? "name" : b, e = eh.get(c);
    if (e !== void 0 && e.includes(d))
      return b;
    b = eh.get(d);
    return b !== void 0 && b.includes(c) ? a : "empty";
  }
  var gh = class extends D {
    constructor(a, b) {
      super(new bf({attribute: 1}), [a], {P: "unsorted", subtree: true, W: true, B: false});
      this.l = a;
      this.s = fh(this.l.D(), b);
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      if (a.node.nodeType !== 1)
        return w.empty();
      a = fb(b, a, this.s).filter((c) => c.node.namespaceURI !== "http://www.w3.org/2000/xmlns/").map((c) => rb(c)).filter((c) => this.l.l(c));
      return w.create(a);
    }
    D() {
      return "type-1";
    }
  };
  var hh = class extends D {
    constructor(a, b) {
      super(a.o, [a], {P: "sorted", subtree: true, W: true, B: false});
      this.s = a;
      this.l = fh(b, a.D());
    }
    h(a, b) {
      const c = b.h, d = bh(a.N);
      a = d.node.nodeType;
      if (a !== 1 && a !== 9)
        return w.empty();
      let e = null, f = false;
      return w.create({next: () => {
        for (; !f; ) {
          if (!e) {
            e = jb(c, d, this.l);
            if (!e) {
              f = true;
              continue;
            }
            return q(rb(e));
          }
          if (e = lb(c, e, this.l))
            return q(rb(e));
          f = true;
        }
        return p;
      }}).filter((h) => this.s.l(h));
    }
  };
  function ih(a, b, c) {
    const d = b.node.nodeType;
    if (d !== 1 && d !== 9)
      return {next: () => p};
    let e = jb(a, b, c);
    return {next() {
      if (!e)
        return p;
      const f = e;
      e = lb(a, e, c);
      return q(f);
    }};
  }
  function jh(a, b, c) {
    const d = [kd(b)];
    return {next: (e) => {
      0 < d.length && (e & 1) !== 0 && d.shift();
      if (!d.length)
        return p;
      for (e = d[0].next(0); e.done; ) {
        d.shift();
        if (!d.length)
          return p;
        e = d[0].next(0);
      }
      d.unshift(ih(a, e.value, c));
      return q(rb(e.value));
    }};
  }
  var kh = class extends D {
    constructor(a, b) {
      b = b || {Qa: false};
      super(a.o, [a], {B: false, W: false, P: "sorted", subtree: true});
      this.l = a;
      this.s = !!b.Qa;
      this.A = (a = this.l.D()) && (a.startsWith("name-") || a === "type-1") || a === "type-1-or-type-2" ? "type-1" : null;
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      a = jh(b, a, this.A);
      this.s || a.next(0);
      return w.create(a).filter((c) => this.l.l(c));
    }
  };
  function lh(a, b, c) {
    var d = a.node.nodeType;
    if (d !== 1 && d !== 9)
      return a;
    for (d = kb(b, a, c); d !== null; ) {
      if (d.node.nodeType !== 1)
        return d;
      a = d;
      d = kb(b, a, c);
    }
    return a;
  }
  function mh(a, b, c = false, d) {
    if (c) {
      let f = b, h = false;
      return {next: () => {
        if (h)
          return p;
        if (md(f, b))
          return f = lh(b, a, d), md(f, b) ? (h = true, p) : q(rb(f));
        const k = f.node.nodeType, l = k === 9 || k === 2 ? null : mb(a, f, d);
        if (l !== null)
          return f = lh(l, a, d), q(rb(f));
        f = k === 9 ? null : x(a, f, d);
        return md(f, b) ? (h = true, p) : q(rb(f));
      }};
    }
    const e = [ih(a, b, d)];
    return {next: () => {
      if (!e.length)
        return p;
      let f = e[0].next(0);
      for (; f.done; ) {
        e.shift();
        if (!e.length)
          return p;
        f = e[0].next(0);
      }
      e.unshift(ih(a, f.value, d));
      return q(rb(f.value));
    }};
  }
  function nh(a, b, c) {
    const d = [];
    for (; b && b.node.nodeType !== 9; b = x(a, b, null)) {
      const f = lb(a, b, c);
      f && d.push(f);
    }
    let e = null;
    return {next: () => {
      for (; e || d.length; ) {
        if (!e) {
          e = mh(a, d[0], false, c);
          var f = q(rb(d[0]));
          const h = lb(a, d[0], c);
          h ? d[0] = h : d.shift();
          return f;
        }
        f = e.next(0);
        if (f.done)
          e = null;
        else
          return f;
      }
      return p;
    }};
  }
  var oh = class extends D {
    constructor(a) {
      super(a.o, [a], {P: "sorted", W: true, subtree: false, B: false});
      this.l = a;
      this.s = (a = this.l.D()) && (a.startsWith("name-") || a === "type-1") ? "type-1" : null;
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      return w.create(nh(b, a, this.s)).filter((c) => this.l.l(c));
    }
  };
  function ph(a, b, c) {
    return {next: () => (b = b && lb(a, b, c)) ? q(rb(b)) : p};
  }
  var qh = class extends D {
    constructor(a, b) {
      super(a.o, [a], {P: "sorted", W: true, subtree: false, B: false});
      this.l = a;
      this.s = fh(this.l.D(), b);
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      return w.create(ph(b, a, this.s)).filter((c) => this.l.l(c));
    }
  };
  var rh = class extends D {
    constructor(a, b) {
      super(a.o, [a], {P: "reverse-sorted", W: true, subtree: true, B: false});
      this.l = a;
      this.s = fh(b, this.l.D());
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      a = x(b, a, this.s);
      if (!a)
        return w.empty();
      a = rb(a);
      return this.l.l(a) ? w.m(a) : w.empty();
    }
  };
  function sh(a, b, c) {
    const d = [];
    for (; b && b.node.nodeType !== 9; b = x(a, b, null)) {
      const f = mb(a, b, c);
      f !== null && d.push(f);
    }
    let e = null;
    return {next: () => {
      for (; e || d.length; ) {
        e || (e = mh(a, d[0], true, c));
        var f = e.next(0);
        if (f.done) {
          e = null;
          f = mb(a, d[0], c);
          const h = q(rb(d[0]));
          f === null ? d.shift() : d[0] = f;
          return h;
        }
        return f;
      }
      return p;
    }};
  }
  var th = class extends D {
    constructor(a) {
      super(a.o, [a], {B: false, W: true, P: "reverse-sorted", subtree: false});
      this.l = a;
      this.s = (a = this.l.D()) && (a.startsWith("name-") || a === "type-1") ? "type-1" : null;
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      return w.create(sh(b, a, this.s)).filter((c) => this.l.l(c));
    }
  };
  function uh(a, b, c) {
    return {next: () => (b = b && mb(a, b, c)) ? q(rb(b)) : p};
  }
  var vh = class extends D {
    constructor(a, b) {
      super(a.o, [a], {B: false, W: true, P: "reverse-sorted", subtree: false});
      this.l = a;
      this.s = fh(this.l.D(), b);
    }
    h(a, b) {
      b = b.h;
      a = bh(a.N);
      return w.create(uh(b, a, this.s)).filter((c) => this.l.l(c));
    }
  };
  var wh = class extends D {
    constructor(a, b) {
      super(a.o, [a], {P: "sorted", subtree: true, W: true, B: false});
      this.l = a;
      this.s = fh(this.l.D(), b);
    }
    h(a) {
      bh(a.N);
      return this.l.l(a.N) ? w.m(a.N) : w.empty();
    }
    D() {
      return this.s;
    }
  };
  var xh = class extends Ye {
    constructor(a, b, c, d) {
      super(a.o.add(b.o).add(c.o), [a, b, c], {B: a.B && b.B && c.B, W: b.W === c.W && b.W, P: b.ia === c.ia ? b.ia : "unsorted", subtree: b.subtree === c.subtree && b.subtree}, d);
      this.l = a;
    }
    A(a, b, c) {
      let d = null;
      const e = c[0](a);
      return w.create({next: (f) => {
        d || (d = (e.fa() ? c[1](a) : c[2](a)).value);
        return d.next(f);
      }});
    }
    v(a) {
      super.v(a);
      if (this.l.J)
        throw we();
    }
  };
  function Qf(a) {
    return a.h instanceof Error ? a.location : Qf(a.h);
  }
  function Rf(a) {
    let b;
    b = a.h instanceof Of ? ["Inner error:", a.h.message] : a.h instanceof Error ? [a.h.toString()] : Rf(a.h);
    b.push(`  at <${a.o}>:${a.location.start.line}:${a.location.start.ha} - ${a.location.end.line}:${a.location.end.ha}`);
    return b;
  }
  var yh = class {
    constructor(a, b, c) {
      this.location = a;
      this.o = b;
      this.h = c;
    }
  };
  var zh = class extends Ye {
    constructor(a, b, c) {
      super(c.o, [c], {B: c.B, W: c.W, P: c.ia, subtree: c.subtree});
      this.l = b;
      this.L = {end: {ha: a.end.ha, line: a.end.line, offset: a.end.offset}, start: {ha: a.start.ha, line: a.start.line, offset: a.start.offset}};
    }
    A(a, b, [c]) {
      let d;
      try {
        d = c(a);
      } catch (e) {
        throw new yh(this.L, this.l, e);
      }
      return w.create({next: (e) => {
        try {
          return d.value.next(e);
        } catch (f) {
          throw new yh(this.L, this.l, f);
        }
      }});
    }
    v(a) {
      try {
        super.v(a);
      } catch (b) {
        throw new yh(this.L, this.l, b);
      }
    }
  };
  function Ah(a, b, c, d) {
    let e = [];
    const f = a.L(b, c, d, (k) => {
      if (a.l instanceof Bh) {
        const n = Ah(a.l, b, k, d);
        return We(n, (t) => e = t);
      }
      let l = null;
      return w.create({next: () => {
        for (; ; ) {
          if (!l) {
            var n = k.next(0);
            if (n.done)
              return p;
            n = a.l.s(n.value, d);
            l = We(n, (t) => e = Te(e, t)).value;
          }
          n = l.next(0);
          if (n.done)
            l = null;
          else
            return n;
        }
      }});
    });
    let h = false;
    return {next: () => {
      if (h)
        return p;
      const k = f.O();
      h = true;
      return q(new He(k, e));
    }};
  }
  function Ch(a, b, c, d) {
    return a.L(b, c, d, (e) => {
      if (a.l instanceof Bh)
        return Ch(a.l, b, e, d);
      let f = null;
      return w.create({next: () => {
        for (; ; ) {
          if (!f) {
            var h = e.next(0);
            if (h.done)
              return p;
            f = B(a.l, h.value, d).value;
          }
          h = f.next(0);
          if (h.done)
            f = null;
          else
            return h;
        }
      }});
    });
  }
  var Bh = class extends D {
    constructor(a, b, c, d) {
      super(a, b, c, true);
      this.l = d;
      this.J = this.l.J;
    }
    h(a, b) {
      return this.L(a, kd(a), b, (c) => {
        if (this.l instanceof Bh)
          return Ch(this.l, a, c, b);
        let d = null;
        return w.create({next: (e) => {
          for (; ; ) {
            if (!d) {
              var f = c.next(0);
              if (f.done)
                return p;
              d = B(this.l, f.value, b).value;
            }
            f = d.next(e);
            if (f.done)
              d = null;
            else
              return f;
          }
        }});
      });
    }
    s(a, b) {
      return Ah(this, a, kd(a), b);
    }
    v(a) {
      super.v(a);
      this.J = this.l.J;
      for (const b of this.Ka)
        if (b !== this.l && b.J)
          throw we();
    }
  };
  var Dh = class extends Bh {
    constructor(a, b, c, d) {
      super(b.o.add(d.o), [b, d], {B: false}, d);
      this.S = a.prefix;
      this.ma = a.namespaceURI;
      this.Mb = a.localName;
      this.wb = null;
      this.A = c;
      this.La = null;
      this.xa = b;
    }
    L(a, b, c, d) {
      let e = null, f = null, h = 0;
      return d({next: () => {
        for (; ; ) {
          if (!e) {
            var k = b.next(0);
            if (k.done)
              return p;
            f = k.value;
            h = 0;
            e = B(this.xa, f, c).value;
          }
          const l = e.next(0);
          if (l.done)
            e = null;
          else
            return h++, k = {[this.wb]: () => w.m(l.value)}, this.La && (k[this.La] = () => w.m(new Da(5, h))), q(hc(f, k));
        }
      }});
    }
    v(a) {
      if (this.S && (this.ma = a.$(this.S), !this.ma && this.S))
        throw Error(`XPST0081: Could not resolve namespace for prefix ${this.S} in a for expression`);
      this.xa.v(a);
      kg(a);
      this.wb = og(a, this.ma, this.Mb);
      if (this.A) {
        if (this.A.prefix && (this.A.namespaceURI = a.$(this.A.prefix), !this.A.namespaceURI && this.A.prefix))
          throw Error(`XPST0081: Could not resolve namespace for prefix ${this.S} in the positionalVariableBinding in a for expression`);
        this.La = og(a, this.A.namespaceURI, this.A.localName);
      }
      this.l.v(a);
      qg(a);
      if (this.xa.J)
        throw we();
      this.l.J && (this.J = true);
    }
  };
  var Eh = class extends D {
    constructor(a, b, c) {
      super(new bf({external: 1}), [c], {B: false, P: "unsorted"});
      this.S = a.map(({name: d}) => d);
      this.A = a.map(({type: d}) => d);
      this.s = null;
      this.L = b;
      this.l = c;
    }
    h(a, b) {
      const c = new Va({j: this.A, arity: this.A.length, Xa: true, J: this.l.J, localName: "dynamic-function", namespaceURI: "", i: this.L, value: (d, e, f, ...h) => {
        d = hc(bc(a, -1, null, w.empty()), this.s.reduce((k, l, n) => {
          k[l] = Ra(h[n]);
          return k;
        }, Object.create(null)));
        return B(this.l, d, b);
      }});
      return w.m(c);
    }
    v(a) {
      kg(a);
      this.s = this.S.map((b) => og(a, b.namespaceURI, b.localName));
      this.l.v(a);
      qg(a);
      if (this.l.J)
        throw Error("Not implemented: inline functions can not yet be updating.");
    }
  };
  var Fh = class extends Bh {
    constructor(a, b, c) {
      super(b.o.add(c.o), [b, c], {B: false, W: c.W, P: c.ia, subtree: c.subtree}, c);
      if (a.prefix || a.namespaceURI)
        throw Error("Not implemented: let expressions with namespace usage.");
      this.A = a.prefix;
      this.S = a.namespaceURI;
      this.La = a.localName;
      this.ma = b;
      this.xa = null;
    }
    L(a, b, c, d) {
      return d({next: () => {
        var e = b.next(0);
        if (e.done)
          return p;
        e = e.value;
        e = hc(e, {[this.xa]: Ra(B(this.ma, e, c))});
        return q(e);
      }});
    }
    v(a) {
      if (this.A && (this.S = a.$(this.A), !this.S && this.A))
        throw Error(`XPST0081: Could not resolve namespace for prefix ${this.A} using in a for expression`);
      this.ma.v(a);
      kg(a);
      this.xa = og(a, this.S, this.La);
      this.l.v(a);
      qg(a);
      this.J = this.l.J;
      if (this.ma.J)
        throw we();
    }
  };
  var Gh = class extends D {
    constructor(a, b) {
      super(new bf({}), [], {B: true, P: "sorted"}, false, b);
      let c;
      switch (b.type) {
        case 5:
          c = g(parseInt(a, 10), b.type);
          break;
        case 1:
          c = g(a, b.type);
          break;
        case 4:
        case 3:
          c = g(parseFloat(a), b.type);
          break;
        default:
          throw new TypeError("Type " + b + " not expected in a literal");
      }
      this.l = () => w.m(c);
    }
    h() {
      return this.l();
    }
  };
  var Hh = class extends D {
    constructor(a, b) {
      super(new bf({external: 1}), a.reduce((c, {key: d, value: e}) => c.concat(d, e), []), {B: false}, false, b);
      this.l = a;
    }
    h(a, b) {
      const c = this.l.map((d) => qc(B(d.key, a, b), b).Y({default: () => {
        throw Error("XPTY0004: A key of a map should be a single atomizable value.");
      }, m: (e) => e}));
      return A(c, (d) => w.m(new ub(d.map((e, f) => ({key: e, value: Ra(B(this.l[f].value, a, b))})))));
    }
  };
  var Ih = class extends D {
    constructor(a, b, c) {
      super(new bf({external: 1}), [], {B: true}, false, c);
      this.s = b;
      this.A = a;
      this.l = null;
    }
    h() {
      const a = new Va({j: this.l.j, J: this.l.J, arity: this.s, localName: this.l.localName, namespaceURI: this.l.namespaceURI, i: this.l.i, value: this.l.callFunction});
      return w.m(a);
    }
    v(a) {
      let b = this.A.namespaceURI, c = this.A.localName;
      const d = this.A.prefix;
      if (b === null) {
        const e = a.Sa({localName: c, prefix: d}, this.s);
        if (!e)
          throw Error(`XPST0017: The function ${d ? d + ":" : ""}${c} with arity ${this.s} could not be resolved. ${Uf(c)}`);
        b = e.namespaceURI;
        c = e.localName;
      }
      this.l = a.ta(b, c, this.s) || null;
      if (!this.l)
        throw a = this.A, Error(`XPST0017: Function ${`${a.namespaceURI ? `Q{${a.namespaceURI}}` : a.prefix ? `${a.prefix}:` : ""}${a.localName}`} with arity of ${this.s} not registered. ${Uf(c)}`);
      super.v(a);
    }
  };
  const Jh = {[5]: 5, [27]: 5, [28]: 5, [31]: 5, [32]: 5, [33]: 5, [34]: 5, [30]: 5, [36]: 5, [35]: 5, [38]: 5, [37]: 5, [29]: 5, [4]: 4, [6]: 6, [3]: 3};
  var Kh = class extends D {
    constructor(a, b, c) {
      super(b.o, [b], {B: false}, false, c);
      this.s = b;
      this.l = a;
    }
    h(a, b) {
      return qc(B(this.s, a, b), b).M((c) => {
        if (c.length === 0)
          return w.empty();
        var d = c[0];
        if (this.type)
          return c = this.l === "+" ? +d.value : -d.value, d.type === 0 && (c = Number.NaN), w.m(g(c, this.type.type));
        if (1 < c.length)
          throw Error("XPTY0004: The operand to a unary operator must be a sequence with a length less than one");
        return v(d.type, 19) ? (d = jd(d, 3).value, w.m(g(this.l === "+" ? d : -d, 3))) : v(d.type, 2) ? this.l === "+" ? w.m(d) : w.m(g(-1 * d.value, Jh[d.type])) : w.m(g(Number.NaN, 3));
      });
    }
  };
  var Lh = class extends D {
    constructor(a, b) {
      super(a.reduce((c, d) => c.add(d.o), new bf({})), a, {B: a.every((c) => c.B)}, false, b);
      this.l = a;
      this.s = a.reduce((c, d) => fh(c, d.D()), null);
    }
    h(a, b) {
      let c = 0, d = null, e = false, f = null;
      if (a !== null) {
        const h = a.N;
        h !== null && v(h.type, 53) && (f = Xa(h.value));
      }
      return w.create({next: () => {
        if (!e) {
          for (; c < this.l.length; ) {
            if (!d) {
              const h = this.l[c];
              if (f !== null && h.D() !== null && !f.includes(h.D()))
                return c++, e = true, q(wa);
              d = B(h, a, b);
            }
            if (d.fa() === false)
              return e = true, q(wa);
            d = null;
            c++;
          }
          e = true;
          return q(va);
        }
        return p;
      }});
    }
    D() {
      return this.s;
    }
  };
  var Mh = class extends D {
    constructor(a, b) {
      super(a.reduce((d, e) => 0 < af(d, e.o) ? d : e.o, new bf({})), a, {B: a.every((d) => d.B)}, false, b);
      let c;
      for (b = 0; b < a.length; ++b) {
        c === void 0 && (c = a[b].D());
        if (c === null)
          break;
        if (c !== a[b].D()) {
          c = null;
          break;
        }
      }
      this.s = c;
      this.l = a;
    }
    h(a, b) {
      let c = 0, d = null, e = false, f = null;
      if (a !== null) {
        const h = a.N;
        h !== null && v(h.type, 53) && (f = Xa(h.value));
      }
      return w.create({next: () => {
        if (!e) {
          for (; c < this.l.length; ) {
            if (!d) {
              const h = this.l[c];
              if (f !== null && h.D() !== null && !f.includes(h.D())) {
                c++;
                continue;
              }
              d = B(h, a, b);
            }
            if (d.fa() === true)
              return e = true, q(va);
            d = null;
            c++;
          }
          e = true;
          return q(wa);
        }
        return p;
      }});
    }
    D() {
      return this.s;
    }
  };
  function Nh(a, b) {
    let c;
    return w.create({next: (d) => {
      for (; ; ) {
        if (!c) {
          var e = a.value.next(d);
          if (e.done)
            return p;
          c = pc(e.value, b);
        }
        e = c.value.next(d);
        if (e.done)
          c = null;
        else
          return e;
      }
    }});
  }
  function Oh(a, b) {
    if (a === "eqOp")
      return (c, d) => {
        const {T: e, U: f} = b(c, d);
        return e.value.namespaceURI === f.value.namespaceURI && e.value.localName === f.value.localName;
      };
    if (a === "neOp")
      return (c, d) => {
        const {T: e, U: f} = b(c, d);
        return e.value.namespaceURI !== f.value.namespaceURI || e.value.localName !== f.value.localName;
      };
    throw Error('XPTY0004: Only the "eq" and "ne" comparison is defined for xs:QName');
  }
  function Ph(a, b) {
    switch (a) {
      case "eqOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value === f.value;
        };
      case "neOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value !== f.value;
        };
      case "ltOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value < f.value;
        };
      case "leOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value <= f.value;
        };
      case "gtOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value > f.value;
        };
      case "geOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value >= f.value;
        };
    }
  }
  function Qh(a, b) {
    switch (a) {
      case "ltOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value.ea < f.value.ea;
        };
      case "leOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value) || e.value.ea < f.value.ea;
        };
      case "gtOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value.ea > f.value.ea;
        };
      case "geOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value) || e.value.ea > f.value.ea;
        };
    }
  }
  function Rh(a, b) {
    switch (a) {
      case "eqOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value);
        };
      case "ltOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value.ca < f.value.ca;
        };
      case "leOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value) || e.value.ca < f.value.ca;
        };
      case "gtOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return e.value.ca > f.value.ca;
        };
      case "geOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value) || e.value.ca > f.value.ca;
        };
    }
  }
  function Sh(a, b) {
    switch (a) {
      case "eqOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return vb(e.value, f.value);
        };
      case "neOp":
        return (c, d) => {
          const {T: e, U: f} = b(c, d);
          return !vb(e.value, f.value);
        };
    }
  }
  function Th(a, b) {
    switch (a) {
      case "eqOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          return Ob(f.value, h.value, fc(e));
        };
      case "neOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          return !Ob(f.value, h.value, fc(e));
        };
      case "ltOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          c = fc(e);
          return 0 > Nb(f.value, h.value, c);
        };
      case "leOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          (c = Ob(f.value, h.value, fc(e))) || (e = fc(e), c = 0 > Nb(f.value, h.value, e));
          return c;
        };
      case "gtOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          c = fc(e);
          return 0 < Nb(f.value, h.value, c);
        };
      case "geOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          (c = Ob(f.value, h.value, fc(e))) || (e = fc(e), c = 0 < Nb(f.value, h.value, e));
          return c;
        };
    }
  }
  function Uh(a, b) {
    switch (a) {
      case "eqOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          return Ob(f.value, h.value, fc(e));
        };
      case "neOp":
        return (c, d, e) => {
          const {T: f, U: h} = b(c, d);
          return !Ob(f.value, h.value, fc(e));
        };
    }
  }
  function Vh(a, b, c) {
    function d(n, t) {
      return {T: h ? h(n) : n, U: k ? k(t) : t};
    }
    function e(n) {
      return v(b, n) && v(c, n);
    }
    function f(n) {
      return 0 < n.filter((t) => v(b, t)).length && 0 < n.filter((t) => v(c, t)).length;
    }
    let h = null, k = null;
    v(b, 19) && v(c, 19) ? b = c = 1 : v(b, 19) ? (h = (n) => jd(n, c), b = c) : v(c, 19) && (k = (n) => jd(n, b), c = b);
    if (v(b, 23) && v(c, 23))
      return Oh(a, d);
    if (e(0) || f([1, 47, 61]) || f([2, 47, 61]) || e(20) || e(22) || e(21) || f([1, 20])) {
      var l = Ph(a, d);
      if (l !== void 0)
        return l;
    }
    if (e(16) && (l = Qh(a, d), l !== void 0) || e(17) && (l = Rh(a, d), l !== void 0) || e(18) && (l = Sh(a, d), l !== void 0))
      return l;
    if (e(9) || e(7) || e(8)) {
      if (l = Th(a, d), l !== void 0)
        return l;
    }
    if (e(11) || e(12) || e(13) || e(14) || e(15)) {
      if (l = Uh(a, d), l !== void 0)
        return l;
    }
    throw Error(`XPTY0004: ${a} not available for ${Ea[b]} and ${Ea[c]}`);
  }
  const Wh = Object.create(null);
  function Xh(a, b, c) {
    const d = `${b}~${c}~${a}`;
    let e = Wh[d];
    e || (e = Wh[d] = Vh(a, b, c));
    return e;
  }
  var Yh = class extends D {
    constructor(a, b, c) {
      super(b.o.add(c.o), [b, c], {B: false});
      this.l = b;
      this.A = c;
      this.s = a;
    }
    h(a, b) {
      const c = B(this.l, a, b), d = B(this.A, a, b), e = Nh(c, b), f = Nh(d, b);
      return e.Y({empty: () => w.empty(), m: () => f.Y({empty: () => w.empty(), m: () => {
        const h = e.first(), k = f.first();
        return Xh(this.s, h.type, k.type)(h, k, a) ? w.aa() : w.V();
      }, multiple: () => {
        throw Error("XPTY0004: Sequences to compare are not singleton.");
      }}), multiple: () => {
        throw Error("XPTY0004: Sequences to compare are not singleton.");
      }});
    }
  };
  const Zh = {equalOp: "eqOp", notEqualOp: "neOp", lessThanOrEqualOp: "leOp", lessThanOp: "ltOp", greaterThanOrEqualOp: "geOp", greaterThanOp: "gtOp"};
  function $h(a, b, c, d) {
    a = Zh[a];
    return c.M((e) => b.filter((f) => {
      for (let l = 0, n = e.length; l < n; ++l) {
        let t = e[l], u = void 0, y = void 0;
        var h = f.type, k = t.type;
        if (v(h, 19) || v(k, 19))
          v(h, 2) ? u = 3 : v(k, 2) ? y = 3 : v(h, 17) ? u = 17 : v(k, 17) ? y = 17 : v(h, 16) ? u = 16 : v(k, 16) ? y = 16 : v(h, 19) ? y = k : v(k, 19) && (u = h);
        const [z, F] = [y, u];
        h = z;
        k = F;
        h ? f = jd(f, h) : k && (t = jd(t, k));
        if (Xh(a, f.type, t.type)(f, t, d))
          return true;
      }
      return false;
    }).Y({default: () => w.aa(), empty: () => w.V()}));
  }
  var ai = class extends D {
    constructor(a, b, c) {
      super(b.o.add(c.o), [b, c], {B: false});
      this.l = b;
      this.A = c;
      this.s = a;
    }
    h(a, b) {
      const c = B(this.l, a, b), d = B(this.A, a, b);
      return c.Y({empty: () => w.V(), default: () => d.Y({empty: () => w.V(), default: () => {
        const e = Nh(c, b), f = Nh(d, b);
        return $h(this.s, e, f, a);
      }})});
    }
  };
  function bi(a, b, c, d) {
    if (!v(c, 53) || !v(d, 53))
      throw Error("XPTY0004: Sequences to compare are not nodes");
    switch (a) {
      case "isOp":
        return ci(c, d);
      case "nodeBeforeOp":
        return b ? (e, f) => 0 > sd(b, e.first(), f.first()) : void 0;
      case "nodeAfterOp":
        return b ? (e, f) => 0 < sd(b, e.first(), f.first()) : void 0;
      default:
        throw Error("Unexpected operator");
    }
  }
  function ci(a, b) {
    return a !== b || a !== 47 && a !== 53 && a !== 54 && a !== 55 && a !== 56 && a !== 57 && a !== 58 ? () => false : (c, d) => md(c.first().value, d.first().value);
  }
  var di = class extends D {
    constructor(a, b, c) {
      super(b.o.add(c.o), [b, c], {B: false});
      this.l = b;
      this.A = c;
      this.s = a;
    }
    h(a, b) {
      const c = B(this.l, a, b), d = B(this.A, a, b);
      return c.Y({empty: () => w.empty(), multiple: () => {
        throw Error("XPTY0004: Sequences to compare are not singleton");
      }, m: () => d.Y({empty: () => w.empty(), multiple: () => {
        throw Error("XPTY0004: Sequences to compare are not singleton");
      }, m: () => {
        const e = c.first(), f = d.first();
        return bi(this.s, b.h, e.type, f.type)(c, d, a) ? w.aa() : w.V();
      }})});
    }
  };
  function ei(a, b, c, d) {
    return c.M((e) => {
      if (e.some((f) => !v(f.type, 53)))
        throw Error(`XPTY0004: Sequences given to ${a} should only contain nodes.`);
      return d === "sorted" ? w.create(e) : d === "reverse-sorted" ? w.create(e.reverse()) : w.create(td(b, e));
    });
  }
  var fi = class extends D {
    constructor(a, b, c, d) {
      super(0 < af(b.o, c.o) ? b.o : c.o, [b, c], {B: b.B && c.B}, false, d);
      this.l = a;
      this.s = b;
      this.A = c;
    }
    h(a, b) {
      const c = ei(this.l, b.h, B(this.s, a, b), this.s.ia);
      a = ei(this.l, b.h, B(this.A, a, b), this.A.ia);
      const d = c.value, e = a.value;
      let f = null, h = null, k = false, l = false;
      return w.create({next: () => {
        if (k)
          return p;
        for (; !l; ) {
          if (!f) {
            var n = d.next(0);
            if (n.done)
              return k = true, p;
            f = n.value;
          }
          if (!h) {
            n = e.next(0);
            if (n.done) {
              l = true;
              break;
            }
            h = n.value;
          }
          if (md(f.value, h.value)) {
            if (n = q(f), h = f = null, this.l === "intersectOp")
              return n;
          } else if (0 > sd(b.h, f, h)) {
            if (n = q(f), f = null, this.l === "exceptOp")
              return n;
          } else
            h = null;
        }
        if (this.l === "exceptOp")
          return f !== null ? (n = q(f), f = null, n) : d.next(0);
        k = true;
        return p;
      }});
    }
  };
  var gi = class extends Ye {
    constructor(a, b) {
      super(a.reduce((c, d) => c.add(d.o), new bf({})), a, {P: "unsorted", B: a.every((c) => c.B)}, b);
    }
    A(a, b, c) {
      return c.length ? jc(c.map((d) => d(a))) : w.empty();
    }
  };
  var hi = class extends D {
    constructor(a, b, c) {
      super(new bf({}).add(a.o), [a, b], {B: a.B && b.B}, false, c);
      this.l = a;
      this.s = b;
    }
    h(a, b) {
      const c = B(this.l, a, b), d = dc(a, c);
      let e = null, f = null, h = false;
      return w.create({next: (k) => {
        for (; !h; ) {
          if (!e && (e = d.next(k), e.done))
            return h = true, p;
          f || (f = B(this.s, e.value, b));
          const l = f.value.next(k);
          if (l.done)
            e = f = null;
          else
            return l;
        }
      }});
    }
  };
  var ii = class extends D {
    constructor(a, b, c) {
      super(a.o, [a], {B: false});
      this.l = Ia(b.prefix ? `${b.prefix}:${b.localName}` : b.localName);
      if (this.l === 46 || this.l === 45 || this.l === 44)
        throw Error("XPST0080: Casting to xs:anyAtomicType, xs:anySimpleType or xs:NOTATION is not permitted.");
      if (b.namespaceURI)
        throw Error("Not implemented: castable as expressions with a namespace URI.");
      this.A = a;
      this.s = c;
    }
    h(a, b) {
      const c = qc(B(this.A, a, b), b);
      return c.Y({empty: () => this.s ? w.aa() : w.V(), m: () => c.map((d) => id(d, this.l).u ? va : wa), multiple: () => w.V()});
    }
  };
  var ji = class extends D {
    constructor(a, b, c) {
      super(a.o, [a], {B: false});
      this.l = Ia(b.prefix ? `${b.prefix}:${b.localName}` : b.localName);
      if (this.l === 46 || this.l === 45 || this.l === 44)
        throw Error("XPST0080: Casting to xs:anyAtomicType, xs:anySimpleType or xs:NOTATION is not permitted.");
      if (b.namespaceURI)
        throw Error("Not implemented: casting expressions with a namespace URI.");
      this.A = a;
      this.s = c;
    }
    h(a, b) {
      const c = qc(B(this.A, a, b), b);
      return c.Y({empty: () => {
        if (!this.s)
          throw Error("XPTY0004: Sequence to cast is empty while target type is singleton.");
        return w.empty();
      }, m: () => c.map((d) => jd(d, this.l)), multiple: () => {
        throw Error("XPTY0004: Sequence to cast is not singleton or empty.");
      }});
    }
  };
  function ki(a, b) {
    const c = a.value;
    let d = null, e = false;
    return w.create({next: () => {
      for (; !e; ) {
        if (!d) {
          var f = c.next(0);
          if (f.done)
            return e = true, q(va);
          d = b(f.value);
        }
        f = d.fa();
        d = null;
        if (f === false)
          return e = true, q(wa);
      }
      return p;
    }});
  }
  var li = class extends D {
    constructor(a, b, c, d) {
      super(a.o, [a], {B: false}, false, d);
      this.A = a;
      this.s = b;
      this.l = c;
    }
    h(a, b) {
      const c = B(this.A, a, b);
      return c.Y({empty: () => this.l === "?" || this.l === "*" ? w.aa() : w.V(), multiple: () => this.l === "+" || this.l === "*" ? ki(c, (d) => {
        const e = w.m(d);
        d = bc(a, 0, d, e);
        return B(this.s, d, b);
      }) : w.V(), m: () => ki(c, (d) => {
        const e = w.m(d);
        d = bc(a, 0, d, e);
        return B(this.s, d, b);
      })});
    }
  };
  function mi(a, b) {
    return a !== null && b !== null && v(a.type, 53) && v(b.type, 53) ? md(a.value, b.value) : false;
  }
  function ni(a) {
    let b = a.next(0);
    if (b.done)
      return w.empty();
    let c = null, d = null;
    return w.create({next(e) {
      if (b.done)
        return p;
      c || (c = b.value.value);
      let f;
      do
        if (f = c.next(e), f.done) {
          b = a.next(0);
          if (b.done)
            return f;
          c = b.value.value;
        }
      while (f.done || mi(f.value, d));
      d = f.value;
      return f;
    }});
  }
  function oi(a, b) {
    const c = [];
    (function() {
      for (var f = b.next(0); !f.done; ) {
        const h = f.value.value;
        f = {current: h.next(0), next: (k) => h.next(k)};
        f.current.done || c.push(f);
        f = b.next(0);
      }
    })();
    let d = null, e = false;
    return w.create({[Symbol.iterator]() {
      return this;
    }, next: () => {
      e || (e = true, c.every((h) => v(h.current.value.type, 53)) && c.sort((h, k) => sd(a, h.current.value, k.current.value)));
      let f;
      do {
        if (!c.length)
          return p;
        const h = c.shift();
        f = h.current;
        h.current = h.next(0);
        if (!v(f.value.type, 53))
          return f;
        if (!h.current.done) {
          let k = 0, l = c.length - 1, n = 0;
          for (; k <= l; ) {
            n = Math.floor((k + l) / 2);
            const t = sd(a, h.current.value, c[n].current.value);
            if (t === 0) {
              k = n;
              break;
            }
            0 < t ? k = n + 1 : l = n - 1;
          }
          c.splice(k, 0, h);
        }
      } while (mi(f.value, d));
      d = f.value;
      return f;
    }});
  }
  var pi = class extends D {
    constructor(a, b) {
      super(a.reduce((c, d) => 0 < af(c, d.o) ? c : d.o, new bf({})), a, {B: a.every((c) => c.B)}, false, b);
      this.l = a;
    }
    h(a, b) {
      if (this.l.every((c) => c.ia === "sorted")) {
        let c = 0;
        return oi(b.h, {next: () => c >= this.l.length ? p : q(B(this.l[c++], a, b))}).map((d) => {
          if (!v(d.type, 53))
            throw Error("XPTY0004: The sequences to union are not of type node()*");
          return d;
        });
      }
      return jc(this.l.map((c) => B(c, a, b))).M((c) => {
        if (c.some((d) => !v(d.type, 53)))
          throw Error("XPTY0004: The sequences to union are not of type node()*");
        c = td(b.h, c);
        return w.create(c);
      });
    }
  };
  function qi(a) {
    return a.every((b) => b === null || v(b.type, 5) || v(b.type, 4)) || a.map((b) => b ? rc(b.type) : null).reduce((b, c) => c === null ? b : c === b ? b : null) !== null ? a : a.every((b) => b === null || v(b.type, 1) || v(b.type, 20)) ? a.map((b) => b ? jd(b, 1) : null) : a.every((b) => b === null || v(b.type, 4) || v(b.type, 6)) ? a.map((b) => b ? jd(b, 6) : b) : a.every((b) => b === null || v(b.type, 4) || v(b.type, 6) || v(b.type, 3)) ? a.map((b) => b ? jd(b, 3) : b) : null;
  }
  function ri(a) {
    return (a = a.find((b) => !!b)) ? rc(a.type) : null;
  }
  var si = class extends Bh {
    constructor(a, b) {
      super(new bf({}), [b, ...a.map((c) => c.ba)], {B: false, W: false, P: "unsorted", subtree: false}, b);
      this.A = a;
    }
    L(a, b, c, d) {
      if (this.A[1])
        throw Error("More than one order spec is not supported for the order by clause.");
      const e = [];
      let f = false, h, k, l = null;
      const n = this.A[0];
      return w.create({next: () => {
        if (!f) {
          for (var t = b.next(0); !t.done; )
            e.push(t.value), t = b.next(0);
          t = e.map((y) => n.ba.h(y, c)).map((y) => qc(y, c));
          if (t.find((y) => !y.G() && !y.sa()))
            throw Error("XPTY0004: Order by only accepts empty or singleton sequences");
          h = t.map((y) => y.first());
          h = h.map((y) => y === null ? y : v(19, y.type) ? jd(y, 1) : y);
          if (ri(h) && (h = qi(h), !h))
            throw Error("XPTY0004: Could not cast values");
          t = h.length;
          k = h.map((y, z) => z);
          for (let y = 0; y < t; y++)
            if (y + 1 !== t)
              for (let z = y; 0 <= z; z--) {
                const F = z, O = z + 1;
                if (O === t)
                  continue;
                const U = h[k[F]], ba = h[k[O]];
                if (ba !== null || U !== null) {
                  if (n.$b) {
                    if (U === null)
                      continue;
                    if (ba === null && U !== null) {
                      [k[F], k[O]] = [k[O], k[F]];
                      continue;
                    }
                    if (isNaN(ba.value) && U !== null && !isNaN(U.value)) {
                      [k[F], k[O]] = [k[O], k[F]];
                      continue;
                    }
                  } else {
                    if (ba === null)
                      continue;
                    if (U === null && ba !== null) {
                      [k[F], k[O]] = [k[O], k[F]];
                      continue;
                    }
                    if (isNaN(U.value) && ba !== null && !isNaN(ba.value)) {
                      [k[F], k[O]] = [k[O], k[F]];
                      continue;
                    }
                  }
                  Xh("gtOp", U.type, ba.type)(U, ba, a) && ([k[F], k[O]] = [k[O], k[F]]);
                }
              }
          let u = n.zb ? 0 : h.length - 1;
          l = d({next: () => n.zb ? u >= h.length ? p : q(e[k[u++]]) : 0 > u ? p : q(e[k[u--]])}).value;
          f = true;
        }
        return l.next(0);
      }});
    }
  };
  var ti = class extends D {
    constructor(a) {
      super(a ? a.o : new bf({}), a ? [a] : [], {P: "sorted", subtree: false, W: false, B: false});
      this.l = a;
    }
    h(a, b) {
      if (a.N === null)
        throw lc("context is absent, it needs to be present to use paths.");
      var c = b.h;
      let d = a.N.value;
      for (; d.node.nodeType !== 9; )
        if (d = x(c, d), d === null)
          throw Error("XPDY0050: the root node of the context node is not a document node.");
      c = w.m(rb(d));
      return this.l ? B(this.l, bc(a, 0, c.first(), c), b) : c;
    }
  };
  var ui = class extends D {
    constructor(a) {
      super(new bf({}), [], {P: "sorted"}, false, a);
    }
    h(a) {
      if (a.N === null)
        throw lc('context is absent, it needs to be present to use the "." operator');
      return w.m(a.N);
    }
  };
  function vi(a, b) {
    let c = false, d = false;
    b.forEach((e) => {
      v(e.type, 53) ? c = true : d = true;
    });
    if (d && c)
      throw Error("XPTY0018: The path operator should either return nodes or non-nodes. Mixed sequences are not allowed.");
    return c ? td(a, b) : b;
  }
  var wi = class extends D {
    constructor(a, b) {
      const c = a.every((e) => e.W), d = a.every((e) => e.subtree);
      super(a.reduce((e, f) => e.add(f.o), new bf({})), a, {B: false, W: c, P: b ? "sorted" : "unsorted", subtree: d});
      this.l = a;
      this.s = b;
    }
    h(a, b) {
      let c = true;
      return this.l.reduce((d, e, f) => {
        const h = d === null ? kd(a) : dc(a, d);
        d = {next: (l) => {
          l = h.next(l);
          if (l.done)
            return p;
          if (l.value.N !== null && !v(l.value.N.type, 53) && 0 < f)
            throw Error("XPTY0019: The result of E1 in a path expression E1/E2 should not evaluate to a sequence of nodes.");
          return q(B(e, l.value, b));
        }};
        let k;
        if (this.s)
          switch (e.ia) {
            case "reverse-sorted":
              const l = d;
              d = {next: (n) => {
                n = l.next(n);
                return n.done ? n : q(n.value.M((t) => w.create(t.reverse())));
              }};
            case "sorted":
              if (e.subtree && c) {
                k = ni(d);
                break;
              }
              k = oi(b.h, d);
              break;
            case "unsorted":
              return ni(d).M((n) => w.create(vi(b.h, n)));
          }
        else
          k = ni(d);
        c = c && e.W;
        return k;
      }, null);
    }
    D() {
      return this.l[0].D();
    }
  };
  var xi = class extends D {
    constructor(a, b) {
      super(a.o.add(b.o), [a, b], {B: a.B && b.B, W: a.W, P: a.ia, subtree: a.subtree});
      this.s = a;
      this.l = b;
    }
    h(a, b) {
      const c = B(this.s, a, b);
      if (this.l.B) {
        const k = B(this.l, a, b);
        if (k.G())
          return k;
        const l = k.first();
        if (v(l.type, 2)) {
          let n = l.value;
          if (!Number.isInteger(n))
            return w.empty();
          const t = c.value;
          let u = false;
          return w.create({next: () => {
            if (!u) {
              for (let y = t.next(0); !y.done; y = t.next(0))
                if (n-- === 1)
                  return u = true, y;
              u = true;
            }
            return p;
          }});
        }
        return k.fa() ? c : w.empty();
      }
      const d = c.value;
      let e = null, f = 0, h = null;
      return w.create({next: (k) => {
        let l = false;
        for (; !e || !e.done; ) {
          e || (e = d.next(l ? 0 : k), l = true);
          if (e.done)
            break;
          h || (h = B(this.l, bc(a, f, e.value, c), b));
          var n = h.first();
          n = n === null ? false : v(n.type, 2) ? n.value === f + 1 : h.fa();
          h = null;
          const t = e.value;
          e = null;
          f++;
          if (n)
            return q(t);
        }
        return e;
      }});
    }
    D() {
      return this.s.D();
    }
  };
  function yi(a, b, c) {
    c = [c];
    if (v(a.type, 62))
      if (b === "*")
        c.push(...a.h.map((d) => d()));
      else if (v(b.type, 5)) {
        const d = b.value;
        if (a.h.length < d || 0 >= d)
          throw Error("FOAY0001: Array index out of bounds");
        c.push(a.h[d - 1]());
      } else
        throw Error("XPTY0004: The key specifier is not an integer.");
    else if (v(a.type, 61))
      b === "*" ? c.push(...a.h.map((d) => d.value())) : (a = a.h.find((d) => sb(d.key, b))) && c.push(a.value());
    else
      throw Error("XPTY0004: The provided context item is not a map or an array.");
    return jc(c);
  }
  function zi(a, b, c, d, e) {
    if (b === "*")
      return yi(a, b, c);
    b = B(b, d, e);
    b = Ra(b)().M((f) => f.reduce((h, k) => yi(a, k, h), new Ca()));
    return jc([c, b]);
  }
  var Ai = class extends D {
    constructor(a, b) {
      super(a.o, [a].concat(b === "*" ? [] : [b]), {B: a.B, P: a.ia, subtree: a.subtree});
      this.l = a;
      this.s = b;
    }
    h(a, b) {
      return B(this.l, a, b).M((c) => c.reduce((d, e) => zi(e, this.s, d, a, b), new Ca()));
    }
    D() {
      return this.l.D();
    }
  };
  var Bi = class extends D {
    constructor(a, b) {
      super(new bf({external: 1}), a === "*" ? [] : [a], {B: false}, false, b);
      this.l = a;
    }
    h(a, b) {
      return zi(a.N, this.l, new Ca(), a, b);
    }
  };
  var Ci = class extends D {
    constructor(a, b, c, d) {
      const e = b.map((f) => f.eb);
      b = b.map((f) => f.name);
      super(e.reduce((f, h) => f.add(h.o), c.o), e.concat(c), {B: false}, false, d);
      this.s = a;
      this.A = b;
      this.L = e;
      this.S = c;
      this.l = null;
    }
    h(a, b) {
      let c = a;
      const d = this.l.map((k, l) => {
        const n = B(this.L[l], c, b).O();
        c = hc(a, {[k]: () => w.create(n)});
        return n;
      });
      if (d.some((k) => k.length === 0))
        return this.s === "every" ? w.aa() : w.V();
      const e = Array(d.length).fill(0);
      e[0] = -1;
      for (var f = true; f; ) {
        f = false;
        for (let k = 0, l = e.length; k < l; ++k) {
          var h = d[k];
          if (++e[k] > h.length - 1)
            e[k] = 0;
          else {
            f = Object.create(null);
            for (h = 0; h < e.length; h++) {
              const n = d[h][e[h]];
              f[this.l[h]] = () => w.m(n);
            }
            f = hc(a, f);
            f = B(this.S, f, b);
            if (f.fa() && this.s === "some")
              return w.aa();
            if (!f.fa() && this.s === "every")
              return w.V();
            f = true;
            break;
          }
        }
      }
      return this.s === "every" ? w.aa() : w.V();
    }
    v(a) {
      this.l = [];
      for (let c = 0, d = this.A.length; c < d; ++c) {
        this.L[c].v(a);
        kg(a);
        var b = this.A[c];
        const e = b.prefix ? a.$(b.prefix) : null;
        b = og(a, e, b.localName);
        this.l[c] = b;
      }
      this.S.v(a);
      for (let c = 0, d = this.A.length; c < d; ++c)
        qg(a);
    }
  };
  var Di = class extends D {
    constructor(a) {
      super(a, [], {B: false});
    }
    h(a) {
      return this.l(a.N) ? w.aa() : w.V();
    }
  };
  var Ei = class extends Di {
    constructor(a) {
      super(new bf({nodeType: 1}));
      this.s = a;
    }
    l(a) {
      if (!v(a.type, 53))
        return false;
      a = a.value.node.nodeType;
      return this.s === 3 && a === 4 ? true : this.s === a;
    }
    D() {
      return `type-${this.s}`;
    }
  };
  var Fi = class extends Di {
    constructor(a, b = {kind: null}) {
      const c = a.prefix, d = a.namespaceURI;
      a = a.localName;
      const e = {};
      a !== "*" && (e.nodeName = 1);
      e.nodeType = 1;
      super(new bf(e));
      this.s = a;
      this.L = d;
      this.A = c;
      this.S = b.kind;
    }
    l(a) {
      const b = v(a.type, 54), c = v(a.type, 47);
      if (!b && !c)
        return false;
      a = a.value;
      return this.S !== null && (this.S === 1 && !b || this.S === 2 && !c) ? false : this.A === null && this.L !== "" && this.s === "*" ? true : this.A === "*" ? this.s === "*" ? true : this.s === a.node.localName : this.s !== "*" && this.s !== a.node.localName ? false : (a.node.namespaceURI || null) === ((this.A === "" ? b ? this.L : null : this.L) || null);
    }
    D() {
      return this.s === "*" ? this.S === null ? "type-1-or-type-2" : `type-${this.S}` : `name-${this.s}`;
    }
    v(a) {
      if (this.L === null && this.A !== "*" && (this.L = a.$(this.A || "") || null, !this.L && this.A))
        throw Error(`XPST0081: The prefix ${this.A} could not be resolved.`);
    }
  };
  var Gi = class extends Di {
    constructor(a) {
      super(new bf({nodeName: 1}));
      this.s = a;
    }
    l(a) {
      return v(a.type, 57) && a.value.node.target === this.s;
    }
    D() {
      return "type-7";
    }
  };
  var Hi = class extends Di {
    constructor(a) {
      super(new bf({}));
      this.s = a;
    }
    l(a) {
      return v(a.type, Ia(this.s.prefix ? this.s.prefix + ":" + this.s.localName : this.s.localName));
    }
  };
  var Ii = class extends D {
    constructor(a, b, c) {
      super(new bf({}), [], {B: false, P: "unsorted"});
      this.A = c;
      this.s = b;
      this.L = a;
      this.l = null;
    }
    h(a, b) {
      if (!a.wa[this.l]) {
        if (this.S)
          return this.S(a, b);
        throw Error("XQDY0054: The variable " + this.A + " is declared but not in scope.");
      }
      return a.wa[this.l]();
    }
    v(a) {
      this.s === null && this.L && (this.s = a.$(this.L));
      this.l = a.cb(this.s || "", this.A);
      if (!this.l)
        throw Error("XPST0008, The variable " + this.A + " is not in scope.");
      if (a = a.Da[this.l])
        this.S = a;
    }
  };
  var Ji = class extends Bh {
    constructor(a, b) {
      super(new bf({}), [a, b], {B: false, W: false, P: "unsorted", subtree: false}, b);
      this.A = a;
    }
    L(a, b, c, d) {
      let e = null, f = null;
      return d({next: () => {
        for (; ; ) {
          if (!f) {
            var h = b.next(0);
            if (h.done)
              return p;
            e = h.value;
            f = B(this.A, e, c);
          }
          h = f.fa();
          const k = e;
          f = e = null;
          if (h)
            return q(k);
        }
      }});
    }
  };
  var Ki = class {
    constructor(a) {
      this.type = a;
    }
  };
  var Li = class extends Ki {
    constructor(a) {
      super("delete");
      this.target = a;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false)};
    }
  };
  var Mi = class extends Ki {
    constructor(a, b, c) {
      super(c);
      this.target = a;
      this.content = b;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), content: this.content.map((b) => If(b, a, true))};
    }
  };
  var Ni = class extends Mi {
    constructor(a, b) {
      super(a, b, "insertAfter");
    }
  };
  var Oi = class extends Ki {
    constructor(a, b) {
      super("insertAttributes");
      this.target = a;
      this.content = b;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), content: this.content.map((b) => If(b, a, true))};
    }
  };
  var Pi = class extends Mi {
    constructor(a, b) {
      super(a, b, "insertBefore");
    }
  };
  var Qi = class extends Mi {
    constructor(a, b) {
      super(a, b, "insertIntoAsFirst");
    }
  };
  var Ri = class extends Mi {
    constructor(a, b) {
      super(a, b, "insertIntoAsLast");
    }
  };
  var Si = class extends Mi {
    constructor(a, b) {
      super(a, b, "insertInto");
    }
  };
  var Ti = class extends Ki {
    constructor(a, b) {
      super("rename");
      this.target = a;
      this.o = b.ya ? b : new Ta(b.prefix, b.namespaceURI, b.localName);
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), newName: {prefix: this.o.prefix, namespaceURI: this.o.namespaceURI, localName: this.o.localName}};
    }
  };
  var Ui = class extends Ki {
    constructor(a, b) {
      super("replaceElementContent");
      this.target = a;
      this.text = b;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), text: this.text ? If(this.text, a, true) : null};
    }
  };
  var Vi = class extends Ki {
    constructor(a, b) {
      super("replaceNode");
      this.target = a;
      this.o = b;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), replacement: this.o.map((b) => If(b, a, true))};
    }
  };
  var Wi = class extends Ki {
    constructor(a, b) {
      super("replaceValue");
      this.target = a;
      this.o = b;
    }
    h(a) {
      return {type: this.type, target: If(this.target, a, false), ["string-value"]: this.o};
    }
  };
  var Xi = (a, b) => new Vi(a, b);
  var Yi = class extends Ve {
    constructor(a) {
      super(new bf({}), [a], {B: false, P: "unsorted"});
      this.l = a;
    }
    s(a, b) {
      const c = Ue(this.l)(a, b), d = b.h;
      let e, f;
      return {next: () => {
        if (!e) {
          const h = c.next(0);
          if (h.value.I.some((k) => !v(k.type, 53)))
            throw Error("XUTY0007: The target of a delete expression must be a sequence of zero or more nodes.");
          e = h.value.I;
          f = h.value.da;
        }
        e = e.filter((h) => x(d, h.value));
        return q({da: Te(e.map((h) => new Li(h.value)), f), I: []});
      }};
    }
  };
  function Zi(a, b, c, d, e, f) {
    const h = b.h;
    a.reduce(function t(l, n) {
      if (v(n.type, 62))
        return n.h.forEach((u) => u().O().forEach((y) => t(l, y))), l;
      l.push(n);
      return l;
    }, []).forEach((l, n, t) => {
      if (v(l.type, 47)) {
        if (e)
          throw f(l.value, h);
        c.push(l.value.node);
      } else if (v(l.type, 46) || v(l.type, 53) && l.value.node.nodeType === 3) {
        const u = v(l.type, 46) ? jd(pc(l, b).first(), 1).value : ib(h, l.value);
        n !== 0 && v(t[n - 1].type, 46) && v(l.type, 46) ? (d.push({data: " " + u, Ra: true, nodeType: 3}), e = true) : u && (d.push({data: "" + u, Ra: true, nodeType: 3}), e = true);
      } else if (v(l.type, 55)) {
        const u = [];
        hb(h, l.value).forEach((y) => u.push(rb(y)));
        e = Zi(u, b, c, d, e, f);
      } else if (v(l.type, 53))
        d.push(l.value.node), e = true;
      else {
        if (v(l.type, 60))
          throw nc(l.type);
        throw Error(`Atomizing ${l.type} is not implemented.`);
      }
    });
    return e;
  }
  function $i(a, b, c) {
    const d = [], e = [];
    let f = false;
    a.forEach((h) => {
      f = Zi(h, b, d, e, f, c);
    });
    return {attributes: d, Wa: e};
  }
  function aj(a, b, c, d, e) {
    const f = [];
    switch (a) {
      case 4:
        d.length && f.push(new Oi(b, d));
        e.length && f.push(new Qi(b, e));
        break;
      case 5:
        d.length && f.push(new Oi(b, d));
        e.length && f.push(new Ri(b, e));
        break;
      case 3:
        d.length && f.push(new Oi(b, d));
        e.length && f.push(new Si(b, e));
        break;
      case 2:
        d.length && f.push(new Oi(c, d));
        e.length && f.push(new Pi(b, e));
        break;
      case 1:
        d.length && f.push(new Oi(c, d)), e.length && f.push(new Ni(b, e));
    }
    return f;
  }
  var bj = class extends Ve {
    constructor(a, b, c) {
      super(new bf({}), [a, c], {B: false, P: "unsorted"});
      this.L = a;
      this.l = b;
      this.A = c;
    }
    s(a, b) {
      const c = Ue(this.L)(a, b), d = Ue(this.A)(a, b), e = b.h;
      let f, h, k, l, n, t;
      return {next: () => {
        if (!f) {
          var u = c.next(0);
          const y = $i([u.value.I], b, xe);
          f = y.attributes.map((z) => ({node: z, F: null}));
          h = y.Wa.map((z) => ({node: z, F: null}));
          k = u.value.da;
        }
        if (!l) {
          u = d.next(0);
          if (u.value.I.length === 0)
            throw Ge();
          if (3 <= this.l) {
            if (u.value.I.length !== 1)
              throw ye();
            if (!v(u.value.I[0].type, 54) && !v(u.value.I[0].type, 55))
              throw ye();
          } else {
            if (u.value.I.length !== 1)
              throw ze();
            if (!(v(u.value.I[0].type, 54) || v(u.value.I[0].type, 56) || v(u.value.I[0].type, 58) || v(u.value.I[0].type, 57)))
              throw ze();
            t = x(e, u.value.I[0].value, null);
            if (t === null)
              throw Error(`XUDY0029: The target ${u.value.I[0].value.outerHTML} for inserting a node before or after must have a parent.`);
          }
          l = u.value.I[0];
          n = u.value.da;
        }
        if (f.length) {
          if (3 <= this.l) {
            if (!v(l.type, 54))
              throw Error("XUTY0022: An insert expression specifies the insertion of an attribute node into a document node.");
          } else if (t.node.nodeType !== 1)
            throw Error("XUDY0030: An insert expression specifies the insertion of an attribute node before or after a child of a document node.");
          f.reduce((y, z) => {
            const F = z.node.prefix || "";
            var O = z.node.prefix || "";
            const U = z.node.namespaceURI, ba = O ? l.value.node.lookupNamespaceURI(O) : null;
            if (ba && ba !== U)
              throw Ee(U);
            if ((O = y[O]) && U !== O)
              throw Fe(U);
            y[F] = z.node.namespaceURI;
            return y;
          }, {});
        }
        return q({I: [], da: Te(aj(this.l, l.value, t ? t : null, f, h), k, n)});
      }};
    }
  };
  const cj = () => mc("Casting not supported from given type to a single xs:string or xs:untypedAtomic or any of its derived types."), dj = /([A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]|[\uD800-\uDB7F][\uDC00-\uDFFF])/, ej = new RegExp(`${dj.source}${new RegExp(`(${dj.source}|[-.0-9\xB7\u0300-\u036F\u203F\u2040])`).source}*`, "g"), fj = (a) => (a = a.match(ej)) ? a.length === 1 : false;
  function gj(a, b) {
    return qc(b, a).Y({m: (c) => {
      c = c.first();
      if (v(c.type, 1) || v(c.type, 19)) {
        if (!fj(c.value))
          throw Error(`XQDY0041: The value "${c.value}" of a name expressions cannot be converted to a NCName.`);
        return w.m(c);
      }
      throw cj();
    }, default: () => {
      throw cj();
    }}).value;
  }
  function hj(a, b, c) {
    return qc(c, b).Y({m: (d) => {
      d = d.first();
      if (v(d.type, 23))
        return w.m(d);
      if (v(d.type, 1) || v(d.type, 19)) {
        let e, f;
        d = d.value.split(":");
        d.length === 1 ? d = d[0] : (e = d[0], f = a.$(e), d = d[1]);
        if (!fj(d) || e && !fj(e))
          throw fg(e ? `${e}:${d}` : d);
        if (e && !f)
          throw fg(`${e}:${d}`);
        return w.m({type: 23, value: new Ta(e, f, d)});
      }
      throw cj();
    }, default: () => {
      throw cj();
    }}).value;
  }
  var ij = class extends Ve {
    constructor(a, b) {
      super(new bf({}), [a, b], {B: false, P: "unsorted"});
      this.A = a;
      this.L = b;
      this.l = void 0;
    }
    s(a, b) {
      const c = Ue(this.A)(a, b), d = Ue(this.L)(a, b);
      return {next: () => {
        const e = c.next(0);
        var f = e.value.I;
        if (f.length === 0)
          throw Ge();
        if (f.length !== 1)
          throw Be();
        if (!v(f[0].type, 54) && !v(f[0].type, 47) && !v(f[0].type, 57))
          throw Be();
        f = f[0];
        const h = d.next(0);
        a: {
          var k = this.l;
          var l = w.create(h.value.I);
          switch (f.type) {
            case 54:
              k = hj(k, b, l).next(0).value.value;
              if ((l = f.value.node.lookupNamespaceURI(k.prefix)) && l !== k.namespaceURI)
                throw Ee(k.namespaceURI);
              break a;
            case 47:
              k = hj(k, b, l).next(0).value.value;
              if (k.namespaceURI && (l = f.value.node.lookupNamespaceURI(k.prefix)) && l !== k.namespaceURI)
                throw Ee(k.namespaceURI);
              break a;
            case 57:
              k = gj(b, l).next(0).value.value;
              k = new Ta("", null, k);
              break a;
          }
          k = void 0;
        }
        return q({I: [], da: Te([new Ti(f.value, k)], e.value.da, h.value.da)});
      }};
    }
    v(a) {
      this.l = gf(a);
      super.v(a);
    }
  };
  function jj(a, b, c) {
    let d, e, f;
    return {next: () => {
      if (!d) {
        var h = c.next(0), k = $i([h.value.I], a, Fe);
        d = {attributes: k.attributes.map((l) => ({node: l, F: null})), Wa: k.Wa.map((l) => ({node: l, F: null}))};
        e = h.value.da;
      }
      k = b.next(0);
      if (k.value.I.length === 0)
        throw Ge();
      if (k.value.I.length !== 1)
        throw Ae();
      if (!(v(k.value.I[0].type, 54) || v(k.value.I[0].type, 47) || v(k.value.I[0].type, 56) || v(k.value.I[0].type, 58) || v(k.value.I[0].type, 57)))
        throw Ae();
      f = x(a.h, k.value.I[0].value, null);
      if (f === null)
        throw Error(`XUDY0009: The target ${k.value.I[0].value.outerHTML} for replacing a node must have a parent.`);
      h = k.value.I[0];
      k = k.value.da;
      if (v(h.type, 47)) {
        if (d.Wa.length)
          throw Error("XUTY0011: When replacing an attribute the new value must be zero or more attribute nodes.");
        d.attributes.reduce((l, n) => {
          const t = n.node.prefix || "";
          n = n.node.namespaceURI;
          var u = f.node.lookupNamespaceURI(t);
          if (u && u !== n)
            throw Ee(n);
          if ((u = l[t]) && n !== u)
            throw Fe(n);
          l[t] = n;
          return l;
        }, {});
      } else if (d.attributes.length)
        throw Error("XUTY0010: When replacing an an element, text, comment, or processing instruction node the new value must be a single node.");
      return q({I: [], da: Te([Xi(h.value, [].concat(d.attributes, d.Wa))], e, k)});
    }};
  }
  function kj(a, b, c) {
    let d, e, f, h, k = false;
    return {next: () => {
      if (k)
        return p;
      if (!f) {
        var l = c.next(0);
        const n = qc(w.create(l.value.I), a).map((t) => jd(t, 1)).O().map((t) => t.value).join(" ");
        f = n.length === 0 ? null : {node: a.Ia.createTextNode(n), F: null};
        h = l.value.da;
      }
      if (!d) {
        l = b.next(0);
        if (l.value.I.length === 0)
          throw Ge();
        if (l.value.I.length !== 1)
          throw Ae();
        if (!(v(l.value.I[0].type, 54) || v(l.value.I[0].type, 47) || v(l.value.I[0].type, 56) || v(l.value.I[0].type, 58) || v(l.value.I[0].type, 57)))
          throw Ae();
        d = l.value.I[0];
        e = l.value.da;
      }
      if (v(d.type, 54))
        return k = true, q({I: [], da: Te([new Ui(d.value, f)], h, e)});
      if (v(d.type, 47) || v(d.type, 56) || v(d.type, 58) || v(d.type, 57)) {
        l = f ? ib(a.h, f) : "";
        if (v(d.type, 58) && (l.includes("--") || l.endsWith("-")))
          throw Error(`XQDY0072: The content "${l}" for a comment node contains two adjacent hyphens or ends with a hyphen.`);
        if (v(d.type, 57) && l.includes("?>"))
          throw Error(`XQDY0026: The content "${l}" for a processing instruction node contains "?>".`);
        k = true;
        return q({I: [], da: Te([new Wi(d.value, l)], h, e)});
      }
    }};
  }
  var lj = class extends Ve {
    constructor(a, b, c) {
      super(new bf({}), [b, c], {B: false, P: "unsorted"});
      this.L = a;
      this.l = b;
      this.A = c;
    }
    s(a, b) {
      const c = Ue(this.l)(a, b);
      a = Ue(this.A)(a, b);
      return this.L ? kj(b, c, a) : jj(b, c, a);
    }
  };
  function yj(a) {
    switch (a.type) {
      case "delete":
        return new Li({node: a.target, F: null});
      case "insertAfter":
        return new Ni({node: a.target, F: null}, a.content.map((b) => ({node: b, F: null})));
      case "insertBefore":
        return new Pi({node: a.target, F: null}, a.content.map((b) => ({node: b, F: null})));
      case "insertInto":
        return new Si({node: a.target, F: null}, a.content.map((b) => ({node: b, F: null})));
      case "insertIntoAsFirst":
        return new Qi({node: a.target, F: null}, a.content.map((b) => ({node: b, F: null})));
      case "insertIntoAsLast":
        return new Ri({
          node: a.target,
          F: null
        }, a.content.map((b) => ({node: b, F: null})));
      case "insertAttributes":
        return new Oi({node: a.target, F: null}, a.content.map((b) => ({node: b, F: null})));
      case "rename":
        return new Ti({node: a.target, F: null}, a.newName);
      case "replaceNode":
        return new Vi({node: a.target, F: null}, a.replacement.map((b) => ({node: b, F: null})));
      case "replaceValue":
        return new Wi({node: a.target, F: null}, a["string-value"]);
      case "replaceElementContent":
        return new Ui({node: a.target, F: null}, a.text ? {node: a.text, F: null} : null);
      default:
        throw Error(`Unexpected type "${a.type}" when parsing a transferable pending update.`);
    }
  }
  function zj(a, b, c) {
    if (b.find((e) => md(e, a)))
      return true;
    const d = x(c, a);
    return d ? zj(d, b, c) : false;
  }
  var Aj = class extends Ve {
    constructor(a, b, c) {
      super(new bf({}), a.reduce((d, e) => {
        d.push(e.eb);
        return d;
      }, [b, c]), {B: false, P: "unsorted"});
      this.l = a;
      this.L = b;
      this.A = c;
      this.J = null;
    }
    h(a, b) {
      a = this.s(a, b);
      return We(a, () => {
      });
    }
    s(a, b) {
      const c = b.h, d = b.Ia, e = b.Ma, f = [];
      let h, k, l;
      const n = [], t = [];
      return {next: () => {
        if (n.length !== this.l.length)
          for (var u = n.length; u < this.l.length; u++) {
            const z = this.l[u];
            var y = f[u];
            y || (f[u] = y = Ue(z.eb)(a, b));
            y = y.next(0);
            if (y.value.I.length !== 1 || !v(y.value.I[0].type, 53))
              throw Error("XUTY0013: The source expression of a copy modify expression must return a single node.");
            const F = rb(Ef(y.value.I[0].value, b));
            n.push(F.value);
            t.push(y.value.da);
            a = hc(a, {[z.dc]: () => w.m(F)});
          }
        l || (h || (h = Ue(this.L)(a, b)), l = h.next(0).value.da);
        l.forEach((z) => {
          if (z.target && !zj(z.target, n, c))
            throw Error(`XUDY0014: The target ${z.target.node.outerHTML} must be a node created by the copy clause.`);
          if (z.type === "put")
            throw Error("XUDY0037: The modify expression of a copy modify expression can not contain a fn:put.");
        });
        u = l.map((z) => {
          z = z.h(b);
          return yj(z);
        });
        Se(u, c, d, e);
        k || (k = Ue(this.A)(a, b));
        u = k.next(0);
        return q({
          I: u.value.I,
          da: Te(u.value.da, ...t)
        });
      }};
    }
    v(a) {
      kg(a);
      this.l.forEach((b) => b.dc = og(a, b.Gb.namespaceURI, b.Gb.localName));
      super.v(a);
      qg(a);
      this.J = this.l.some((b) => b.eb.J) || this.A.J;
    }
  };
  function Bj(a, b) {
    return {node: {nodeType: 2, Ra: true, nodeName: a.ya(), namespaceURI: a.namespaceURI, prefix: a.prefix, localName: a.localName, name: a.ya(), value: b}, F: null};
  }
  var Cj = class extends D {
    constructor(a, b) {
      let c = b.mb || [];
      c = c.concat(a.Na || []);
      super(new bf({}), c, {B: false, P: "unsorted"});
      a.Na ? this.s = a.Na : this.name = new Ta(a.prefix, a.namespaceURI, a.localName);
      this.l = b;
      this.A = void 0;
    }
    h(a, b) {
      let c, d, e, f = false;
      return w.create({next: () => {
        if (f)
          return p;
        if (!d) {
          if (this.s) {
            if (!c) {
              var h = this.s.h(a, b);
              c = hj(this.A, b, h);
            }
            d = c.next(0).value.value;
          } else
            d = this.name;
          if (d) {
            if (d.prefix === "xmlns")
              throw $f(d);
            if (d.prefix === "" && d.localName === "xmlns")
              throw $f(d);
            if (d.namespaceURI === "http://www.w3.org/2000/xmlns/")
              throw $f(d);
            if (d.prefix === "xml" && d.namespaceURI !== "http://www.w3.org/XML/1998/namespace")
              throw $f(d);
            if (d.prefix !== "" && d.prefix !== "xml" && d.namespaceURI === "http://www.w3.org/XML/1998/namespace")
              throw $f(d);
          }
        }
        if (this.l.mb)
          return h = this.l.mb, e || (e = jc(h.map((k) => qc(k.h(a, b), b).M((l) => w.m(g(l.map((n) => n.value).join(" "), 1))))).M((k) => w.m(rb(Bj(d, k.map((l) => l.value).join(""))))).value), e.next(0);
        f = true;
        return q(rb(Bj(d, this.l.value)));
      }});
    }
    v(a) {
      this.A = gf(a);
      if (this.name && this.name.prefix && !this.name.namespaceURI) {
        const b = a.$(this.name.prefix);
        if (b === void 0 && this.name.prefix)
          throw oc(this.name.prefix);
        this.name.namespaceURI = b || null;
      }
      super.v(a);
    }
  };
  var Dj = class extends D {
    constructor(a) {
      super(a ? a.o : new bf({}), a ? [a] : [], {B: false, P: "unsorted"});
      this.l = a;
    }
    h(a, b) {
      const c = {data: "", Ra: true, nodeType: 8}, d = {node: c, F: null};
      if (!this.l)
        return w.m(rb(d));
      a = B(this.l, a, b);
      return qc(a, b).M((e) => {
        e = e.map((f) => jd(f, 1).value).join(" ");
        if (e.indexOf("-->") !== -1)
          throw Error('XQDY0072: The contents of the data of a comment may not include "-->"');
        c.data = e;
        return w.m(rb(d));
      });
    }
  };
  var Ej = class extends D {
    constructor(a, b, c, d) {
      super(new bf({}), d.concat(b).concat(a.Na || []), {B: false, P: "unsorted"});
      a.Na ? this.s = a.Na : this.l = new Ta(a.prefix, a.namespaceURI, a.localName);
      this.S = c.reduce((e, f) => {
        if (f.prefix in e)
          throw Error(`XQST0071: The namespace declaration with the prefix ${f.prefix} has already been declared on the constructed element.`);
        e[f.prefix || ""] = f.uri;
        return e;
      }, {});
      this.L = b;
      this.ma = d;
      this.A = void 0;
    }
    h(a, b) {
      let c = false, d, e, f = false, h, k, l, n = false;
      return w.create({next: () => {
        if (n)
          return p;
        c || (d || (d = jc(this.L.map((F) => B(F, a, b)))), e = d.O(), c = true);
        if (!f) {
          h || (h = this.ma.map((F) => B(F, a, b)));
          var t = [];
          for (var u = 0; u < h.length; u++) {
            var y = h[u].O();
            t.push(y);
          }
          k = t;
          f = true;
        }
        this.s && (l || (t = this.s.h(a, b), l = hj(this.A, b, t)), this.l = l.next(0).value.value);
        if (this.l.prefix === "xmlns" || this.l.namespaceURI === "http://www.w3.org/2000/xmlns/" || this.l.prefix === "xml" && this.l.namespaceURI !== "http://www.w3.org/XML/1998/namespace" || this.l.prefix && this.l.prefix !== "xml" && this.l.namespaceURI === "http://www.w3.org/XML/1998/namespace")
          throw Error(`XQDY0096: The node name "${this.l.ya()}" is invalid for a computed element constructor.`);
        const z = {nodeType: 1, Ra: true, attributes: [], childNodes: [], nodeName: this.l.ya(), namespaceURI: this.l.namespaceURI, prefix: this.l.prefix, localName: this.l.localName};
        t = {node: z, F: null};
        e.forEach((F) => {
          z.attributes.push(F.value.node);
        });
        u = $i(k, b, Zf);
        u.attributes.forEach((F) => {
          if (z.attributes.find((O) => O.namespaceURI === F.namespaceURI && O.localName === F.localName))
            throw Error(`XQDY0025: The attribute ${F.name} does not have an unique name in the constructed element.`);
          z.attributes.push(F);
        });
        u.Wa.forEach((F) => {
          z.childNodes.push(F);
        });
        for (u = 0; u < z.childNodes.length; u++) {
          y = z.childNodes[u];
          if (!cb(y) || y.nodeType !== 3)
            continue;
          const F = z.childNodes[u - 1];
          F && cb(F) && F.nodeType === 3 && (F.data += y.data, z.childNodes.splice(u, 1), u--);
        }
        n = true;
        return q(rb(t));
      }});
    }
    v(a) {
      kg(a);
      Object.keys(this.S).forEach((b) => ng(a, b, this.S[b]));
      this.Ka.forEach((b) => b.v(a));
      this.L.reduce((b, c) => {
        if (c.name) {
          c = `Q{${c.name.namespaceURI === null ? a.$(c.name.prefix) : c.name.namespaceURI}}${c.name.localName}`;
          if (b.includes(c))
            throw Error(`XQST0040: The attribute ${c} does not have an unique name in the constructed element.`);
          b.push(c);
        }
        return b;
      }, []);
      if (this.l && this.l.namespaceURI === null) {
        const b = a.$(this.l.prefix);
        if (b === void 0 && this.l.prefix)
          throw oc(this.l.prefix);
        this.l.namespaceURI = b;
      }
      this.A = gf(a);
      qg(a);
    }
  };
  function Fj(a) {
    if (/^xml$/i.test(a))
      throw Error(`XQDY0064: The target of a created PI may not be "${a}"`);
  }
  function Gj(a, b) {
    return {node: {data: b, Ra: true, nodeName: a, nodeType: 7, target: a}, F: null};
  }
  var Hj = class extends D {
    constructor(a, b) {
      const c = a.vb ? [a.vb].concat(b) : [b];
      super(c.reduce((d, e) => d.add(e.o), new bf({})), c, {B: false, P: "unsorted"});
      this.l = a;
      this.s = b;
    }
    h(a, b) {
      const c = B(this.s, a, b);
      return qc(c, b).M((d) => {
        const e = d.map((h) => jd(h, 1).value).join(" ");
        if (e.indexOf("?>") !== -1)
          throw Error('XQDY0026: The contents of the data of a processing instruction may not include "?>"');
        if (this.l.Db !== null)
          return d = this.l.Db, Fj(d), w.m(rb(Gj(d, e)));
        d = B(this.l.vb, a, b);
        const f = gj(b, d);
        return w.create({next: () => {
          var h = f.next(0);
          if (h.done)
            return h;
          h = h.value.value;
          Fj(h);
          return q(rb(Gj(h, e)));
        }});
      });
    }
  };
  var Ij = class extends D {
    constructor(a) {
      super(a ? a.o : new bf({}), a ? [a] : [], {B: false, P: "unsorted"});
      this.l = a;
    }
    h(a, b) {
      if (!this.l)
        return w.empty();
      a = B(this.l, a, b);
      return qc(a, b).M((c) => {
        if (c.length === 0)
          return w.empty();
        c = {node: {data: c.map((d) => jd(d, 1).value).join(" "), Ra: true, nodeType: 3}, F: null};
        return w.m(rb(c));
      });
    }
  };
  var Jj = class extends Ye {
    constructor(a, b, c, d) {
      super(new bf({}), [a, ...b.map((e) => e.Xb), c].concat(...b.map((e) => e.Fb.map((f) => f.Eb))), {B: false, W: false, P: "unsorted", subtree: false}, d);
      this.L = a;
      this.l = b.length;
      this.S = b.map((e) => e.Fb);
    }
    A(a, b, c) {
      return c[0](a).M((d) => {
        for (let e = 0; e < this.l; e++)
          if (this.S[e].some((f) => {
            switch (f.bc) {
              case "?":
                if (1 < d.length)
                  return false;
                break;
              case "*":
                break;
              case "+":
                if (1 > d.length)
                  return false;
                break;
              default:
                if (d.length !== 1)
                  return false;
            }
            const h = w.create(d);
            return d.every((k, l) => {
              k = bc(a, l, k, h);
              return B(f.Eb, k, b).fa();
            });
          }))
            return c[e + 1](a);
        return c[this.l + 1](a);
      });
    }
    v(a) {
      super.v(a);
      if (this.L.J)
        throw we();
    }
  };
  var Kj = {Z: false, qa: false}, Lj = {Z: true, qa: false}, Mj = {Z: true, qa: true};
  function P(a) {
    return a.Z ? a.qa ? Mj : Lj : Kj;
  }
  function Q(a, b) {
    switch (a[0]) {
      case "andOp":
        var c = I(a, "type");
        return new Lh(Nj("andOp", a, P(b)), c);
      case "orOp":
        return c = I(a, "type"), new Mh(Nj("orOp", a, P(b)), c);
      case "unaryPlusOp":
        return c = G(G(a, "operand"), "*"), a = I(a, "type"), new Kh("+", Q(c, b), a);
      case "unaryMinusOp":
        return c = G(G(a, "operand"), "*"), a = I(a, "type"), new Kh("-", Q(c, b), a);
      case "addOp":
      case "subtractOp":
      case "multiplyOp":
      case "divOp":
      case "idivOp":
      case "modOp":
        var d = a[0], e = Q(J(a, ["firstOperand", "*"]), P(b));
        b = Q(J(a, ["secondOperand", "*"]), P(b));
        const f = I(a, "type"), h = I(J(a, ["firstOperand", "*"]), "type"), k = I(J(a, ["secondOperand", "*"]), "type");
        h && k && I(a, "type") && (c = zg(d, h.type, k.type));
        return new Dg(d, e, b, f, c);
      case "sequenceExpr":
        return Oj(a, b);
      case "unionOp":
        return c = I(a, "type"), new pi([Q(J(a, ["firstOperand", "*"]), P(b)), Q(J(a, ["secondOperand", "*"]), P(b))], c);
      case "exceptOp":
      case "intersectOp":
        return c = I(a, "type"), new fi(a[0], Q(J(a, ["firstOperand", "*"]), P(b)), Q(J(a, ["secondOperand", "*"]), P(b)), c);
      case "stringConcatenateOp":
        return Pj(a, b);
      case "rangeSequenceExpr":
        return Qj(a, b);
      case "equalOp":
      case "notEqualOp":
      case "lessThanOrEqualOp":
      case "lessThanOp":
      case "greaterThanOrEqualOp":
      case "greaterThanOp":
        return Rj("generalCompare", a, b);
      case "eqOp":
      case "neOp":
      case "ltOp":
      case "leOp":
      case "gtOp":
      case "geOp":
        return Rj("valueCompare", a, b);
      case "isOp":
      case "nodeBeforeOp":
      case "nodeAfterOp":
        return Rj("nodeCompare", a, b);
      case "pathExpr":
        return Sj(a, b);
      case "contextItemExpr":
        return new ui(I(a, "type"));
      case "functionCallExpr":
        return Tj(a, b);
      case "inlineFunctionExpr":
        return Uj(a, b);
      case "arrowExpr":
        return Vj(a, b);
      case "dynamicFunctionInvocationExpr":
        return Wj(a, b);
      case "namedFunctionRef":
        return b = G(a, "functionName"), c = I(a, "type"), a = H(J(a, ["integerConstantExpr", "value"])), new Ih(rg(b), parseInt(a, 10), c);
      case "integerConstantExpr":
        return new Gh(H(G(a, "value")), {type: 5, g: 3});
      case "stringConstantExpr":
        return new Gh(H(G(a, "value")), {type: 1, g: 3});
      case "decimalConstantExpr":
        return new Gh(H(G(a, "value")), {type: 4, g: 3});
      case "doubleConstantExpr":
        return new Gh(H(G(a, "value")), {type: 3, g: 3});
      case "varRef":
        const {prefix: l, namespaceURI: n, localName: t} = rg(G(a, "name"));
        return new Ii(l, n, t);
      case "flworExpr":
        return Xj(a, b);
      case "quantifiedExpr":
        return Yj(a, b);
      case "ifThenElseExpr":
        return c = I(a, "type"), new xh(Q(G(G(a, "ifClause"), "*"), P(b)), Q(G(G(a, "thenClause"), "*"), b), Q(G(G(a, "elseClause"), "*"), b), c);
      case "instanceOfExpr":
        return c = Q(J(a, ["argExpr", "*"]), b), d = J(a, ["sequenceType", "*"]), e = J(a, ["sequenceType", "occurrenceIndicator"]), a = I(a, "type"), new li(c, Q(d, P(b)), e ? H(e) : "", a);
      case "castExpr":
        return b = Q(G(G(a, "argExpr"), "*"), P(b)), c = G(a, "singleType"), a = rg(G(c, "atomicType")), c = G(c, "optional") !== null, new ji(b, a, c);
      case "castableExpr":
        return b = Q(G(G(a, "argExpr"), "*"), P(b)), c = G(a, "singleType"), a = rg(G(c, "atomicType")), c = G(c, "optional") !== null, new ii(b, a, c);
      case "simpleMapExpr":
        return Zj(a, b);
      case "mapConstructor":
        return ak(a, b);
      case "arrayConstructor":
        return bk(a, b);
      case "unaryLookup":
        return c = I(a, "type"), new Bi(ck(a, b), c);
      case "typeswitchExpr":
        return dk(a, b);
      case "elementConstructor":
        return ek(a, b);
      case "attributeConstructor":
        return fk(a, b);
      case "computedAttributeConstructor":
        return (c = G(a, "tagName")) ? c = rg(c) : (c = G(a, "tagNameExpr"), c = {Na: Q(G(c, "*"), P(b))}), a = Q(G(G(a, "valueExpr"), "*"), P(b)), new Cj(c, {mb: [a]});
      case "computedCommentConstructor":
        if (!b.Z)
          throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
        a = (a = G(a, "argExpr")) ? Q(G(a, "*"), P(b)) : null;
        return new Dj(a);
      case "computedTextConstructor":
        if (!b.Z)
          throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
        a = (a = G(a, "argExpr")) ? Q(G(a, "*"), P(b)) : null;
        return new Ij(a);
      case "computedElementConstructor":
        return gk(a, b);
      case "computedPIConstructor":
        if (!b.Z)
          throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
        c = G(a, "piTargetExpr");
        d = G(a, "piTarget");
        e = G(a, "piValueExpr");
        a = I(a, "type");
        return new Hj({vb: c ? Q(G(c, "*"), P(b)) : null, Db: d ? H(d) : null}, e ? Q(G(e, "*"), P(b)) : new gi([], a));
      case "CDataSection":
        return new Gh(H(a), {type: 1, g: 3});
      case "deleteExpr":
        return a = Q(J(a, ["targetExpr", "*"]), b), new Yi(a);
      case "insertExpr":
        c = Q(J(a, ["sourceExpr", "*"]), b);
        e = K(a, "*")[1];
        switch (e[0]) {
          case "insertAfter":
            d = 1;
            break;
          case "insertBefore":
            d = 2;
            break;
          case "insertInto":
            d = (d = G(e, "*")) ? d[0] === "insertAsFirst" ? 4 : 5 : 3;
        }
        a = Q(J(a, ["targetExpr", "*"]), b);
        return new bj(c, d, a);
      case "renameExpr":
        return c = Q(J(a, ["targetExpr", "*"]), b), a = Q(J(a, ["newNameExpr", "*"]), b), new ij(c, a);
      case "replaceExpr":
        return c = !!G(a, "replaceValue"), d = Q(J(a, ["targetExpr", "*"]), b), a = Q(J(a, ["replacementExpr", "*"]), b), new lj(c, d, a);
      case "transformExpr":
        return hk(a, b);
      case "x:stackTrace":
        c = a[1];
        for (a = a[2]; a[0] === "x:stackTrace"; )
          a = a[2];
        return new zh(c, a[0], Q(a, b));
      default:
        return ik(a);
    }
  }
  function ik(a) {
    switch (a[0]) {
      case "nameTest":
        return new Fi(rg(a));
      case "piTest":
        return (a = G(a, "piTarget")) ? new Gi(H(a)) : new Ei(7);
      case "commentTest":
        return new Ei(8);
      case "textTest":
        return new Ei(3);
      case "documentTest":
        return new Ei(9);
      case "attributeTest":
        var b = (a = G(a, "attributeName")) && G(a, "star");
        return !a || b ? new Ei(2) : new Fi(rg(G(a, "QName")), {kind: 2});
      case "elementTest":
        return b = (a = G(a, "elementName")) && G(a, "star"), !a || b ? new Ei(1) : new Fi(rg(G(a, "QName")), {kind: 1});
      case "anyKindTest":
        return new Hi({
          prefix: "",
          namespaceURI: null,
          localName: "node()"
        });
      case "anyMapTest":
        return new Hi({prefix: "", namespaceURI: null, localName: "map(*)"});
      case "anyArrayTest":
        return new Hi({prefix: "", namespaceURI: null, localName: "array(*)"});
      case "Wildcard":
        return G(a, "star") ? (b = G(a, "uri")) ? a = new Fi({localName: "*", namespaceURI: H(b), prefix: ""}) : (b = G(a, "NCName"), a = G(a, "*")[0] === "star" ? new Fi({localName: H(b), namespaceURI: null, prefix: "*"}) : new Fi({localName: "*", namespaceURI: null, prefix: H(b)})) : a = new Fi({
          localName: "*",
          namespaceURI: null,
          prefix: "*"
        }), a;
      case "atomicType":
        return new Hi(rg(a));
      case "anyItemType":
        return new Hi({prefix: "", namespaceURI: null, localName: "item()"});
      default:
        throw Error("No selector counterpart for: " + a[0] + ".");
    }
  }
  function bk(a, b) {
    const c = I(a, "type");
    a = G(a, "*");
    const d = K(a, "arrayElem").map((e) => Q(G(e, "*"), P(b)));
    switch (a[0]) {
      case "curlyArray":
        return new $g(d, c);
      case "squareArray":
        return new ah(d, c);
      default:
        throw Error("Unrecognized arrayType: " + a[0]);
    }
  }
  function ak(a, b) {
    const c = I(a, "type");
    return new Hh(K(a, "mapConstructorEntry").map((d) => ({key: Q(J(d, ["mapKeyExpr", "*"]), P(b)), value: Q(J(d, ["mapValueExpr", "*"]), P(b))})), c);
  }
  function Nj(a, b, c) {
    function d(f) {
      const h = G(G(f, "firstOperand"), "*");
      f = G(G(f, "secondOperand"), "*");
      h[0] === a ? d(h) : e.push(Q(h, c));
      f[0] === a ? d(f) : e.push(Q(f, c));
    }
    const e = [];
    d(b);
    return e;
  }
  function ck(a, b) {
    a = G(a, "*");
    switch (a[0]) {
      case "NCName":
        return new Gh(H(a), {type: 1, g: 3});
      case "star":
        return "*";
      default:
        return Q(a, P(b));
    }
  }
  function Rj(a, b, c) {
    var d = J(b, ["firstOperand", "*"]);
    const e = J(b, ["secondOperand", "*"]);
    d = Q(d, P(c));
    c = Q(e, P(c));
    switch (a) {
      case "valueCompare":
        return new Yh(b[0], d, c);
      case "nodeCompare":
        return new di(b[0], d, c);
      case "generalCompare":
        return new ai(b[0], d, c);
    }
  }
  function jk(a, b, c) {
    a = K(a, "*");
    return new si(a.filter((d) => d[0] !== "stable").map((d) => {
      var e = G(d, "orderModifier"), f = e ? G(e, "orderingKind") : null;
      e = e ? G(e, "emptyOrderingMode") : null;
      f = f ? H(f) === "ascending" : true;
      e = e ? H(e) === "empty least" : true;
      return {ba: Q(J(d, ["orderByExpr", "*"]), b), zb: f, $b: e};
    }), c);
  }
  function Xj(a, b) {
    var c = K(a, "*");
    a = G(c[c.length - 1], "*");
    c = c.slice(0, -1);
    if (1 < c.length && !b.Z)
      throw Error("XPST0003: Use of XQuery FLWOR expressions in XPath is no allowed");
    return c.reduceRight((d, e) => {
      switch (e[0]) {
        case "forClause":
          e = K(e, "*");
          for (var f = e.length - 1; 0 <= f; --f) {
            var h = e[f], k = J(h, ["forExpr", "*"]);
            const l = G(h, "positionalVariableBinding");
            d = new Dh(rg(J(h, ["typedVariableBinding", "varName"])), Q(k, P(b)), l ? rg(l) : null, d);
          }
          return d;
        case "letClause":
          e = K(e, "*");
          for (f = e.length - 1; 0 <= f; --f)
            h = e[f], k = J(h, ["letExpr", "*"]), d = new Fh(rg(J(h, ["typedVariableBinding", "varName"])), Q(k, P(b)), d);
          return d;
        case "whereClause":
          e = K(e, "*");
          for (f = e.length - 1; 0 <= f; --f)
            d = new Ji(Q(e[f], b), d);
          return d;
        case "windowClause":
          throw Error(`Not implemented: ${e[0]} is not implemented yet.`);
        case "groupByClause":
          throw Error(`Not implemented: ${e[0]} is not implemented yet.`);
        case "orderByClause":
          return jk(e, b, d);
        case "countClause":
          throw Error(`Not implemented: ${e[0]} is not implemented yet.`);
        default:
          throw Error(`Not implemented: ${e[0]} is not supported in a flwor expression`);
      }
    }, Q(a, b));
  }
  function Tj(a, b) {
    const c = G(a, "functionName"), d = K(G(a, "arguments"), "*");
    a = I(a, "type");
    return new hf(new Ih(rg(c), d.length, a), d.map((e) => e[0] === "argumentPlaceholder" ? null : Q(e, b)), a);
  }
  function Vj(a, b) {
    const c = I(a, "type");
    var d = J(a, ["argExpr", "*"]);
    a = K(a, "*").slice(1);
    d = [Q(d, b)];
    for (let f = 0; f < a.length; f++)
      if (a[f][0] !== "arguments") {
        if (a[f + 1][0] === "arguments") {
          var e = K(a[f + 1], "*");
          d = d.concat(e.map((h) => h[0] === "argumentPlaceholder" ? null : Q(h, b)));
        }
        e = a[f][0] === "EQName" ? new Ih(rg(a[f]), d.length, c) : Q(a[f], P(b));
        d = [new hf(e, d, c)];
      }
    return d[0];
  }
  function Wj(a, b) {
    const c = J(a, ["functionItem", "*"]), d = I(a, "type");
    a = G(a, "arguments");
    let e = [];
    a && (e = K(a, "*").map((f) => f[0] === "argumentPlaceholder" ? null : Q(f, b)));
    return new hf(Q(c, b), e, d);
  }
  function Uj(a, b) {
    const c = K(G(a, "paramList"), "*"), d = J(a, ["functionBody", "*"]), e = I(a, "type");
    return new Eh(c.map((f) => ({name: rg(G(f, "varName")), type: sg(f)})), sg(a), d ? Q(d, b) : new gi([], e));
  }
  function Sj(a, b) {
    const c = I(a, "type");
    var d = K(a, "stepExpr");
    let e = false;
    var f = d.map((h) => {
      var k = G(h, "xpathAxis");
      let l;
      var n = K(h, "*");
      const t = [];
      let u = null;
      for (const y of n)
        switch (y[0]) {
          case "lookup":
            t.push(["lookup", ck(y, b)]);
            break;
          case "predicate":
          case "predicates":
            for (const z of K(y, "*"))
              n = Q(z, P(b)), u = fh(u, n.D()), t.push(["predicate", n]);
        }
      if (k)
        switch (e = true, h = G(h, "attributeTest anyElementTest piTest documentTest elementTest commentTest namespaceTest anyKindTest textTest anyFunctionTest typedFunctionTest schemaAttributeTest atomicType anyItemType parenthesizedItemType typedMapTest typedArrayTest nameTest Wildcard".split(" ")), h = ik(h), H(k)) {
          case "ancestor":
            l = new dh(h, {Qa: false});
            break;
          case "ancestor-or-self":
            l = new dh(h, {Qa: true});
            break;
          case "attribute":
            l = new gh(h, u);
            break;
          case "child":
            l = new hh(h, u);
            break;
          case "descendant":
            l = new kh(h, {Qa: false});
            break;
          case "descendant-or-self":
            l = new kh(h, {Qa: true});
            break;
          case "parent":
            l = new rh(h, u);
            break;
          case "following-sibling":
            l = new qh(h, u);
            break;
          case "preceding-sibling":
            l = new vh(h, u);
            break;
          case "following":
            l = new oh(h);
            break;
          case "preceding":
            l = new th(h);
            break;
          case "self":
            l = new wh(h, u);
        }
      else
        k = J(h, ["filterExpr", "*"]), l = Q(k, P(b));
      for (const y of t)
        switch (y[0]) {
          case "lookup":
            l = new Ai(l, y[1]);
            break;
          case "predicate":
            l = new xi(l, y[1]);
        }
      l.type = c;
      return l;
    });
    a = G(a, "rootExpr");
    d = e || a !== null || 1 < d.length;
    if (!d && f.length === 1 || !a && f.length === 1 && f[0].ia === "sorted")
      return f[0];
    if (a && f.length === 0)
      return new ti(null);
    f = new wi(f, d);
    return a ? new ti(f) : f;
  }
  function Yj(a, b) {
    const c = I(a, "type"), d = H(G(a, "quantifier")), e = J(a, ["predicateExpr", "*"]);
    a = K(a, "quantifiedExprInClause").map((f) => {
      const h = rg(J(f, ["typedVariableBinding", "varName"]));
      f = J(f, ["sourceExpr", "*"]);
      return {name: h, eb: Q(f, P(b))};
    });
    return new Ci(d, a, Q(e, P(b)), c);
  }
  function Oj(a, b) {
    var c = K(a, "*").map((d) => Q(d, b));
    if (c.length === 1)
      return c[0];
    c = I(a, "type");
    return new gi(K(a, "*").map((d) => Q(d, b)), c);
  }
  function Zj(a, b) {
    const c = I(a, "type");
    return K(a, "*").reduce((d, e) => d === null ? Q(e, P(b)) : new hi(d, Q(e, P(b)), c), null);
  }
  function Pj(a, b) {
    const c = I(a, "type");
    a = [J(a, ["firstOperand", "*"]), J(a, ["secondOperand", "*"])];
    return new hf(new Ih({localName: "concat", namespaceURI: "http://www.w3.org/2005/xpath-functions", prefix: ""}, a.length, c), a.map((d) => Q(d, P(b))), c);
  }
  function Qj(a, b) {
    const c = I(a, "type");
    a = [G(G(a, "startExpr"), "*"), G(G(a, "endExpr"), "*")];
    const d = new Ih({localName: "to", namespaceURI: "http://fontoxpath/operators", prefix: ""}, a.length, c);
    return new hf(d, a.map((e) => Q(e, P(b))), c);
  }
  function ek(a, b) {
    if (!b.Z)
      throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
    const c = rg(G(a, "tagName"));
    var d = G(a, "attributeList");
    const e = d ? K(d, "attributeConstructor").map((f) => Q(f, P(b))) : [];
    d = d ? K(d, "namespaceDeclaration").map((f) => {
      const h = G(f, "prefix");
      return {prefix: h ? H(h) : "", uri: H(G(f, "uri"))};
    }) : [];
    a = (a = G(a, "elementContent")) ? K(a, "*").map((f) => Q(f, P(b))) : [];
    return new Ej(c, e, d, a);
  }
  function fk(a, b) {
    if (!b.Z)
      throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
    const c = rg(G(a, "attributeName"));
    var d = G(a, "attributeValue");
    d = d ? H(d) : null;
    a = (a = G(a, "attributeValueExpr")) ? K(a, "*").map((e) => Q(e, P(b))) : null;
    return new Cj(c, {value: d, mb: a});
  }
  function gk(a, b) {
    var c = G(a, "tagName");
    c ? c = rg(c) : (c = G(a, "tagNameExpr"), c = {Na: Q(G(c, "*"), P(b))});
    a = (a = G(a, "contentExpr")) ? K(a, "*").map((d) => Q(d, P(b))) : [];
    return new Ej(c, [], [], a);
  }
  function hk(a, b) {
    const c = K(G(a, "transformCopies"), "transformCopy").map((e) => {
      const f = rg(G(G(e, "varRef"), "name"));
      return {eb: Q(G(G(e, "copySource"), "*"), b), Gb: new Ta(f.prefix, f.namespaceURI, f.localName)};
    }), d = Q(G(G(a, "modifyExpr"), "*"), b);
    a = Q(G(G(a, "returnExpr"), "*"), b);
    return new Aj(c, d, a);
  }
  function dk(a, b) {
    if (!b.Z)
      throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
    const c = I(a, "type"), d = Q(G(G(a, "argExpr"), "*"), b), e = K(a, "typeswitchExprCaseClause").map((f) => {
      const h = K(f, "sequenceTypeUnion").length === 0 ? [G(f, "sequenceType")] : K(G(f, "sequenceTypeUnion"), "sequenceType");
      return {Xb: Q(J(f, ["resultExpr", "*"]), b), Fb: h.map((k) => {
        const l = G(k, "occurrenceIndicator");
        return {bc: l ? H(l) : "", Eb: Q(G(k, "*"), b)};
      })};
    });
    a = Q(J(a, ["typeswitchExprDefaultClause", "resultExpr", "*"]), b);
    return new Jj(d, e, a, c);
  }
  function kk(a, b) {
    return Q(a, b);
  }
  const lk = new Map();
  class mk {
    constructor(a, b, c, d, e, f) {
      this.v = a;
      this.D = b;
      this.h = c;
      this.jb = d;
      this.o = e;
      this.l = f;
    }
  }
  function nk(a, b, c, d, e, f, h, k) {
    a = lk.get(a);
    if (!a)
      return null;
    b = a[b + (f ? "_DEBUG" : "")];
    return b ? (b = b.find((l) => l.o === h && l.v.every((n) => c(n.prefix) === n.namespaceURI) && l.D.every((n) => d[n.name] !== void 0) && l.jb.every((n) => e[n.prefix] === n.namespaceURI) && l.l.every((n) => {
      const t = k(n.ac, n.arity);
      return t && t.namespaceURI === n.Bb.namespaceURI && t.localName === n.Bb.localName;
    }))) ? {ba: b.h, ec: false} : null : null;
  }
  function ok(a, b, c, d, e, f, h) {
    let k = lk.get(a);
    k || (k = Object.create(null), lk.set(a, k));
    a = b + (f ? "_DEBUG" : "");
    (b = k[a]) || (b = k[a] = []);
    b.push(new mk(Object.values(c.h), Object.values(c.o), e, Object.keys(d).map((l) => ({namespaceURI: d[l], prefix: l})), h, c.D));
  }
  function pk(a) {
    var b = new Za();
    if (a.namespaceURI !== "http://www.w3.org/2005/XQueryX" && a.namespaceURI !== "http://www.w3.org/2005/XQueryX" && a.namespaceURI !== "http://fontoxml.com/fontoxpath" && a.namespaceURI !== "http://www.w3.org/2007/xquery-update-10")
      throw mc("The XML structure passed as an XQueryX program was not valid XQueryX");
    const c = [a.localName === "stackTrace" ? "x:stackTrace" : a.localName], d = b.getAllAttributes(a);
    d && 0 < d.length && c.push(Array.from(d).reduce((e, f) => {
      f.localName === "start" || f.localName === "end" && a.localName === "stackTrace" ? e[f.localName] = JSON.parse(f.value) : f.localName === "type" ? e[f.localName] = Ja(f.value) : e[f.localName] = f.value;
      return e;
    }, {}));
    b = b.getChildNodes(a);
    for (const e of b)
      switch (e.nodeType) {
        case 1:
          c.push(pk(e));
          break;
        case 3:
          c.push(e.data);
      }
    return c;
  }
  const qk = Object.create(null);
  var rk = (a, b) => {
    let c = qk[a];
    c || (c = qk[a] = {Ha: [], Ta: [], oa: null, source: b.source});
    const d = c.oa || (() => {
    });
    c.Ha = c.Ha.concat(b.Ha);
    c.Ta = c.Ta.concat(b.Ta);
    c.oa = (e) => {
      d(e);
      b.oa && b.oa(e);
    };
  }, sk = (a, b) => {
    const c = qk[b];
    if (!c)
      throw Error(`XQST0051: No modules found with the namespace uri ${b}`);
    c.Ha.forEach((d) => {
      d.bb && mg(a, b, d.localName, d.arity, d);
    });
    c.Ta.forEach((d) => {
      og(a, b, d.localName);
      pg(a, b, d.localName, (e, f) => B(d.ba, e, f));
    });
  }, tk = () => {
    Object.keys(qk).forEach((a) => {
      a = qk[a];
      if (a.oa)
        try {
          a.oa(a);
        } catch (b) {
          a.oa = null, Pf(a.source, b);
        }
      a.oa = null;
    });
  };
  function uk(a) {
    return a.replace(/(\x0D\x0A)|(\x0D(?!\x0A))/g, String.fromCharCode(10));
  }
  var R = prsc2;
  function vk(a, b) {
    return (c, d) => {
      if (b.has(d))
        return b.get(d);
      c = a(c, d);
      b.set(d, c);
      return c;
    };
  }
  function S(a, b) {
    return (0, R.delimited)(b, a, b);
  }
  function T(a, b) {
    return a.reverse().reduce((c, d) => (0, R.preceded)(d, c), b);
  }
  function wk(a, b, c, d) {
    return (0, R.then)((0, R.then)(a, b, (e, f) => [e, f]), c, ([e, f], h) => d(e, f, h));
  }
  function xk(a, b, c, d, e) {
    return (0, R.then)((0, R.then)((0, R.then)(a, b, (f, h) => [f, h]), c, ([f, h], k) => [f, h, k]), d, ([f, h, k], l) => e(f, h, k, l));
  }
  function yk(a, b, c, d, e, f) {
    return (0, R.then)((0, R.then)((0, R.then)((0, R.then)(a, b, (h, k) => [h, k]), c, ([h, k], l) => [h, k, l]), d, ([h, k, l], n) => [h, k, l, n]), e, ([h, k, l, n], t) => f(h, k, l, n, t));
  }
  function zk(a) {
    return (0, R.map)(a, (b) => [b]);
  }
  function Ak(a, b) {
    return (0, R.map)((0, R.or)(a), () => b);
  }
  function Bk(a) {
    return (b, c) => (b = a.exec(b.substring(c))) && b.index === 0 ? (0, R.okWithValue)(c + b[0].length, b[0]) : (0, R.error)(c, [a.source], false);
  }
  var Ck = (0, R.or)([(0, R.token)(" "), (0, R.token)("	"), (0, R.token)("\r"), (0, R.token)("\n")]), Dk = (0, R.token)("(:"), Ek = (0, R.token)(":)"), Fk = (0, R.token)("(#"), Gk = (0, R.token)("#)"), Hk = (0, R.token)("("), Ik = (0, R.token)(")"), Jk = (0, R.token)("["), Kk = (0, R.token)("]"), Lk = (0, R.token)("{"), Mk = (0, R.token)("}"), Nk = (0, R.token)("{{"), Ok = (0, R.token)("}}"), Pk = (0, R.token)("'"), Qk = (0, R.token)("''"), Rk = (0, R.token)('"'), Sk = (0, R.token)('""'), Tk = (0, R.token)("<![CDATA["), Uk = (0, R.token)("]]>"), Vk = (0, R.token)("/>"), Wk = (0, R.token)("</"), Xk = (0, R.token)("<!--"), Yk = (0, R.token)("-->"), Zk = (0, R.token)("<?"), $k = (0, R.token)("?>"), al = (0, R.token)("&#x"), bl = (0, R.token)("&#"), cl = (0, R.token)(":*"), dl = (0, R.token)("*:"), el = (0, R.token)(":="), fl = (0, R.token)("&"), gl = (0, R.token)(":"), hl = (0, R.token)(";"), il = (0, R.token)("*"), jl = (0, R.token)("@"), kl = (0, R.token)("$"), ll = (0, R.token)("#"), ml = (0, R.token)("%"), nl = (0, R.token)("?"), ol = (0, R.token)("="), pl = (0, R.followed)((0, R.token)("!"), (0, R.not)((0, R.peek)(ol), [])), ql = (0, R.followed)((0, R.token)("|"), (0, R.not)((0, R.peek)((0, R.token)("|")), [])), rl = (0, R.token)("||"), sl = (0, R.token)("!="), tl = (0, R.token)("<"), ul = (0, R.token)("<<"), vl = (0, R.token)("<="), wl = (0, R.token)(">"), xl = (0, R.token)(">>"), yl = (0, R.token)(">="), zl = (0, R.token)(","), Al = (0, R.token)("."), Bl = (0, R.token)(".."), Cl = (0, R.token)("+"), Dl = (0, R.token)("-"), El = (0, R.token)("/"), Fl = (0, R.token)("//"), Gl = (0, R.token)("=>"), Hl = (0, R.token)("e"), Il = (0, R.token)("E");
  (0, R.token)("l");
  (0, R.token)("L");
  (0, R.token)("m");
  (0, R.token)("M");
  var Jl = (0, R.token)("Q");
  (0, R.token)("x");
  (0, R.token)("X");
  var Kl = (0, R.token)("as"), Ll = (0, R.token)("cast"), Ml = (0, R.token)("castable"), Nl = (0, R.token)("treat"), Ol = (0, R.token)("instance"), Pl = (0, R.token)("of"), Ql = (0, R.token)("node"), Rl = (0, R.token)("nodes"), Sl = (0, R.token)("delete"), Tl = (0, R.token)("value"), Ul = (0, R.token)("function"), Vl = (0, R.token)("map"), Wl = (0, R.token)("element"), Xl = (0, R.token)("attribute"), Yl = (0, R.token)("schema-element"), Zl = (0, R.token)("intersect"), $l = (0, R.token)("except"), am = (0, R.token)("union"), bm = (0, R.token)("to"), cm = (0, R.token)("is"), dm = (0, R.token)("or"), em = (0, R.token)("and"), fm = (0, R.token)("div"), gm = (0, R.token)("idiv"), hm = (0, R.token)("mod"), im = (0, R.token)("eq"), jm = (0, R.token)("ne"), km = (0, R.token)("lt"), lm = (0, R.token)("le"), mm = (0, R.token)("gt"), nm = (0, R.token)("ge"), om = (0, R.token)("amp"), pm = (0, R.token)("quot"), qm = (0, R.token)("apos"), rm = (0, R.token)("if"), sm = (0, R.token)("then"), tm = (0, R.token)("else"), um = (0, R.token)("allowing"), vm = (0, R.token)("empty"), wm = (0, R.token)("at"), xm = (0, R.token)("in"), ym = (0, R.token)("for"), zm = (0, R.token)("let"), Am = (0, R.token)("where"), Bm = (0, R.token)("collation"), Cm = (0, R.token)("group"), Dm = (0, R.token)("by"), Em = (0, R.token)("order"), Fm = (0, R.token)("stable"), Gm = (0, R.token)("return"), Hm = (0, R.token)("array"), Im = (0, R.token)("document"), Jm = (0, R.token)("namespace"), Km = (0, R.token)("text"), Lm = (0, R.token)("comment"), Mm = (0, R.token)("processing-instruction"), Nm = (0, R.token)("lax"), Om = (0, R.token)("strict"), Pm = (0, R.token)("validate"), Qm = (0, R.token)("type"), Rm = (0, R.token)("declare"), Sm = (0, R.token)("default"), Tm = (0, R.token)("boundary-space"), Um = (0, R.token)("strip"), Vm = (0, R.token)("preserve"), Wm = (0, R.token)("no-preserve"), Xm = (0, R.token)("inherit"), Ym = (0, R.token)("no-inherit"), Zm = (0, R.token)("greatest"), $m = (0, R.token)("least"), an = (0, R.token)("copy-namespaces"), bn = (0, R.token)("decimal-format"), cn = (0, R.token)("case"), dn = (0, R.token)("typeswitch"), en = (0, R.token)("some"), fn = (0, R.token)("every"), gn = (0, R.token)("satisfies"), hn = (0, R.token)("replace"), jn = (0, R.token)("with"), kn = (0, R.token)("copy"), ln = (0, R.token)("modify"), mn = (0, R.token)("first"), nn = (0, R.token)("last"), on = (0, R.token)("before"), pn = (0, R.token)("after"), qn = (0, R.token)("into"), rn = (0, R.token)("insert"), sn = (0, R.token)("rename"), tn = (0, R.token)("switch"), un = (0, R.token)("variable"), vn = (0, R.token)("external"), wn = (0, R.token)("updating"), xn = (0, R.token)("import"), yn = (0, R.token)("schema"), zn = (0, R.token)("module"), An = (0, R.token)("base-uri"), Bn = (0, R.token)("construction"), Cn = (0, R.token)("ordering"), Dn = (0, R.token)("ordered"), En = (0, R.token)("unordered"), Fn = (0, R.token)("option"), Gn = (0, R.token)("context"), Hn = (0, R.token)("item"), In = (0, R.token)("xquery"), Jn = (0, R.token)("version"), Kn = (0, R.token)("encoding"), Ln = (0, R.token)("document-node"), Mn = (0, R.token)("namespace-node"), Nn = (0, R.token)("schema-attribute"), On = (0, R.token)("ascending"), Pn = (0, R.token)("descending"), Qn = (0, R.token)("empty-sequence"), Rn = (0, R.token)("child::"), Sn = (0, R.token)("descendant::"), Tn = (0, R.token)("attribute::"), Un = (0, R.token)("self::"), Vn = (0, R.token)("descendant-or-self::"), Wn = (0, R.token)("following-sibling::"), Xn = (0, R.token)("following::"), Yn = (0, R.token)("parent::"), Zn = (0, R.token)("ancestor::"), $n = (0, R.token)("preceding-sibling::"), ao = (0, R.token)("preceding::"), bo = (0, R.token)("ancestor-or-self::"), co = (0, R.token)("decimal-separator"), eo = (0, R.token)("grouping-separator"), fo = (0, R.token)("infinity"), go = (0, R.token)("minus-sign"), ho = (0, R.token)("NaN"), io = (0, R.token)("per-mille"), jo = (0, R.token)("zero-digit"), ko = (0, R.token)("digit"), lo = (0, R.token)("pattern-separator"), mo = (0, R.token)("exponent-separator"), no = (0, R.token)("schema-attribute("), oo = (0, R.token)("document-node("), po = (0, R.token)("processing-instruction("), qo = (0, R.token)("processing-instruction()"), ro = (0, R.token)("comment()"), so = (0, R.token)("text()"), to = (0, R.token)("namespace-node()"), uo = (0, R.token)("node()"), vo = (0, R.token)("item()"), wo = (0, R.token)("empty-sequence()");
  var xo = new Map(), yo = new Map(), zo = (0, R.or)([Bk(/[\t\n\r -\uD7FF\uE000\uFFFD]/), Bk(/[\uD800-\uDBFF][\uDC00-\uDFFF]/)]), Ao = (0, R.preceded)((0, R.peek)((0, R.not)((0, R.or)([Dk, Ek]), ['comment contents cannot contain "(:" or ":)"'])), zo), Bo = (0, R.map)((0, R.delimited)(Dk, (0, R.star)((0, R.or)([Ao, function(a, b) {
    return Bo(a, b);
  }])), Ek, true), (a) => a.join("")), Co = (0, R.or)([Ck, Bo]), Do = (0, R.map)((0, R.plus)(Ck), (a) => a.join("")), V = vk((0, R.map)((0, R.star)(Co), (a) => a.join("")), xo), W = vk((0, R.map)((0, R.plus)(Co), (a) => a.join("")), yo);
  const Eo = (0, R.or)([Bk(/[A-Z_a-z\xC0-\xD6\xD8-\xF6\xF8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/), (0, R.then)(Bk(/[\uD800-\uDB7F]/), Bk(/[\uDC00-\uDFFF]/), (a, b) => a + b)]), Fo = (0, R.or)([Eo, Bk(/[\-\.0-9\xB7\u0300-\u036F\u203F\u2040]/)]);
  var Go = (0, R.then)(Eo, (0, R.star)(Fo), (a, b) => a + b.join("")), Ho = (0, R.map)(Go, (a) => ["prefix", a]);
  const Io = (0, R.or)([Eo, gl]), Jo = (0, R.or)([Fo, gl]);
  (0, R.then)(Io, (0, R.star)(Jo), (a, b) => a + b.join(""));
  const Ko = (0, R.map)(Go, (a) => [{prefix: "", URI: null}, a]), Lo = (0, R.then)(Go, (0, R.preceded)(gl, Go), (a, b) => [{prefix: a, URI: null}, b]);
  var Mo = (0, R.or)([Lo, Ko]), No = (0, R.followed)(T([Jl, V, Lk], (0, R.map)((0, R.star)(Bk(/[^{}]/)), (a) => a.join("").replace(/\s+/g, " ").trim())), Mk);
  const Oo = (0, R.then)(No, Go, (a, b) => [a, b]);
  var Po = (0, R.or)([(0, R.map)(Oo, (a) => [{prefix: null, URI: a[0]}, a[1]]), Mo]), Qo = (0, R.or)([(0, R.map)(Po, (a) => ["QName", ...a]), (0, R.map)(il, () => ["star"])]), Ro = (0, R.map)((0, R.preceded)(kl, Po), (a) => ["varRef", ["name", ...a]]);
  var So = (0, R.peek)((0, R.or)([Hk, Rk, Pk, Co])), To = (0, R.map)((0, R.or)([Rn, Sn, Tn, Un, Vn, Wn, Xn]), (a) => a.substring(0, a.length - 2)), Uo = (0, R.map)((0, R.or)([Yn, Zn, $n, ao, bo]), (a) => a.substring(0, a.length - 2)), Vo = wk(fl, (0, R.or)([km, mm, om, pm, qm]), hl, (a, b, c) => a + b + c), Wo = (0, R.or)([wk(al, Bk(/[0-9a-fA-F]+/), hl, (a, b, c) => a + b + c), wk(bl, Bk(/[0-9]+/), hl, (a, b, c) => a + b + c)]), Xo = Ak([Sk], '"'), Yo = Ak([Qk], "'"), Zo = zk(Ak([ro], "commentTest")), $o = zk(Ak([so], "textTest")), ap = zk(Ak([to], "namespaceTest")), bp = zk(Ak([uo], "anyKindTest"));
  const cp = Bk(/[0-9]+/), dp = (0, R.then)((0, R.or)([(0, R.then)(Al, cp, (a, b) => a + b), (0, R.then)(cp, (0, R.optional)((0, R.preceded)(Al, Bk(/[0-9]*/))), (a, b) => a + (b !== null ? "." + b : ""))]), wk((0, R.or)([Hl, Il]), (0, R.optional)((0, R.or)([Cl, Dl])), cp, (a, b, c) => a + (b ? b : "") + c), (a, b) => ["doubleConstantExpr", ["value", a + b]]), ep = (0, R.or)([(0, R.map)((0, R.preceded)(Al, cp), (a) => ["decimalConstantExpr", ["value", "." + a]]), (0, R.then)((0, R.followed)(cp, Al), (0, R.optional)(cp), (a, b) => ["decimalConstantExpr", ["value", a + "." + (b !== null ? b : "")]])]);
  var fp = (0, R.map)(cp, (a) => ["integerConstantExpr", ["value", a]]), gp = (0, R.followed)((0, R.or)([dp, ep, fp]), (0, R.peek)((0, R.not)(Bk(/[a-zA-Z]/), ["no alphabetical characters after numeric literal"]))), hp = (0, R.map)((0, R.followed)(Al, (0, R.peek)((0, R.not)(Al, ["context item should not be followed by another ."]))), () => ["contextItemExpr"]), ip = (0, R.or)([Hm, Xl, Lm, Ln, Wl, Qn, Ul, rm, Hn, Vl, Mn, Ql, Mm, Nn, Yl, tn, Km, dn]), jp = zk(Ak([nl], "argumentPlaceholder")), kp = (0, R.or)([nl, il, Cl]), lp = (0, R.preceded)((0, R.peek)((0, R.not)(Bk(/[{}<&]/), ["elementContentChar cannot be {, }, <, or &"])), zo), mp = (0, R.map)((0, R.delimited)(Tk, (0, R.star)((0, R.preceded)((0, R.peek)((0, R.not)(Uk, ['CDataSection content may not contain "]]>"'])), zo)), Uk, true), (a) => ["CDataSection", a.join("")]), np = (0, R.preceded)((0, R.peek)((0, R.not)(Bk(/["{}<&]/), ['quotAttrValueContentChar cannot be ", {, }, <, or &'])), zo), op = (0, R.preceded)((0, R.peek)((0, R.not)(Bk(/['{}<&]/), ["aposAttrValueContentChar cannot be ', {, }, <, or &"])), zo), pp = (0, R.map)((0, R.star)((0, R.or)([(0, R.preceded)((0, R.peek)((0, R.not)(Dl, [])), zo), (0, R.map)(T([Dl, (0, R.peek)((0, R.not)(Dl, []))], zo), (a) => "-" + a)])), (a) => a.join("")), qp = (0, R.map)((0, R.delimited)(Xk, pp, Yk, true), (a) => ["computedCommentConstructor", ["argExpr", ["stringConstantExpr", ["value", a]]]]);
  const rp = (0, R.filter)(Go, (a) => a.toLowerCase() !== "xml", ['A processing instruction target cannot be "xml"']), sp = (0, R.map)((0, R.star)((0, R.preceded)((0, R.peek)((0, R.not)($k, [])), zo)), (a) => a.join(""));
  var tp = (0, R.then)((0, R.preceded)(Zk, (0, R.cut)(rp)), (0, R.cut)((0, R.followed)((0, R.optional)((0, R.preceded)(Do, sp)), $k)), (a, b) => ["computedPIConstructor", ["piTarget", a], ["piValueExpr", ["stringConstantExpr", ["value", b]]]]), up = (0, R.map)(Fl, () => ["stepExpr", ["xpathAxis", "descendant-or-self"], ["anyKindTest"]]), vp = (0, R.or)([Nm, Om]), wp = (0, R.map)((0, R.star)((0, R.followed)(zo, (0, R.peek)((0, R.not)(Gk, ["Pragma contents should not contain '#)'"])))), (a) => a.join("")), xp = (0, R.map)((0, R.followed)((0, R.or)([
    im,
    jm,
    km,
    lm,
    mm,
    nm
  ]), So), (a) => a + "Op"), yp = (0, R.or)([(0, R.followed)(Ak([cm], "isOp"), So), Ak([ul], "nodeBeforeOp"), Ak([xl], "nodeAfterOp")]), zp = (0, R.or)([Ak([ol], "equalOp"), Ak([sl], "notEqualOp"), Ak([vl], "lessThanOrEqualOp"), Ak([tl], "lessThanOp"), Ak([yl], "greaterThanOrEqualOp"), Ak([wl], "greaterThanOp")]), Ap = (0, R.map)(wn, () => ["annotation", ["annotationName", "updating"]]);
  const Bp = (0, R.or)([Vm, Wm]), Cp = (0, R.or)([Xm, Ym]);
  var Dp = (0, R.or)([co, eo, fo, go, ho, ml, io, jo, ko, lo, mo]), Ep = (0, R.map)(T([Rm, W, Tm, W], (0, R.or)([Vm, Um])), (a) => ["boundarySpaceDecl", a]), Fp = (0, R.map)(T([Rm, W, Bn, W], (0, R.or)([Vm, Um])), (a) => ["constructionDecl", a]), Gp = (0, R.map)(T([Rm, W, Cn, W], (0, R.or)([Dn, En])), (a) => ["orderingModeDecl", a]), Hp = (0, R.map)(T([Rm, W, Sm, W, Em, W, vm, W], (0, R.or)([Zm, $m])), (a) => ["emptyOrderDecl", a]), Ip = (0, R.then)(T([Rm, W, an, W], Bp), T([V, zl, V], Cp), (a, b) => ["copyNamespacesDecl", ["preserveMode", a], ["inheritMode", b]]);
  function Jp(a) {
    switch (a[0]) {
      case "constantExpr":
      case "varRef":
      case "contextItemExpr":
      case "functionCallExpr":
      case "sequenceExpr":
      case "elementConstructor":
      case "computedElementConstructor":
      case "computedAttributeConstructor":
      case "computedDocumentConstructor":
      case "computedTextConstructor":
      case "computedCommentConstructor":
      case "computedNamespaceConstructor":
      case "computedPIConstructor":
      case "orderedExpr":
      case "unorderedExpr":
      case "namedFunctionRef":
      case "inlineFunctionExpr":
      case "dynamicFunctionInvocationExpr":
      case "mapConstructor":
      case "arrayConstructor":
      case "stringConstructor":
      case "unaryLookup":
        return a;
    }
    return [
      "sequenceExpr",
      a
    ];
  }
  function Kp(a) {
    if (!(1 <= a && 55295 >= a || 57344 <= a && 65533 >= a || 65536 <= a && 1114111 >= a))
      throw Error("XQST0090: The character reference " + a + " (" + a.toString(16) + ") does not reference a valid codePoint.");
  }
  function Lp(a) {
    return a.replace(/(&[^;]+);/g, (b) => {
      if (/^&#x/.test(b))
        return b = parseInt(b.slice(3, -1), 16), Kp(b), String.fromCodePoint(b);
      if (/^&#/.test(b))
        return b = parseInt(b.slice(2, -1), 10), Kp(b), String.fromCodePoint(b);
      switch (b) {
        case "&lt;":
          return "<";
        case "&gt;":
          return ">";
        case "&amp;":
          return "&";
        case "&quot;":
          return String.fromCharCode(34);
        case "&apos;":
          return String.fromCharCode(39);
      }
      throw Error('XPST0003: Unknown character reference: "' + b + '"');
    });
  }
  function Mp(a, b, c) {
    if (!a.length)
      return [];
    let d = [a[0]];
    for (let e = 1; e < a.length; ++e) {
      const f = d[d.length - 1];
      typeof f === "string" && typeof a[e] === "string" ? d[d.length - 1] = f + a[e] : d.push(a[e]);
    }
    if (typeof d[0] === "string" && d.length === 0)
      return [];
    d = d.reduce((e, f, h) => {
      if (typeof f !== "string")
        e.push(f);
      else if (c && /^\s*$/.test(f)) {
        const k = d[h + 1];
        k && k[0] === "CDataSection" ? e.push(Lp(f)) : (h = d[h - 1]) && h[0] === "CDataSection" && e.push(Lp(f));
      } else
        e.push(Lp(f));
      return e;
    }, []);
    if (!d.length)
      return d;
    if (1 < d.length || b)
      for (a = 0; a < d.length; a++)
        typeof d[a] === "string" && (d[a] = ["stringConstantExpr", ["value", d[a]]]);
    return d;
  }
  function Np(a) {
    return a[0].prefix ? a[0].prefix + ":" + a[1] : a[1];
  }
  var Op = (0, R.then)(Po, (0, R.optional)(nl), (a, b) => b !== null ? ["singleType", ["atomicType", ...a], ["optional"]] : ["singleType", ["atomicType", ...a]]), Pp = (0, R.map)(Po, (a) => ["atomicType", ...a]);
  const Qp = new Map();
  function Rp(a) {
    function b(m, r) {
      return r.reduce((C, Z) => [Z[0], ["firstOperand", C], ["secondOperand", Z[1]]], m);
    }
    function c(m, r, C) {
      return (0, R.then)(m, (0, R.star)((0, R.then)(S(r, V), (0, R.cut)(m), (Z, da) => [Z, da])), C);
    }
    function d(m, r, C = "firstOperand", Z = "secondOperand") {
      return (0, R.then)(m, (0, R.optional)((0, R.then)(S(r, V), (0, R.cut)(m), (da, xa) => [da, xa])), (da, xa) => xa === null ? da : [xa[0], [C, da], [Z, xa[1]]]);
    }
    function e(m) {
      return a.lb ? (r, C) => {
        r = m(r, C);
        if (!r.success)
          return r;
        const Z = n.has(C) ? n.get(C) : {offset: C, line: -1, ha: -1}, da = n.has(r.offset) ? n.get(r.offset) : {offset: r.offset, line: -1, ha: -1};
        n.set(C, Z);
        n.set(r.offset, da);
        return (0, R.okWithValue)(r.offset, ["x:stackTrace", {start: Z, end: da}, r.value]);
      } : m;
    }
    function f(m, r) {
      return mj(m, r);
    }
    function h(m, r) {
      return qf(m, r);
    }
    function k(m, r) {
      return e((0, R.or)([er, fr, gr, hr, ir, jr, kr, lr, mr, nr, or]))(m, r);
    }
    function l(m, r) {
      return c(k, zl, (C, Z) => Z.length === 0 ? C : ["sequenceExpr", C, ...Z.map((da) => da[1])])(m, r);
    }
    const n = new Map(), t = (0, R.preceded)(Jk, (0, R.followed)(S(l, V), Kk)), u = (0, R.map)(a.Ya ? (0, R.or)([S((0, R.star)((0, R.or)([
      Vo,
      Wo,
      Xo,
      Bk(/[^"&]/)
    ])), Rk), S((0, R.star)((0, R.or)([Vo, Wo, Yo, Bk(/[^'&]/)])), Pk)]) : (0, R.or)([S((0, R.star)((0, R.or)([Xo, Bk(/[^"]/)])), Rk), S((0, R.star)((0, R.or)([Yo, Bk(/[^']/)])), Pk)]), (m) => m.join("")), y = (0, R.or)([(0, R.map)(T([Wl, V], (0, R.delimited)((0, R.followed)(Hk, V), (0, R.then)(Qo, T([V, zl, V], Po), (m, r) => [["elementName", m], ["typeName", ...r]]), (0, R.preceded)(V, Ik))), ([m, r]) => ["elementTest", m, r]), (0, R.map)(T([Wl, V], (0, R.delimited)(Hk, Qo, Ik)), (m) => ["elementTest", ["elementName", m]]), (0, R.map)(T([Wl, V], (0, R.delimited)(Hk, V, Ik)), () => ["elementTest"])]), z = (0, R.or)([(0, R.map)(Po, (m) => ["QName", ...m]), (0, R.map)(il, () => ["star"])]), F = (0, R.or)([(0, R.map)(T([Xl, V], (0, R.delimited)((0, R.followed)(Hk, V), (0, R.then)(z, T([V, zl, V], Po), (m, r) => [["attributeName", m], ["typeName", ...r]]), (0, R.preceded)(V, Ik))), ([m, r]) => ["attributeTest", m, r]), (0, R.map)(T([Xl, V], (0, R.delimited)(Hk, z, Ik)), (m) => ["attributeTest", ["attributeName", m]]), (0, R.map)(T([Xl, V], (0, R.delimited)(Hk, V, Ik)), () => ["attributeTest"])]), O = (0, R.map)(T([Yl, V, Hk], (0, R.followed)(Po, Ik)), (m) => ["schemaElementTest", ...m]), U = (0, R.map)((0, R.delimited)(no, S(Po, V), Ik), (m) => ["schemaAttributeTest", ...m]), ba = (0, R.map)((0, R.preceded)(oo, (0, R.followed)(S((0, R.optional)((0, R.or)([y, O])), V), Ik)), (m) => ["documentTest", ...m ? [m] : []]), Ga = (0, R.or)([(0, R.map)((0, R.preceded)(po, (0, R.followed)(S((0, R.or)([Go, u]), V), Ik)), (m) => ["piTest", ["piTarget", m]]), zk(Ak([qo], "piTest"))]), Eb = (0, R.or)([ba, y, F, O, U, Ga, Zo, $o, ap, bp]), Vb = (0, R.or)([(0, R.map)((0, R.preceded)(dl, Go), (m) => ["Wildcard", ["star"], ["NCName", m]]), zk(Ak([il], "Wildcard")), (0, R.map)((0, R.followed)(No, il), (m) => ["Wildcard", ["uri", m], ["star"]]), (0, R.map)((0, R.followed)(Go, cl), (m) => ["Wildcard", ["NCName", m], ["star"]])]), bd = (0, R.or)([Vb, (0, R.map)(Po, (m) => ["nameTest", ...m])]), Wb = (0, R.or)([Eb, bd]), pr = (0, R.then)((0, R.optional)(jl), Wb, (m, r) => m !== null || r[0] === "attributeTest" || r[0] === "schemaAttributeTest" ? ["stepExpr", ["xpathAxis", "attribute"], r] : ["stepExpr", ["xpathAxis", "child"], r]), qr = (0, R.or)([(0, R.then)(To, Wb, (m, r) => ["stepExpr", ["xpathAxis", m], r]), pr]), rr = (0, R.map)(Bl, () => ["stepExpr", ["xpathAxis", "parent"], ["anyKindTest"]]), sr = (0, R.or)([(0, R.then)(Uo, Wb, (m, r) => ["stepExpr", ["xpathAxis", m], r]), rr]), tr = (0, R.map)((0, R.star)((0, R.preceded)(V, t)), (m) => 0 < m.length ? ["predicates", ...m] : void 0), ur = (0, R.then)((0, R.or)([sr, qr]), tr, (m, r) => r === void 0 ? m : m.concat([r])), rf = (0, R.or)([gp, (0, R.map)(u, (m) => ["stringConstantExpr", ["value", a.Ya ? Lp(m) : m]])]), sf = (0, R.or)([(0, R.delimited)(Hk, S(l, V), Ik), (0, R.map)((0, R.delimited)(Hk, V, Ik), () => ["sequenceExpr"])]), nj = (0, R.or)([k, jp]), be = (0, R.map)((0, R.delimited)(Hk, S((0, R.optional)((0, R.then)(nj, (0, R.star)((0, R.preceded)(S(zl, V), nj)), (m, r) => [m, ...r])), V), Ik), (m) => m !== null ? m : []), vr = (0, R.preceded)((0, R.not)(wk(ip, V, Hk, () => {
    }), ["cannot use reseved keyword for function names"]), (0, R.then)(Po, (0, R.preceded)(V, be), (m, r) => ["functionCallExpr", ["functionName", ...m], r !== null ? ["arguments", ...r] : ["arguments"]])), wr = (0, R.then)(Po, (0, R.preceded)(ll, fp), (m, r) => ["namedFunctionRef", ["functionName", ...m], r]), Sa = (0, R.delimited)(Lk, S((0, R.optional)(l), V), Mk), oj = (0, R.map)(Sa, (m) => m ? m : ["sequenceExpr"]), db = (0, R.or)([(0, R.map)(wo, () => [["voidSequenceType"]]), (0, R.then)(f, (0, R.optional)((0, R.preceded)(V, kp)), (m, r) => [m, ...r !== null ? [["occurrenceIndicator", r]] : []])]), tf = (0, R.then)(T([ml, V], Po), (0, R.optional)((0, R.followed)((0, R.then)(T([Hk, V], rf), (0, R.star)(T([zl, V], rf)), (m, r) => m.concat(r)), Ik)), (m, r) => ["annotation", ["annotationName", ...m], ...r ? ["arguments", r] : []]), xr = (0, R.map)(T([Ul, V, Hk, V, il, V], Ik), () => ["anyFunctionTest"]), yr = (0, R.then)(T([Ul, V, Hk, V], (0, R.optional)(c(db, zl, (m, r) => m.concat.apply(m, r.map((C) => C[1]))))), T([V, Ik, W, Kl, W], db), (m, r) => ["typedFunctionTest", ["paramTypeList", ["sequenceType", ...m ? m : []]], ["sequenceType", ...r]]), zr = (0, R.then)((0, R.star)(tf), (0, R.or)([xr, yr]), (m, r) => [r[0], ...m, ...r.slice(1)]), Ar = (0, R.map)(T([Vl, V, Hk, V, il, V], Ik), () => ["anyMapTest"]), Br = (0, R.then)(T([Vl, V, Hk, V], Pp), T([V, zl], (0, R.followed)(S(db, V), Ik)), (m, r) => ["typedMapTest", m, ["sequenceType", ...r]]), Cr = (0, R.or)([Ar, Br]), Dr = (0, R.map)(T([Hm, V, Hk, V, il, V], Ik), () => ["anyArrayTest"]), Er = (0, R.map)(T([
      Hm,
      V,
      Hk
    ], (0, R.followed)(S(db, V), Ik)), (m) => ["typedArrayTest", ["sequenceType", ...m]]), Fr = (0, R.or)([Dr, Er]), Gr = (0, R.map)((0, R.delimited)(Hk, S(f, V), Ik), (m) => ["parenthesizedItemType", m]), mj = (0, R.or)([Eb, zk(Ak([vo], "anyItemType")), zr, Cr, Fr, Pp, Gr]), uc = (0, R.map)(T([Kl, W], db), (m) => ["typeDeclaration", ...m]), Hr = (0, R.then)((0, R.preceded)(kl, Po), (0, R.optional)((0, R.preceded)(W, uc)), (m, r) => ["param", ["varName", ...m], ...r ? [r] : []]), pj = c(Hr, zl, (m, r) => [m, ...r.map((C) => C[1])]), Ir = xk((0, R.star)(tf), T([V, Ul, V, Hk, V], (0, R.optional)(pj)), T([V, Ik, V], (0, R.optional)((0, R.map)(T([Kl, V], (0, R.followed)(db, V)), (m) => ["typeDeclaration", ...m]))), oj, (m, r, C, Z) => ["inlineFunctionExpr", ...m, ["paramList", ...r ? r : []], ...C ? [C] : [], ["functionBody", Z]]), Jr = (0, R.or)([wr, Ir]), Kr = (0, R.map)(k, (m) => ["mapKeyExpr", m]), Lr = (0, R.map)(k, (m) => ["mapValueExpr", m]), Mr = (0, R.then)(Kr, (0, R.preceded)(S(gl, V), Lr), (m, r) => ["mapConstructorEntry", m, r]), Nr = (0, R.preceded)(Vl, (0, R.delimited)(S(Lk, V), (0, R.map)((0, R.optional)(c(Mr, S(zl, V), (m, r) => [m, ...r.map((C) => C[1])])), (m) => m ? [
      "mapConstructor",
      ...m
    ] : ["mapConstructor"]), (0, R.preceded)(V, Mk))), Or = (0, R.map)((0, R.delimited)(Jk, S((0, R.optional)(c(k, zl, (m, r) => [m, ...r.map((C) => C[1])].map((C) => ["arrayElem", C]))), V), Kk), (m) => ["squareArray", ...m !== null ? m : []]), Pr = (0, R.map)((0, R.preceded)(Hm, (0, R.preceded)(V, Sa)), (m) => ["curlyArray", ...m !== null ? [["arrayElem", m]] : []]), Qr = (0, R.map)((0, R.or)([Or, Pr]), (m) => ["arrayConstructor", m]), qj = (0, R.or)([Go, fp, sf, il]), Rr = (0, R.map)((0, R.preceded)(nl, (0, R.preceded)(V, qj)), (m) => m === "*" ? ["unaryLookup", ["star"]] : typeof m === "string" ? ["unaryLookup", ["NCName", m]] : ["unaryLookup", m]), uf = (0, R.or)([Vo, Wo, Ak([Nk], "{"), Ak([Ok], "}"), (0, R.map)(Sa, (m) => m || ["sequenceExpr"])]), Sr = (0, R.or)([mp, function(m, r) {
      return rj(m, r);
    }, uf, lp]), Tr = (0, R.or)([(0, R.map)(np, (m) => m.replace(/[\x20\x0D\x0A\x09]/g, " ")), uf]), Ur = (0, R.or)([(0, R.map)(op, (m) => m.replace(/[\x20\x0D\x0A\x09]/g, " ")), uf]), Vr = (0, R.map)((0, R.or)([S((0, R.star)((0, R.or)([Xo, Tr])), Rk), S((0, R.star)((0, R.or)([Yo, Ur])), Pk)]), (m) => Mp(m, false, false)), Wr = (0, R.then)(Mo, (0, R.preceded)(S(ol, (0, R.optional)(Do)), Vr), (m, r) => {
      if (m[0].prefix === "" && m[1] === "xmlns") {
        if (r.length && typeof r[0] !== "string")
          throw Error("XQST0022: A namespace declaration may not contain enclosed expressions");
        return ["namespaceDeclaration", r.length ? ["uri", r[0]] : ["uri"]];
      }
      if (m[0].prefix === "xmlns") {
        if (r.length && typeof r[0] !== "string")
          throw Error("XQST0022: The namespace declaration for 'xmlns:" + m[1] + "' may not contain enclosed expressions");
        return ["namespaceDeclaration", ["prefix", m[1]], r.length ? ["uri", r[0]] : ["uri"]];
      }
      return [
        "attributeConstructor",
        ["attributeName"].concat(m),
        r.length === 0 ? ["attributeValue"] : r.length === 1 && typeof r[0] === "string" ? ["attributeValue", r[0]] : ["attributeValueExpr"].concat(r)
      ];
    }), Xr = (0, R.map)((0, R.star)((0, R.preceded)(Do, (0, R.optional)(Wr))), (m) => m.filter(Boolean)), Yr = wk((0, R.preceded)(tl, Mo), Xr, (0, R.or)([(0, R.map)(Vk, () => null), (0, R.then)((0, R.preceded)(wl, (0, R.star)(Sr)), T([V, Wk], (0, R.followed)(Mo, (0, R.then)((0, R.optional)(Do), wl, () => null))), (m, r) => [Mp(m, true, true), r])]), (m, r, C) => {
      var Z = C;
      if (C && C.length) {
        Z = Np(m);
        const da = Np(C[1]);
        if (Z !== da)
          throw Error('XQST0118: The start and the end tag of an element constructor must be equal. "' + Z + '" does not match "' + da + '"');
        Z = C[0];
      }
      return ["elementConstructor", ["tagName", ...m], ...r.length ? [["attributeList", ...r]] : [], ...Z && Z.length ? [["elementContent", ...Z]] : []];
    }), rj = (0, R.or)([Yr, qp, tp]), Zr = (0, R.map)(T([Im, V], Sa), (m) => ["computedDocumentConstructor", ...m ? [["argExpr", m]] : []]), $r = (0, R.map)(Sa, (m) => m ? [["contentExpr", m]] : []), as = (0, R.then)(T([Wl, V], (0, R.or)([
      (0, R.map)(Po, (m) => ["tagName", ...m]),
      (0, R.map)((0, R.delimited)(Lk, S(l, V), Mk), (m) => ["tagNameExpr", m])
    ])), (0, R.preceded)(V, $r), (m, r) => ["computedElementConstructor", m, ...r]), bs = (0, R.then)((0, R.preceded)(Xl, (0, R.or)([(0, R.map)(T([So, V], Po), (m) => ["tagName", ...m]), (0, R.map)((0, R.preceded)(V, (0, R.delimited)(Lk, S(l, V), Mk)), (m) => ["tagNameExpr", m])])), (0, R.preceded)(V, Sa), (m, r) => ["computedAttributeConstructor", m, ["valueExpr", r ? r : ["sequenceExpr"]]]), cs = (0, R.map)(Sa, (m) => m ? [["prefixExpr", m]] : []), ds = (0, R.map)(Sa, (m) => m ? [["URIExpr", m]] : []), es = (0, R.then)(T([
      Jm,
      V
    ], (0, R.or)([Ho, cs])), (0, R.preceded)(V, ds), (m, r) => ["computedNamespaceConstructor", ...m, ...r]), fs = (0, R.map)(T([Km, V], Sa), (m) => ["computedTextConstructor", ...m ? [["argExpr", m]] : []]), gs = (0, R.map)(T([Lm, V], Sa), (m) => ["computedCommentConstructor", ...m ? [["argExpr", m]] : []]), hs = T([Mm, V], (0, R.then)((0, R.or)([(0, R.map)(Go, (m) => ["piTarget", m]), (0, R.map)((0, R.delimited)(Lk, S(l, V), Mk), (m) => ["piTargetExpr", m])]), (0, R.preceded)(V, Sa), (m, r) => ["computedPIConstructor", m, ...r ? [["piValueExpr", r]] : []])), is = (0, R.or)([
      Zr,
      as,
      bs,
      es,
      fs,
      gs,
      hs
    ]), js = (0, R.or)([rj, is]), sj = (0, R.or)([rf, Ro, sf, hp, vr, js, Jr, Nr, Qr, Rr]), tj = (0, R.map)(T([nl, V], qj), (m) => m === "*" ? ["lookup", ["star"]] : typeof m === "string" ? ["lookup", ["NCName", m]] : ["lookup", m]), ks = (0, R.then)((0, R.map)(sj, (m) => Jp(m)), (0, R.star)((0, R.or)([(0, R.map)((0, R.preceded)(V, t), (m) => ["predicate", m]), (0, R.map)((0, R.preceded)(V, be), (m) => ["argumentList", m]), (0, R.preceded)(V, tj)])), (m, r) => {
      function C() {
        uj && xa.length === 1 ? vc.push(["predicate", xa[0]]) : xa.length !== 0 && vc.push(["predicates", ...xa]);
        xa.length = 0;
      }
      function Z(Xb) {
        C();
        vc.length !== 0 ? (da[0][0] === "sequenceExpr" && 2 < da[0].length && (da = [["sequenceExpr", ...da]]), da = [["filterExpr", ...da], ...vc], vc.length = 0) : Xb && (da = [["filterExpr", ...da]]);
      }
      let da = [m];
      const xa = [], vc = [];
      let uj = false;
      for (const Xb of r)
        switch (Xb[0]) {
          case "predicate":
            xa.push(Xb[1]);
            break;
          case "lookup":
            uj = true;
            C();
            vc.push(Xb);
            break;
          case "argumentList":
            Z(false);
            1 < da.length && (da = [["sequenceExpr", ["pathExpr", ["stepExpr", ...da]]]]);
            da = [["dynamicFunctionInvocationExpr", ["functionItem", ...da], ...Xb[1].length ? [["arguments", ...Xb[1]]] : []]];
            break;
          default:
            throw Error("unreachable");
        }
      Z(true);
      return da;
    }), wc = (0, R.or)([(0, R.map)(ks, (m) => ["stepExpr", ...m]), ur]), ls = (0, R.followed)(sj, (0, R.peek)((0, R.not)((0, R.preceded)(V, (0, R.or)([t, be, tj])), ["primary expression not followed by predicate, argumentList, or lookup"]))), ms = (0, R.or)([wk(wc, (0, R.preceded)(V, up), (0, R.preceded)(V, h), (m, r, C) => ["pathExpr", m, r, ...C]), (0, R.then)(wc, (0, R.preceded)(S(El, V), h), (m, r) => ["pathExpr", m, ...r]), ls, (0, R.map)(wc, (m) => ["pathExpr", m])]), qf = (0, R.or)([wk(wc, (0, R.preceded)(V, up), (0, R.preceded)(V, h), (m, r, C) => [m, r, ...C]), (0, R.then)(wc, (0, R.preceded)(S(El, V), h), (m, r) => [m, ...r]), (0, R.map)(wc, (m) => [m])]), ns = (0, R.or)([(0, R.map)(T([El, V], qf), (m) => ["pathExpr", ["rootExpr"], ...m]), (0, R.then)(up, (0, R.preceded)(V, qf), (m, r) => ["pathExpr", ["rootExpr"], m, ...r]), (0, R.map)((0, R.followed)(El, (0, R.not)((0, R.preceded)(V, a.Ya ? Bk(/[*<a-zA-Z]/) : Bk(/[*a-zA-Z]/)), ["Single rootExpr cannot be by followed by something that can be interpreted as a relative path"])), () => ["pathExpr", ["rootExpr"]])]), os = vk((0, R.or)([ms, ns]), Qp), ps = (0, R.preceded)(Pm, (0, R.then)((0, R.optional)((0, R.or)([(0, R.map)((0, R.preceded)(V, vp), (m) => ["validationMode", m]), (0, R.map)(T([V, Qm, V], Po), (m) => ["type", ...m])])), (0, R.delimited)((0, R.preceded)(V, Lk), S(l, V), Mk), (m, r) => ["validateExpr", ...m ? [m] : [], ["argExpr", r]])), qs = (0, R.delimited)(Fk, (0, R.then)((0, R.preceded)(V, Po), (0, R.optional)((0, R.preceded)(W, wp)), (m, r) => r ? ["pragma", ["pragmaName", m], ["pragmaContents", r]] : ["pragma", ["pragmaName", m]]), (0, R.preceded)(V, Gk)), rs = (0, R.map)((0, R.followed)((0, R.plus)(qs), (0, R.preceded)(V, (0, R.delimited)(Lk, S((0, R.optional)(l), V), Mk))), (m) => ["extensionExpr", ...m]), ss = e(c(os, pl, (m, r) => r.length === 0 ? m : ["simpleMapExpr", m[0] === "pathExpr" ? m : ["pathExpr", ["stepExpr", ["filterExpr", Jp(m)]]]].concat(r.map((C) => {
      C = C[1];
      return C[0] === "pathExpr" ? C : ["pathExpr", ["stepExpr", ["filterExpr", Jp(C)]]];
    })))), ts = (0, R.or)([ps, rs, ss]), vj = (0, R.or)([(0, R.then)((0, R.or)([Ak([Dl], "unaryMinusOp"), Ak([Cl], "unaryPlusOp")]), (0, R.preceded)(V, function(m, r) {
      return vj(m, r);
    }), (m, r) => [m, ["operand", r]]), ts]), us = (0, R.or)([(0, R.map)(Po, (m) => ["EQName", ...m]), Ro, sf]), vs = (0, R.then)(vj, (0, R.star)(T([V, Gl, V], (0, R.then)(us, (0, R.preceded)(V, be), (m, r) => [m, r]))), (m, r) => r.reduce((C, Z) => ["arrowExpr", ["argExpr", C], Z[0], ["arguments", ...Z[1]]], m)), ws = (0, R.then)(vs, (0, R.optional)(T([V, Ll, W, Kl, So, V], Op)), (m, r) => r !== null ? ["castExpr", ["argExpr", m], r] : m), xs = (0, R.then)(ws, (0, R.optional)(T([V, Ml, W, Kl, So, V], Op)), (m, r) => r !== null ? ["castableExpr", ["argExpr", m], r] : m), ys = (0, R.then)(xs, (0, R.optional)(T([
      V,
      Nl,
      W,
      Kl,
      So,
      V
    ], db)), (m, r) => r !== null ? ["treatExpr", ["argExpr", m], ["sequenceType", ...r]] : m), zs = (0, R.then)(ys, (0, R.optional)(T([V, Ol, W, Pl, So, V], db)), (m, r) => r !== null ? ["instanceOfExpr", ["argExpr", m], ["sequenceType", ...r]] : m), As = c(zs, (0, R.followed)((0, R.or)([Ak([Zl], "intersectOp"), Ak([$l], "exceptOp")]), So), b), Bs = c(As, (0, R.or)([Ak([ql], "unionOp"), (0, R.followed)(Ak([am], "unionOp"), So)]), b), Cs = c(Bs, (0, R.or)([Ak([il], "multiplyOp"), (0, R.followed)(Ak([fm], "divOp"), So), (0, R.followed)(Ak([gm], "idivOp"), So), (0, R.followed)(Ak([hm], "modOp"), So)]), b), Ds = c(Cs, (0, R.or)([Ak([Dl], "subtractOp"), Ak([Cl], "addOp")]), b), Es = d(Ds, (0, R.followed)(Ak([bm], "rangeSequenceExpr"), So), "startExpr", "endExpr"), Fs = c(Es, Ak([rl], "stringConcatenateOp"), b), Gs = d(Fs, (0, R.or)([xp, yp, zp])), Hs = c(Gs, (0, R.followed)(Ak([em], "andOp"), So), b), or = c(Hs, (0, R.followed)(Ak([dm], "orOp"), So), b), ir = (0, R.then)((0, R.then)(T([rm, V, Hk, V], l), T([V, Ik, V, sm, So, V], k), (m, r) => [m, r]), T([V, tm, So, V], k), (m, r) => ["ifThenElseExpr", ["ifClause", m[0]], ["thenClause", m[1]], ["elseClause", r]]), Is = (0, R.delimited)(um, W, vm), Js = (0, R.map)(T([wm, W, kl], Po), (m) => ["positionalVariableBinding", ...m]), Ks = yk((0, R.preceded)(kl, (0, R.cut)(Po)), (0, R.cut)((0, R.preceded)(V, (0, R.optional)(uc))), (0, R.cut)((0, R.preceded)(V, (0, R.optional)(Is))), (0, R.cut)((0, R.preceded)(V, (0, R.optional)(Js))), (0, R.cut)((0, R.preceded)(S(xm, V), k)), (m, r, C, Z, da) => ["forClauseItem", ["typedVariableBinding", ["varName", ...m, ...r ? [r] : []]], ...C ? [["allowingEmpty"]] : [], ...Z ? [Z] : [], ["forExpr", da]]), Ls = T([ym, W], c(Ks, zl, (m, r) => [
      "forClause",
      m,
      ...r.map((C) => C[1])
    ])), Ms = wk((0, R.preceded)(kl, Po), (0, R.preceded)(V, (0, R.optional)(uc)), (0, R.preceded)(S(el, V), k), (m, r, C) => ["letClauseItem", ["typedVariableBinding", ["varName", ...m], ...r ? [r] : []], ["letExpr", C]]), Ns = (0, R.map)(T([zm, V], c(Ms, zl, (m, r) => [m, ...r.map((C) => C[1])])), (m) => ["letClause", ...m]), wj = (0, R.or)([Ls, Ns]), Os = (0, R.map)(T([Am, So, V], k), (m) => ["whereClause", m]), Ps = (0, R.map)((0, R.preceded)(kl, Po), (m) => ["varName", ...m]), Qs = (0, R.then)((0, R.preceded)(V, (0, R.optional)(uc)), (0, R.preceded)(S(el, V), k), (m, r) => ["groupVarInitialize", ...m ? [["typeDeclaration", ...m]] : [], ["varValue", r]]), Rs = wk(Ps, (0, R.optional)(Qs), (0, R.optional)((0, R.map)((0, R.preceded)(S(Bm, V), u), (m) => ["collation", m])), (m, r, C) => ["groupingSpec", m, ...r ? [r] : [], ...C ? [C] : []]), Ss = c(Rs, zl, (m, r) => [m, ...r.map((C) => C[1])]), Ts = (0, R.map)(T([Cm, W, Dm, V], Ss), (m) => ["groupByClause", ...m]), Us = wk((0, R.optional)((0, R.or)([On, Pn])), (0, R.optional)(T([V, vm, V], (0, R.or)([Zm, $m].map((m) => (0, R.map)(m, (r) => "empty " + r))))), (0, R.preceded)(V, (0, R.optional)(T([Bm, V], u))), (m, r, C) => m || r || C ? ["orderModifier", ...m ? [["orderingKind", m]] : [], ...r ? [["emptyOrderingMode", r]] : [], ...C ? [["collation", C]] : []] : null), Vs = (0, R.then)(k, (0, R.preceded)(V, Us), (m, r) => ["orderBySpec", ["orderByExpr", m], ...r ? [r] : []]), Ws = c(Vs, zl, (m, r) => [m, ...r.map((C) => C[1])]), Xs = (0, R.then)((0, R.or)([(0, R.map)(T([Em, W], Dm), () => false), (0, R.map)(T([Fm, W, Em, W], Dm), () => true)]), (0, R.preceded)(V, Ws), (m, r) => ["orderByClause", ...m ? [["stable"]] : [], ...r]), Ys = (0, R.or)([wj, Os, Ts, Xs]), Zs = (0, R.map)(T([Gm, V], k), (m) => [
      "returnClause",
      m
    ]), er = wk(wj, (0, R.cut)((0, R.star)((0, R.preceded)(V, Ys))), (0, R.cut)((0, R.preceded)(V, Zs)), (m, r, C) => ["flworExpr", m, ...r, C]), $s = c(db, ql, (m, r) => r.length === 0 ? ["sequenceType", ...m] : ["sequenceTypeUnion", ["sequenceType", ...m], ...r.map((C) => ["sequenceType", ...C[1]])]), at = wk(T([cn, V], (0, R.optional)((0, R.preceded)(kl, (0, R.followed)((0, R.followed)(Po, W), Kl)))), (0, R.preceded)(V, $s), T([W, Gm, W], k), (m, r, C) => ["typeswitchExprCaseClause"].concat(m ? [["variableBinding", ...m]] : [], [r], [["resultExpr", C]])), hr = xk((0, R.preceded)(dn, S((0, R.delimited)(Hk, S(l, V), Ik), V)), (0, R.plus)((0, R.followed)(at, V)), T([Sm, W], (0, R.optional)((0, R.preceded)(kl, (0, R.followed)(Po, W)))), T([Gm, W], k), (m, r, C, Z) => ["typeswitchExpr", ["argExpr", m], ...r, ["typeswitchExprDefaultClause", ...C || [], ["resultExpr", Z]]]), bt = wk((0, R.preceded)(kl, Po), (0, R.optional)((0, R.preceded)(W, uc)), (0, R.preceded)(S(xm, W), k), (m, r, C) => ["quantifiedExprInClause", ["typedVariableBinding", ["varName", ...m], ...r ? [r] : []], ["sourceExpr", C]]), ct = c(bt, zl, (m, r) => [m, ...r.map((C) => C[1])]), fr = wk((0, R.or)([en, fn]), (0, R.preceded)(W, ct), (0, R.preceded)(S(gn, V), k), (m, r, C) => ["quantifiedExpr", ["quantifier", m], ...r, ["predicateExpr", C]]), kr = (0, R.map)(T([Sl, W, (0, R.or)([Rl, Ql]), W], k), (m) => ["deleteExpr", ["targetExpr", m]]), mr = wk(T([hn, W], (0, R.optional)(T([Tl, W, Pl], W))), T([Ql, W], k), (0, R.preceded)(S(jn, W), k), (m, r, C) => m ? ["replaceExpr", ["replaceValue"], ["targetExpr", r], ["replacementExpr", C]] : ["replaceExpr", ["targetExpr", r], ["replacementExpr", C]]), dt = (0, R.then)(Ro, (0, R.preceded)(S(el, V), k), (m, r) => [
      "transformCopy",
      m,
      ["copySource", r]
    ]), nr = wk(T([kn, W], c(dt, zl, (m, r) => [m, ...r.map((C) => C[1])])), T([V, ln, W], k), (0, R.preceded)(S(Gm, W), k), (m, r, C) => ["transformExpr", ["transformCopies", ...m], ["modifyExpr", r], ["returnExpr", C]]), et = (0, R.or)([(0, R.followed)((0, R.map)((0, R.optional)((0, R.followed)(T([Kl, W], (0, R.or)([(0, R.map)(mn, () => ["insertAsFirst"]), (0, R.map)(nn, () => ["insertAsLast"])])), W)), (m) => m ? ["insertInto", m] : ["insertInto"]), qn), (0, R.map)(pn, () => ["insertAfter"]), (0, R.map)(on, () => ["insertBefore"])]), jr = wk(T([rn, W, (0, R.or)([
      Rl,
      Ql
    ]), W], k), (0, R.preceded)(W, et), (0, R.preceded)(W, k), (m, r, C) => ["insertExpr", ["sourceExpr", m], r, ["targetExpr", C]]), lr = (0, R.then)(T([sn, W, Ql, V], k), T([W, Kl, W], k), (m, r) => ["renameExpr", ["targetExpr", m], ["newNameExpr", r]]), ft = (0, R.then)((0, R.plus)((0, R.map)(T([cn, W], k), (m) => ["switchCaseExpr", m])), T([W, Gm, W], k), (m, r) => ["switchExprCaseClause", ...m, ["resultExpr", r]]), gr = wk(T([tn, V, Hk], l), T([V, Ik, V], (0, R.plus)((0, R.followed)(ft, V))), T([Sm, W, Gm, W], k), (m, r, C) => ["switchExpr", ["argExpr", m], ...r, [
      "switchExprDefaultClause",
      ["resultExpr", C]
    ]]), gt = (0, R.map)(l, (m) => ["queryBody", m]), ht = T([Rm, W, Jm, W], (0, R.cut)((0, R.then)(Go, (0, R.preceded)(S(ol, V), u), (m, r) => ["namespaceDecl", ["prefix", m], ["uri", r]]))), it = (0, R.then)(T([un, W, kl, V], (0, R.then)(Po, (0, R.optional)((0, R.preceded)(V, uc)), (m, r) => [m, r])), (0, R.cut)((0, R.or)([(0, R.map)(T([V, el, V], k), (m) => ["varValue", m]), (0, R.map)(T([W, vn], (0, R.optional)(T([V, el, V], k))), (m) => ["external", ...m ? [["varValue", m]] : []])])), ([m, r], C) => ["varDecl", ["varName", ...m], ...r !== null ? [r] : [], C]), jt = xk(T([
      Ul,
      W,
      (0, R.peek)((0, R.not)(ip, ["Cannot use reserved function name"]))
    ], Po), (0, R.cut)(T([V, Hk, V], (0, R.optional)(pj))), (0, R.cut)(T([V, Ik], (0, R.optional)(T([W, Kl, W], db)))), (0, R.cut)((0, R.preceded)(V, (0, R.or)([(0, R.map)(oj, (m) => ["functionBody", m]), (0, R.map)(vn, () => ["externalDefinition"])]))), (m, r, C, Z) => ["functionDecl", ["functionName", ...m], ["paramList", ...r || []], ...C ? [["typeDeclaration", ...C]] : [], Z]), kt = T([Rm, W], (0, R.then)((0, R.star)((0, R.followed)((0, R.or)([tf, Ap]), W)), (0, R.or)([it, jt]), (m, r) => [
      r[0],
      ...m,
      ...r.slice(1)
    ])), lt = (0, R.then)(T([Rm, W, Sm, W], (0, R.or)([Wl, Ul])), T([W, Jm, W], u), (m, r) => ["defaultNamespaceDecl", ["defaultNamespaceCategory", m], ["uri", r]]), mt = (0, R.or)([(0, R.map)((0, R.followed)(T([Jm, W], Go), (0, R.preceded)(V, ol)), (m) => ["namespacePrefix", m]), (0, R.map)(T([Sm, W, Wl, W], Jm), () => ["defaultElementNamespace"])]), nt = T([xn, W, yn], wk((0, R.optional)((0, R.preceded)(W, mt)), (0, R.preceded)(V, u), (0, R.optional)((0, R.then)(T([W, wm, W], u), (0, R.star)(T([V, zl, V], u)), (m, r) => [m, ...r])), (m, r, C) => ["schemaImport", ...m ? [m] : [], ["targetNamespace", r], ...C ? [C] : []])), ot = T([xn, W, zn], wk((0, R.optional)((0, R.followed)(T([W, Jm, W], Go), (0, R.preceded)(V, ol))), (0, R.preceded)(V, u), (0, R.optional)((0, R.then)(T([W, wm, W], u), (0, R.star)(T([V, zl, V], u)), (m, r) => [m, ...r])), (m, r) => ["moduleImport", ["namespacePrefix", m], ["targetNamespace", r]])), pt = (0, R.or)([nt, ot]), qt = (0, R.map)(T([Rm, W, Sm, W, Bm, W], u), (m) => ["defaultCollationDecl", m]), rt = (0, R.map)(T([Rm, W, An, W], u), (m) => ["baseUriDecl", m]), st = (0, R.then)(T([Rm, W], (0, R.or)([(0, R.map)(T([bn, W], Po), (m) => ["decimalFormatName", ...m]), (0, R.map)(T([Sm, W], bn), () => null)])), (0, R.star)((0, R.then)((0, R.preceded)(W, Dp), (0, R.preceded)(S(ol, W), u), (m, r) => ["decimalFormatParam", ["decimalFormatParamName", m], ["decimalFormatParamValue", r]])), (m, r) => ["decimalFormatDecl", ...m ? [m] : [], ...r]), tt = (0, R.or)([Ep, qt, rt, Fp, Gp, Hp, Ip, st]), ut = (0, R.then)(T([Rm, W, Fn, W], Po), (0, R.preceded)(W, u), (m, r) => ["optionDecl", ["optionName", m], ["optionContents", r]]), vt = (0, R.then)(T([Rm, W, Gn, W, Hn], (0, R.optional)(T([W, Kl], mj))), (0, R.or)([(0, R.map)((0, R.preceded)(S(el, V), k), (m) => ["varValue", m]), (0, R.map)(T([W, vn], (0, R.optional)((0, R.preceded)(S(el, V), k))), () => ["external"])]), (m, r) => ["contextItemDecl", ...m ? [["contextItemType", m]] : [], r]), xj = (0, R.then)((0, R.star)((0, R.followed)((0, R.or)([lt, tt, ht, pt]), (0, R.cut)(S(hl, V)))), (0, R.star)((0, R.followed)((0, R.or)([vt, kt, ut]), (0, R.cut)(S(hl, V)))), (m, r) => m.length === 0 && r.length === 0 ? null : ["prolog", ...m, ...r]), wt = T([zn, W, Jm, W], (0, R.then)((0, R.followed)(Go, S(ol, V)), (0, R.followed)(u, S(hl, V)), (m, r) => ["moduleDecl", ["prefix", m], [
      "uri",
      r
    ]])), xt = (0, R.then)(wt, (0, R.preceded)(V, xj), (m, r) => ["libraryModule", m, ...r ? [r] : []]), yt = (0, R.then)(xj, (0, R.preceded)(V, gt), (m, r) => ["mainModule", ...m ? [m] : [], r]), zt = (0, R.map)(T([In, V], (0, R.followed)((0, R.or)([(0, R.then)((0, R.preceded)(Kn, W), u, (m) => ["encoding", m]), (0, R.then)(T([Jn, W], u), (0, R.optional)(T([W, Kn, W], u)), (m, r) => [["version", m], ...r ? [["encoding", r]] : []])]), (0, R.preceded)(V, hl))), (m) => ["versionDecl", ...m]), At = (0, R.then)((0, R.optional)(S(zt, V)), (0, R.or)([xt, yt]), (m, r) => [
      "module",
      ...m ? [m] : [],
      r
    ]), Bt = (0, R.complete)(S(At, V));
    return (m, r) => {
      n.clear();
      r = Bt(m, r);
      let C = 1, Z = 1;
      for (let xa = 0; xa < m.length + 1; xa++) {
        if (n.has(xa)) {
          var da = n.get(xa);
          da.line = Z;
          da.ha = C;
        }
        da = m[xa];
        da === "\r" || da === "\n" ? (Z++, C = 1) : C++;
      }
      return r;
    };
  }
  const Sp = Rp({lb: false, Ya: false}), Tp = Rp({lb: true, Ya: false}), Up = Rp({lb: false, Ya: true}), Vp = Rp({lb: true, Ya: true});
  function Wp(a, b) {
    var c = !!b.Z;
    b = !!b.debug;
    xo.clear();
    yo.clear();
    Qp.clear();
    c = c ? b ? Vp(a, 0) : Up(a, 0) : b ? Tp(a, 0) : Sp(a, 0);
    if (c.success === true)
      return c.value;
    a = a.substring(0, c.offset).split("\n");
    b = a[a.length - 1].length + 1;
    throw new yh({start: {offset: c.offset, line: a.length, ha: b}, end: {offset: c.offset + 1, line: a.length, ha: b + 1}}, "", Error(`XPST0003: Failed to parse script. Expected ${[...new Set(c.expected)]}`));
  }
  const Xp = "http://www.w3.org/XML/1998/namespace http://www.w3.org/2001/XMLSchema http://www.w3.org/2001/XMLSchema-instance http://www.w3.org/2005/xpath-functions http://www.w3.org/2005/xpath-functions/math http://www.w3.org/2012/xquery http://www.w3.org/2005/xpath-functions/array http://www.w3.org/2005/xpath-functions/map".split(" ");
  function Yp(a, b, c, d, e) {
    var f = G(a, "functionName"), h = I(f, "prefix") || "";
    let k = I(f, "URI");
    const l = H(f);
    if (k === null && (k = h === "" ? b.v === null ? "http://www.w3.org/2005/xpath-functions" : b.v : b.$(h), !k && h))
      throw gg(h);
    if (Xp.includes(k))
      throw ag();
    h = K(a, "annotation").map((z) => G(z, "annotationName"));
    f = h.every((z) => !I(z, "URI") && H(z) !== "private");
    h = h.some((z) => !I(z, "URI") && H(z) === "updating");
    if (!k)
      throw cg();
    const n = sg(a), t = K(G(a, "paramList"), "param"), u = t.map((z) => G(z, "varName")), y = t.map((z) => sg(z));
    if (a = G(a, "functionBody")) {
      if (b.ta(k, l, y.length))
        throw bg(k, l);
      if (!e)
        return;
      const z = kk(a[1], {qa: false, Z: true}), F = new jg(b), O = u.map((U) => {
        let ba = I(U, "URI");
        const Ga = I(U, "prefix");
        U = H(U);
        Ga && ba === null && (ba = b.$(Ga || ""));
        return og(F, ba, U);
      });
      e = h ? {j: y, arity: u.length, callFunction: (U, ba, Ga, ...Eb) => {
        U = hc(bc(U, -1, null, w.empty()), O.reduce((Vb, bd, Wb) => {
          Vb[bd] = Ra(Eb[Wb]);
          return Vb;
        }, Object.create(null)));
        return z.s(U, ba);
      }, ub: false, J: true, bb: f, localName: l, namespaceURI: k, i: n} : {j: y, arity: u.length, callFunction: (U, ba, Ga, ...Eb) => {
        U = hc(bc(U, -1, null, w.empty()), O.reduce((Vb, bd, Wb) => {
          Vb[bd] = Ra(Eb[Wb]);
          return Vb;
        }, Object.create(null)));
        return B(z, U, ba);
      }, ub: false, J: false, bb: f, localName: l, namespaceURI: k, i: n};
      c.push({ba: z, Cb: F});
      d.push({arity: u.length, ba: z, yb: e, localName: l, namespaceURI: k, bb: f});
    } else {
      if (h)
        throw Error("Updating external function declarations are not supported");
      e = {j: y, arity: u.length, callFunction: (z, F, O, ...U) => {
        const ba = O.ta(k, l, u.length, true);
        if (!ba)
          throw Error(`XPST0017: Function Q{${k}}${l} with arity of ${u.length} not registered. ${Uf(l)}`);
        if (ba.i.type !== n.type || ba.j.some((Ga, Eb) => Ga.type !== y[Eb].type))
          throw Error("External function declaration types do not match actual function");
        return ba.callFunction(z, F, O, ...U);
      }, ub: true, J: false, localName: l, namespaceURI: k, bb: f, i: n};
    }
    mg(b, k, l, u.length, e);
  }
  function Zp(a, b, c, d) {
    const e = [], f = [];
    K(a, "*").forEach((t) => {
      switch (t[0]) {
        case "moduleImport":
        case "namespaceDecl":
        case "defaultNamespaceDecl":
        case "functionDecl":
        case "varDecl":
          break;
        default:
          throw Error("Not implemented: only module imports, namespace declarations, and function declarations are implemented in XQuery modules");
      }
    });
    const h = new Set();
    K(a, "moduleImport").forEach((t) => {
      const u = H(G(t, "namespacePrefix"));
      t = H(G(t, "targetNamespace"));
      if (h.has(t))
        throw Error(`XQST0047: The namespace "${t}" is imported more than once.`);
      h.add(t);
      ng(b, u, t);
    });
    K(a, "namespaceDecl").forEach((t) => {
      const u = H(G(t, "prefix"));
      t = H(G(t, "uri"));
      if (u === "xml" || u === "xmlns")
        throw eg();
      if (t === "http://www.w3.org/XML/1998/namespace" || t === "http://www.w3.org/2000/xmlns/")
        throw eg();
      ng(b, u, t);
    });
    let k = null, l = null;
    for (const t of K(a, "defaultNamespaceDecl")) {
      const u = H(G(t, "defaultNamespaceCategory")), y = H(G(t, "uri"));
      if (!y)
        throw cg();
      if (y === "http://www.w3.org/XML/1998/namespace" || y === "http://www.w3.org/2000/xmlns/")
        throw eg();
      if (u === "function") {
        if (k)
          throw dg();
        k = y;
      } else if (u === "element") {
        if (l)
          throw dg();
        l = y;
      }
    }
    k && (b.v = k);
    l && ng(b, "", l);
    K(a, "functionDecl").forEach((t) => {
      Yp(t, b, e, f, c);
    });
    const n = [];
    K(a, "varDecl").forEach((t) => {
      const u = rg(G(t, "varName"));
      let y = u.namespaceURI;
      if (y === null && (y = b.$(u.prefix), !y && u.prefix))
        throw gg(u.prefix);
      if (Xp.includes(y))
        throw ag();
      var z = G(t, "external");
      t = G(t, "varValue");
      let F, O;
      z !== null ? (z = G(z, "varValue"), z !== null && (F = G(z, "*"))) : t !== null && (F = G(t, "*"));
      if (n.some((U) => U.namespaceURI === y && U.localName === u.localName))
        throw Error(`XQST0049: The variable ${y ? `Q{${y}}` : ""}${u.localName} has already been declared.`);
      og(b, y || "", u.localName);
      if (c && (F && (O = kk(F, {qa: false, Z: true})), F && !lg(b, y || "", u.localName))) {
        let U = null;
        pg(b, y, u.localName, (ba, Ga) => {
          if (U)
            return U();
          U = Ra(B(O, ba, Ga));
          return U();
        });
        e.push({ba: O, Cb: new jg(b)});
        n.push({ba: O, localName: u.localName, namespaceURI: y});
      }
    });
    f.forEach((t) => {
      if (!t.yb.J && t.ba.J)
        throw we(`The function Q{${t.namespaceURI}}${t.localName} is updating but the %updating annotation is missing.`);
    });
    return {
      Ha: f.map((t) => t.yb),
      Ta: n,
      source: d,
      oa: (t) => {
        h.forEach((u) => {
          sk(b, u);
        });
        e.forEach(({ba: u, Cb: y}) => {
          h.forEach((z) => {
            sk(y, z);
          });
          t.Ha.forEach((z) => {
            y.ta(z.namespaceURI, z.localName, z.arity, true) || z.bb && mg(y, z.namespaceURI, z.localName, z.arity, z);
          });
          t.Ta.forEach((z) => {
            y.cb(z.namespaceURI, z.localName) || og(y, z.namespaceURI, z.localName);
          });
          u.v(y);
        });
      }
    };
  }
  function $p(a, b, c, d, e, f, h) {
    const k = b.Z ? "XQuery" : "XPath";
    c = b.Ga ? null : nk(a, k, c, d, e, b.debug, f, h);
    return c !== null ? {state: c.ec ? 1 : 2, ba: c.ba} : {state: 0, Wb: typeof a === "string" ? Wp(a, b) : pk(a)};
  }
  function aq(a, b, c, d) {
    const e = G(a, "mainModule");
    if (!e)
      throw Error("Can not execute a library module.");
    const f = G(e, "prolog");
    if (f) {
      if (!b.Z)
        throw Error("XPST0003: Use of XQuery functionality is not allowed in XPath context");
      tk();
      d = Zp(f, c, true, d);
      d.oa(d);
    }
    N(a, new Zg(c));
    a = J(e, ["queryBody", "*"]);
    return Q(a, b);
  }
  function bq(a, b, c, d, e, f, h) {
    const k = new Yf(c, d, f, h), l = new jg(k);
    0 < Object.keys(e).length && tk();
    Object.keys(e).forEach((n) => {
      const t = e[n];
      sk(l, t);
      ng(l, n, t);
    });
    typeof a === "string" && (a = uk(a));
    c = $p(a, b, c, d, e, f, h);
    switch (c.state) {
      case 2:
        return {ga: l, ba: c.ba};
      case 1:
        return c.ba.v(l), ok(a, b.Z ? "XQuery" : "XPath", k, e, c.ba, b.debug, f), {ga: l, ba: c.ba};
      case 0:
        return c = aq(c.Wb, b, l, a), c.v(l), b.Ga || ok(a, b.Z ? "XQuery" : "XPath", k, e, c, b.debug, f), {ga: l, ba: c};
    }
  }
  function cq(a) {
    if (v(a.type, 1))
      return a.value;
    if (v(a.type, 54))
      return a.value.node;
    throw mc(`Unable to convert selector argument of type ${Ea[a.type]} to either an ${Ea[1]} or an ${Ea[54]} representing an XQueryX program while calling 'fontoxpath:evaluate'`);
  }
  function dq(a, b, c, d) {
    a = a.first();
    const e = b.first().h.reduce((f, h) => {
      f[h.key.value] = Ra(h.value());
      return f;
    }, Object.create(null));
    b = e["."] ? e["."]() : w.empty();
    delete e["."];
    try {
      const {ba: f, ga: h} = bq(cq(a), {qa: false, Z: true, debug: d.debug, Ga: d.Ga}, (n) => c.$(n), Object.keys(e).reduce((n, t) => {
        n[t] = t;
        return n;
      }, {}), {}, "http://www.w3.org/2005/xpath-functions", (n, t) => c.Sa(n, t)), k = !b.G(), l = new cc({N: k ? b.first() : null, Fa: k ? 0 : -1, za: b, wa: Object.keys(e).reduce((n, t) => {
        n[h.cb(null, t)] = e[t];
        return n;
      }, Object.create(null))});
      return {fc: f.h(l, d).value, cc: a};
    } catch (f) {
      Pf(a.value, f);
    }
  }
  function eq(a, b, c) {
    if (b.node.nodeType !== 1 && b.node.nodeType !== 9)
      return [];
    const d = hb(a, b).reduce((e, f) => {
      for (const h of eq(a, f, c))
        e.push(h);
      return e;
    }, []);
    c(b) && d.unshift(b);
    return d;
  }
  const fq = (a, b, c, d, e) => {
    a = e.first();
    if (!a)
      throw lc("The context is absent, it needs to be present to use id function.");
    if (!v(a.type, 53))
      throw mc("The context item is not a node, it needs to be node to use id function.");
    const f = b.h, h = d.O().reduce((k, l) => {
      l.value.split(/\s+/).forEach((n) => {
        k[n] = true;
      });
      return k;
    }, Object.create(null));
    for (b = a.value; b.node.nodeType !== 9; )
      if (b = x(f, b), b === null)
        throw Error("FODC0001: the root node of the target node is not a document node.");
    b = eq(f, b, (k) => {
      if (k.node.nodeType !== 1)
        return false;
      k = gb(f, k, "id");
      if (!k || !h[k])
        return false;
      h[k] = false;
      return true;
    });
    return w.create(b.map((k) => rb(k)));
  }, gq = (a, b, c, d, e) => {
    a = e.first();
    if (!a)
      throw lc("The context is absent, it needs to be present to use idref function.");
    if (!v(a.type, 53))
      throw mc("The context item is not a node, it needs to be node to use idref function.");
    const f = b.h, h = d.O().reduce((k, l) => {
      k[l.value] = true;
      return k;
    }, Object.create(null));
    for (b = a.value; b.node.nodeType !== 9; )
      if (b = x(f, b), b === null)
        throw Error("FODC0001: the root node of the context node is not a document node.");
    b = eq(f, b, (k) => k.node.nodeType !== 1 ? false : (k = gb(f, k, "idref")) ? k.split(/\s+/).some((l) => h[l]) : false);
    return w.create(b.map((k) => rb(k)));
  };
  function hq(a) {
    switch (typeof a) {
      case "object":
        return Array.isArray(a) ? w.m(new pb(a.map((b) => Ra(hq(b))))) : a === null ? w.empty() : w.m(new ub(Object.keys(a).map((b) => ({key: g(b, 1), value: Ra(hq(a[b]))}))));
      case "number":
        return w.m(g(a, 3));
      case "string":
        return w.m(g(a, 1));
      case "boolean":
        return a ? w.aa() : w.V();
      default:
        throw Error("Unexpected type in JSON parse");
    }
  }
  const iq = (a, b, c, d, e) => {
    const f = w.m(g("duplicates", 1));
    a = tb(a, b, c, e, f);
    const h = a.G() ? "use-first" : a.first().value;
    return d.M((k) => w.m(new ub(k.reduce((l, n) => {
      n.h.forEach((t) => {
        const u = l.findIndex((y) => sb(y.key, t.key));
        if (0 <= u)
          switch (h) {
            case "reject":
              throw Error("FOJS0003: Duplicate encountered when merging maps.");
            case "use-last":
              l.splice(u, 1, t);
              return;
            case "combine":
              l.splice(u, 1, {key: t.key, value: Ra(w.create(l[u].value().O().concat(t.value().O())))});
              return;
            default:
              return;
          }
        l.push(t);
      });
      return l;
    }, []))));
  };
  function jq(a, b, c) {
    let d = 1;
    const e = a.value;
    a = a.Pa(true);
    let f = null;
    const h = Math.max(b - 1, 0);
    a !== -1 && (f = Math.max(0, (c === null ? a : Math.max(0, Math.min(a, c + (b - 1)))) - h));
    return w.create({next: (k) => {
      for (; d < b; )
        e.next(k), d++;
      if (c !== null && d >= b + c)
        return p;
      k = e.next(k);
      d++;
      return k;
    }}, f);
  }
  function kq(a) {
    return a.map((b) => v(b.type, 19) ? jd(b, 3) : b);
  }
  function lq(a) {
    a = kq(a);
    if (a.some((b) => Number.isNaN(b.value)))
      return [g(NaN, 3)];
    a = qi(a);
    if (!a)
      throw Error("FORG0006: Incompatible types to be converted to a common type");
    return a;
  }
  const mq = (a, b, c, d, e, f) => A([e, f], ([h, k]) => {
    if (h.value === Infinity)
      return w.empty();
    if (h.value === -Infinity)
      return k && k.value === Infinity ? w.empty() : d;
    if (k) {
      if (isNaN(k.value))
        return w.empty();
      k.value === Infinity && (k = null);
    }
    return isNaN(h.value) ? w.empty() : jq(d, Math.round(h.value), k ? Math.round(k.value) : null);
  }), nq = (a, b, c, d, e) => {
    if (d.G())
      return e;
    a = kq(d.O());
    a = qi(a);
    if (!a)
      throw Error("FORG0006: Incompatible types to be converted to a common type");
    if (!a.every((f) => v(f.type, 2)))
      throw Error("FORG0006: items passed to fn:sum are not all numeric.");
    b = a.reduce((f, h) => f + h.value, 0);
    return a.every((f) => v(f.type, 5)) ? w.m(g(b, 5)) : a.every((f) => v(f.type, 3)) ? w.m(g(b, 3)) : a.every((f) => v(f.type, 4)) ? w.m(g(b, 4)) : w.m(g(b, 6));
  };
  var oq = [].concat(pf, [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "boolean", j: [{type: 59, g: 2}], i: {type: 0, g: 3}, callFunction: (a, b, c, d) => d.fa() ? w.aa() : w.V()}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "true", j: [], i: {type: 0, g: 3}, callFunction: () => w.aa()}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "not", j: [{type: 59, g: 2}], i: {type: 0, g: 3}, callFunction: (a, b, c, d) => d.fa() === false ? w.aa() : w.V()}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "false",
    j: [],
    i: {type: 0, g: 3},
    callFunction: () => w.V()
  }], [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "last", j: [], i: {type: 5, g: 3}, callFunction: (a) => {
    if (a.N === null)
      throw lc("The fn:last() function depends on dynamic context, which is absent.");
    let b = false;
    return w.create({next: () => {
      if (b)
        return p;
      const c = a.za.Pa();
      b = true;
      return q(g(c, 5));
    }}, 1);
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "position", j: [], i: {type: 5, g: 3}, callFunction: (a) => {
    if (a.N === null)
      throw lc("The fn:position() function depends on dynamic context, which is absent.");
    return w.m(g(a.Fa + 1, 5));
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "current-dateTime", j: [], i: {type: 10, g: 3}, callFunction: (a) => w.m(g(ec(a), 10))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "current-date", j: [], i: {type: 7, g: 3}, callFunction: (a) => w.m(g(Lb(ec(a), 7), 7))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "current-time", j: [], i: {type: 8, g: 3}, callFunction: (a) => w.m(g(Lb(ec(a), 8), 8))}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "implicit-timezone",
    j: [],
    i: {type: 17, g: 3},
    callFunction: (a) => w.m(g(fc(a), 17))
  }], vf, Df, Kf, [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "years-from-duration", j: [{type: 18, g: 0}], i: {type: 5, g: 0}, callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.ab(), 5))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "months-from-duration", j: [{type: 18, g: 0}], i: {type: 5, g: 0}, callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.$a(), 5))}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "days-from-duration",
    j: [{type: 18, g: 0}],
    i: {type: 5, g: 0},
    callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.Za(), 5))
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "hours-from-duration", j: [{type: 18, g: 0}], i: {type: 5, g: 0}, callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getHours(), 5))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "minutes-from-duration", j: [{type: 18, g: 0}], i: {type: 5, g: 0}, callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getMinutes(), 5))}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "seconds-from-duration",
    j: [{type: 18, g: 0}],
    i: {type: 4, g: 0},
    callFunction: (a, b, c, d) => d.G() ? d : w.m(g(d.first().value.getSeconds(), 4))
  }], Mf, [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "id", j: [{type: 1, g: 2}, {type: 53, g: 3}], i: {type: 54, g: 2}, callFunction: fq}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "id", j: [{type: 1, g: 2}], i: {type: 54, g: 2}, callFunction(a, b, c, d) {
    return fq(a, b, c, d, w.m(a.N));
  }}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    localName: "idref",
    j: [{type: 1, g: 2}, {type: 53, g: 3}],
    i: {type: 53, g: 2},
    callFunction: gq
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "idref", j: [{type: 1, g: 2}], i: {type: 53, g: 2}, callFunction(a, b, c, d) {
    return gq(a, b, c, d, w.m(a.N));
  }}], [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "parse-json", j: [{type: 1, g: 3}], i: {type: 59, g: 0}, callFunction: (a, b, c, d) => {
    let e;
    try {
      e = JSON.parse(d.first().value);
    } catch (f) {
      throw Error("FOJS0001: parsed JSON string contains illegal JSON.");
    }
    return hq(e);
  }}], [{
    namespaceURI: "http://www.w3.org/2005/xpath-functions/map",
    localName: "contains",
    j: [{type: 61, g: 3}, {type: 46, g: 3}],
    i: {type: 0, g: 3},
    callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => f.h.some((k) => sb(k.key, h)) ? w.aa() : w.V())
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "entry", j: [{type: 46, g: 3}, {type: 59, g: 2}], i: {type: 61, g: 3}, callFunction: (a, b, c, d, e) => d.map((f) => new ub([{key: f, value: Ra(e)}]))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "for-each", j: [{type: 61, g: 3}, {type: 59, g: 2}], i: {type: 59, g: 2}, callFunction: (a, b, c, d, e) => A([
    d,
    e
  ], ([f, h]) => jc(f.h.map((k) => h.value.call(void 0, a, b, c, w.m(k.key), k.value()))))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "get", j: [{type: 61, g: 3}, {type: 46, g: 3}], i: {type: 59, g: 2}, callFunction: tb}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "keys", j: [{type: 61, g: 3}], i: {type: 46, g: 2}, callFunction: (a, b, c, d) => A([d], ([e]) => w.create(e.h.map((f) => f.key)))}, {
    namespaceURI: "http://www.w3.org/2005/xpath-functions/map",
    localName: "merge",
    j: [{type: 61, g: 2}, {type: 61, g: 3}],
    i: {type: 61, g: 3},
    callFunction: iq
  }, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "merge", j: [{type: 61, g: 2}], i: {type: 61, g: 3}, callFunction(a, b, c, d) {
    return iq(a, b, c, d, w.m(new ub([{key: g("duplicates", 1), value: () => w.m(g("use-first", 1))}])));
  }}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "put", j: [{type: 61, g: 3}, {type: 46, g: 3}, {type: 59, g: 2}], i: {type: 61, g: 3}, callFunction: (a, b, c, d, e, f) => A([d, e], ([h, k]) => {
    h = h.h.concat();
    const l = h.findIndex((n) => sb(n.key, k));
    0 <= l ? h.splice(l, 1, {key: k, value: Ra(f)}) : h.push({key: k, value: Ra(f)});
    return w.m(new ub(h));
  })}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "remove", j: [{type: 61, g: 3}, {type: 46, g: 2}], i: {type: 61, g: 3}, callFunction: (a, b, c, d, e) => A([d], ([f]) => {
    const h = f.h.concat();
    return e.M((k) => {
      k.forEach((l) => {
        const n = h.findIndex((t) => sb(t.key, l));
        0 <= n && h.splice(n, 1);
      });
      return w.m(new ub(h));
    });
  })}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/map", localName: "size", j: [{type: 61, g: 3}], i: {type: 5, g: 3}, callFunction: (a, b, c, d) => d.map((e) => g(e.h.length, 5))}], [{namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "pi", j: [], i: {type: 3, g: 3}, callFunction: () => w.m(g(Math.PI, 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "exp", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.pow(Math.E, e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "exp10", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.pow(10, e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "log", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.log(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "log10", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.log10(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "pow", j: [{type: 3, g: 0}, {type: 2, g: 3}], i: {type: 3, g: 0}, callFunction: (a, b, c, d, e) => e.M(([f]) => d.map((h) => Math.abs(h.value) !== 1 || Number.isFinite(f.value) ? g(Math.pow(h.value, f.value), 3) : g(1, 3)))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "sqrt", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.sqrt(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "sin", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.sin(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "cos", j: [{
    type: 3,
    g: 0
  }], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.cos(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "tan", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.tan(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "asin", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.asin(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "acos", j: [{
    type: 3,
    g: 0
  }], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.acos(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "atan", j: [{type: 3, g: 0}], i: {type: 3, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(Math.atan(e.value), 3))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions/math", localName: "atan2", j: [{type: 3, g: 0}, {type: 3, g: 3}], i: {type: 3, g: 0}, callFunction: (a, b, c, d, e) => e.M(([f]) => d.map((h) => g(Math.atan2(h.value, f.value), 3)))}], je, Md, [{
    namespaceURI: "http://fontoxpath/operators",
    localName: "to",
    j: [{type: 5, g: 0}, {type: 5, g: 0}],
    i: {type: 5, g: 2},
    callFunction: (a, b, c, d, e) => {
      a = d.first();
      e = e.first();
      if (a === null || e === null)
        return w.empty();
      let f = a.value;
      e = e.value;
      return f > e ? w.empty() : w.create({next: () => q(g(f++, 5))}, e - f + 1);
    }
  }], [{namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "QName", j: [{type: 1, g: 0}, {type: 1, g: 3}], i: {type: 23, g: 3}, callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
    h = h.value;
    if (!tc(h, 23))
      throw Error("FOCA0002: The provided QName is invalid.");
    f = f ? f.value || null : null;
    if (f === null && h.includes(":"))
      throw Error("FOCA0002: The URI of a QName may not be empty if a prefix is provided.");
    if (d.G())
      return w.m(g(new Ta("", null, h), 23));
    if (!h.includes(":"))
      return w.m(g(new Ta("", f, h), 23));
    const [k, l] = h.split(":");
    return w.m(g(new Ta(k, f, l), 23));
  })}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "prefix-from-QName", j: [{type: 23, g: 0}], i: {type: 24, g: 0}, callFunction: (a, b, c, d) => A([d], ([e]) => {
    if (e === null)
      return w.empty();
    e = e.value;
    return e.prefix ? w.m(g(e.prefix, 24)) : w.empty();
  })}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "local-name-from-QName", j: [{type: 23, g: 0}], i: {type: 24, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(e.value.localName, 24))}, {namespaceURI: "http://www.w3.org/2005/xpath-functions", localName: "namespace-uri-from-QName", j: [{type: 23, g: 0}], i: {type: 20, g: 0}, callFunction: (a, b, c, d) => d.map((e) => g(e.value.namespaceURI || "", 20))}], [{
    j: [{type: 59, g: 2}],
    callFunction: (a, b, c, d) => d.Y({empty: () => w.aa(), multiple: () => w.V(), m: () => w.V()}),
    localName: "empty",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 0, g: 3}
  }, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => d.Y({empty: () => w.V(), multiple: () => w.aa(), m: () => w.aa()}), localName: "exists", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 3}}, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => jq(d, 1, 1), localName: "head", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 0}}, {
    j: [{type: 59, g: 2}],
    callFunction: (a, b, c, d) => jq(d, 2, null),
    localName: "tail",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 2}
  }, {j: [{type: 59, g: 2}, {type: 5, g: 3}, {type: 59, g: 2}], callFunction: (a, b, c, d, e, f) => {
    if (d.G())
      return f;
    if (f.G())
      return d;
    a = d.O();
    e = e.first().value - 1;
    0 > e ? e = 0 : e > a.length && (e = a.length);
    b = a.slice(e);
    return w.create(a.slice(0, e).concat(f.O(), b));
  }, localName: "insert-before", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {
    j: [{type: 59, g: 2}, {type: 5, g: 3}],
    callFunction: (a, b, c, d, e) => {
      a = e.first().value;
      d = d.O();
      if (!d.length || 1 > a || a > d.length)
        return w.create(d);
      d.splice(a - 1, 1);
      return w.create(d);
    },
    localName: "remove",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 2}
  }, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => d.M((e) => w.create(e.reverse())), localName: "reverse", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {j: [{type: 59, g: 2}, {type: 3, g: 3}], callFunction: (a, b, c, d, e) => mq(a, b, c, d, e, w.empty()), localName: "subsequence", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {
    j: [{type: 59, g: 2}, {type: 3, g: 3}, {type: 3, g: 3}],
    callFunction: mq,
    localName: "subsequence",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 2}
  }, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => d, localName: "unordered", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {j: [{type: 46, g: 2}], callFunction: (a, b, c, d) => {
    const e = qc(d, b).O();
    return w.create(e).filter((f, h) => e.slice(0, h).every((k) => !me(f, k)));
  }, localName: "distinct-values", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 2}}, {j: [{type: 46, g: 2}, {type: 1, g: 3}], callFunction() {
    throw Error("FOCH0002: No collations are supported");
  }, localName: "distinct-values", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 2}}, {j: [{type: 46, g: 2}, {type: 46, g: 3}], callFunction: (a, b, c, d, e) => e.M(([f]) => qc(d, b).map((h, k) => Xh("eqOp", h.type, f.type)(h, f, a) ? g(k + 1, 5) : g(-1, 5)).filter((h) => h.value !== -1)), localName: "index-of", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 5, g: 2}}, {
    j: [{type: 46, g: 2}, {type: 46, g: 3}, {type: 1, g: 3}],
    callFunction() {
      throw Error("FOCH0002: No collations are supported");
    },
    localName: "index-of",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 5, g: 2}
  }, {j: [{type: 59, g: 2}, {type: 59, g: 2}], callFunction: (a, b, c, d, e) => {
    let f = false;
    const h = pe(a, b, c, d, e);
    return w.create({next: () => {
      if (f)
        return p;
      const k = h.next(0);
      if (k.done)
        return k;
      f = true;
      return q(g(k.value, 0));
    }});
  }, localName: "deep-equal", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 0, g: 3}}, {
    j: [{type: 59, g: 2}, {type: 59, g: 2}, {type: 1, g: 3}],
    callFunction() {
      throw Error("FOCH0002: No collations are supported");
    },
    localName: "deep-equal",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 0, g: 3}
  }, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => {
    let e = false;
    return w.create({next: () => {
      if (e)
        return p;
      const f = d.Pa();
      e = true;
      return q(g(f, 5));
    }});
  }, localName: "count", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 5, g: 3}}, {j: [{type: 46, g: 2}], callFunction: (a, b, c, d) => {
    if (d.G())
      return d;
    a = kq(d.O());
    a = qi(a);
    if (!a)
      throw Error("FORG0006: Incompatible types to be converted to a common type");
    if (!a.every((e) => v(e.type, 2)))
      throw Error("FORG0006: items passed to fn:avg are not all numeric.");
    b = a.reduce((e, f) => e + f.value, 0) / a.length;
    return a.every((e) => v(e.type, 5) || v(e.type, 3)) ? w.m(g(b, 3)) : a.every((e) => v(e.type, 4)) ? w.m(g(b, 4)) : w.m(g(b, 6));
  }, localName: "avg", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {j: [{type: 46, g: 2}], callFunction: (a, b, c, d) => {
    if (d.G())
      return d;
    a = lq(d.O());
    return w.m(a.reduce((e, f) => e.value < f.value ? f : e));
  }, localName: "max", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {j: [{type: 46, g: 2}, {type: 1, g: 3}], callFunction() {
    throw Error("FOCH0002: No collations are supported");
  }, localName: "max", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {j: [{type: 46, g: 2}], callFunction: (a, b, c, d) => {
    if (d.G())
      return d;
    a = lq(d.O());
    return w.m(a.reduce((e, f) => e.value > f.value ? f : e));
  }, localName: "min", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {j: [{type: 46, g: 2}, {type: 1, g: 3}], callFunction() {
    throw Error("FOCH0002: No collations are supported");
  }, localName: "min", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {j: [{
    type: 46,
    g: 2
  }], callFunction: (a, b, c, d) => nq(a, b, c, d, w.m(g(0, 5))), localName: "sum", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 3}}, {j: [{type: 46, g: 2}, {type: 46, g: 0}], callFunction: nq, localName: "sum", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 46, g: 0}}, {
    j: [{type: 59, g: 2}],
    callFunction: (a, b, c, d) => {
      if (!d.G() && !d.sa())
        throw Error("FORG0003: The argument passed to fn:zero-or-one contained more than one item.");
      return d;
    },
    localName: "zero-or-one",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 0}
  }, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => {
    if (d.G())
      throw Error("FORG0004: The argument passed to fn:one-or-more was empty.");
    return d;
  }, localName: "one-or-more", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 1}}, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => {
    if (!d.sa())
      throw Error("FORG0005: The argument passed to fn:exactly-one is empty or contained more than one item.");
    return d;
  }, localName: "exactly-one", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {
    type: 59,
    g: 3
  }}, {
    j: [{type: 59, g: 2}, {type: 60, g: 3}],
    callFunction: (a, b, c, d, e) => {
      if (d.G())
        return d;
      const f = e.first(), h = f.o;
      if (h.length !== 1)
        throw Error("XPTY0004: signature of function passed to fn:filter is incompatible.");
      return d.filter((k) => {
        k = Ad(h[0], w.m(k), b, "fn:filter", false);
        k = f.value.call(void 0, a, b, c, k);
        if (!k.sa() || !v(k.first().type, 0))
          throw Error("XPTY0004: signature of function passed to fn:filter is incompatible.");
        return k.first().value;
      });
    },
    localName: "filter",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 2}
  }, {
    j: [{type: 59, g: 2}, {type: 60, g: 3}],
    callFunction: (a, b, c, d, e) => {
      if (d.G())
        return d;
      const f = e.first(), h = f.o;
      if (h.length !== 1)
        throw Error("XPTY0004: signature of function passed to fn:for-each is incompatible.");
      const k = d.value;
      let l;
      return w.create({next: (n) => {
        for (; ; ) {
          if (!l) {
            var t = k.next(0);
            if (t.done)
              return t;
            t = Ad(h[0], w.m(t.value), b, "fn:for-each", false);
            l = f.value.call(void 0, a, b, c, t).value;
          }
          t = l.next(n);
          if (!t.done)
            return t;
          l = null;
        }
      }});
    },
    localName: "for-each",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {type: 59, g: 2}
  }, {j: [{type: 59, g: 2}, {type: 59, g: 2}, {type: 60, g: 3}], callFunction: (a, b, c, d, e, f) => {
    if (d.G())
      return d;
    const h = f.first(), k = h.o;
    if (k.length !== 2)
      throw Error("XPTY0004: signature of function passed to fn:fold-left is incompatible.");
    return d.M((l) => l.reduce((n, t) => {
      n = Ad(k[0], n, b, "fn:fold-left", false);
      t = Ad(k[1], w.m(t), b, "fn:fold-left", false);
      return h.value.call(void 0, a, b, c, n, t);
    }, e));
  }, localName: "fold-left", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {j: [{type: 59, g: 2}, {
    type: 59,
    g: 2
  }, {type: 60, g: 3}], callFunction: (a, b, c, d, e, f) => {
    if (d.G())
      return d;
    const h = f.first(), k = h.o;
    if (k.length !== 2)
      throw Error("XPTY0004: signature of function passed to fn:fold-right is incompatible.");
    return d.M((l) => l.reduceRight((n, t) => {
      n = Ad(k[0], n, b, "fn:fold-right", false);
      t = Ad(k[1], w.m(t), b, "fn:fold-right", false);
      return h.value.call(void 0, a, b, c, t, n);
    }, e));
  }, localName: "fold-right", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 59, g: 2}}, {j: [{type: 59, g: 2}], callFunction: (a, b, c, d) => {
    if (!b.Ua)
      throw Error("serialize() called but no xmlSerializer set in execution parameters.");
    a = d.O();
    if (!a.every((e) => v(e.type, 53)))
      throw Error("Expected argument to fn:serialize to resolve to a sequence of Nodes.");
    return w.m(g(a.map((e) => b.Ua.serializeToString(If(e.value, b, false))).join(""), 1));
  }, localName: "serialize", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 1, g: 3}}], Yd, [{
    j: [{type: 59, g: 3}, {type: 61, g: 3}],
    callFunction: (a, b, c, d, e) => {
      let f, h;
      return w.create({next: () => {
        f || ({fc: f, cc: h} = dq(d, e, c, b));
        try {
          return f.next(0);
        } catch (k) {
          Pf(h.value, k);
        }
      }});
    },
    localName: "evaluate",
    namespaceURI: "http://fontoxml.com/fontoxpath",
    i: {type: 59, g: 2}
  }, {j: [], callFunction: () => w.m(g(VERSION, 1)), localName: "version", namespaceURI: "http://fontoxml.com/fontoxpath", i: {type: 1, g: 3}}], [{
    j: [{type: 23, g: 3}, {type: 5, g: 3}],
    callFunction: (a, b, c, d, e) => A([d, e], ([f, h]) => {
      const k = c.ta(f.value.namespaceURI, f.value.localName, h.value);
      if (k === null)
        return w.empty();
      f = new Va({j: k.j, arity: h.value, localName: f.value.localName, namespaceURI: f.value.namespaceURI, i: k.i, value: k.callFunction});
      return w.m(f);
    }),
    localName: "function-lookup",
    namespaceURI: "http://www.w3.org/2005/xpath-functions",
    i: {g: 0, type: 60}
  }, {j: [{type: 60, g: 3}], callFunction: (a, b, c, d) => A([d], ([e]) => e.Xa() ? w.empty() : w.m(g(new Ta("", e.l, e.D), 23))), localName: "function-name", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 23, g: 0}}, {j: [{type: 60, g: 3}], callFunction: (a, b, c, d) => A([d], ([e]) => w.m(g(e.v, 5))), localName: "function-arity", namespaceURI: "http://www.w3.org/2005/xpath-functions", i: {type: 5, g: 3}}]);
  class pq {
    constructor(a) {
      this.h = a;
    }
    createAttributeNS(a, b) {
      return this.h.createAttributeNS(a, b);
    }
    createCDATASection(a) {
      return this.h.createCDATASection(a);
    }
    createComment(a) {
      return this.h.createComment(a);
    }
    createDocument() {
      return this.h.createDocument();
    }
    createElementNS(a, b) {
      return this.h.createElementNS(a, b);
    }
    createProcessingInstruction(a, b) {
      return this.h.createProcessingInstruction(a, b);
    }
    createTextNode(a) {
      return this.h.createTextNode(a);
    }
  }
  var qq = Symbol("IS_XPATH_VALUE_SYMBOL");
  function rq(a) {
    return (b, c) => {
      b = Yb(new nb(c === null ? new Za() : c), b, Ja(a));
      return {[qq]: true, xb: b};
    };
  }
  oq.forEach((a) => {
    Wf(a.namespaceURI, a.localName, a.j, a.i, a.callFunction);
  });
  function sq(a) {
    return a && typeof a === "object" && "lookupNamespaceURI" in a ? (b) => a.lookupNamespaceURI(b || null) : () => null;
  }
  function tq(a) {
    return ({prefix: b, localName: c}) => b ? null : {namespaceURI: a, localName: c};
  }
  function uq(a, b, c, d, e, f) {
    if (d === null || d === void 0)
      d = d || {};
    const h = e ? {ib: e.logger || {trace: console.log.bind(console)}, Ma: e.documentWriter, jb: e.moduleImports, Ab: e.namespaceResolver, Zb: e.functionNameResolver, Ia: e.nodesFactory, Ua: e.xmlSerializer} : {ib: {trace: console.log.bind(console)}, jb: {}, Ab: null, Ia: null, Ma: null, Ua: null}, k = new nb(c === null ? new Za() : c);
    c = h.jb || Object.create(null);
    var l = e.defaultFunctionNamespaceURI === void 0 ? "http://www.w3.org/2005/xpath-functions" : e.defaultFunctionNamespaceURI;
    const n = bq(a, f, h.Ab || sq(b), d, c, l, h.Zb || tq(l));
    a = b ? Zb(k, b) : w.empty();
    b = !h.Ia && f.Z ? new Ie(b) : new pq(h.Ia);
    c = h.Ma ? new bb(h.Ma) : ab;
    l = h.Ua;
    const t = Object.keys(d).reduce((z, F) => {
      const O = d[F];
      z[`Q{}${F}[0]`] = O && typeof O === "object" && qq in O ? () => w.create(O.xb) : () => Zb(k, d[F]);
      return z;
    }, Object.create(null));
    let u;
    for (const z of Object.keys(n.ga.Da))
      t[z] || (t[z] = () => (0, n.ga.Da[z])(u, y));
    u = new cc({N: a.first(), Fa: 0, za: a, wa: t});
    const y = new ic(f.debug, f.Ga, k, b, c, e.currentContext, new Map(), h.ib, l);
    return {rb: u, sb: y, ba: n.ba};
  }
  function vq(a, b) {
    const c = {};
    let d = 0, e = false, f = null;
    return {next: () => {
      if (e)
        return p;
      for (; d < a.h.length; ) {
        const k = a.h[d].key.value;
        if (!f) {
          const l = a.h[d];
          var h = l.value().Y({default: (n) => n, multiple: () => {
            throw Error(`Serialization error: The value of an entry in a map is expected to be a single item or an empty sequence. Use arrays when putting multiple values in a map. The value of the key ${l.key.value} holds multiple items`);
          }}).first();
          if (h === null) {
            c[k] = null;
            d++;
            continue;
          }
          f = wq(h, b);
        }
        h = f.next(0);
        f = null;
        c[k] = h.value;
        d++;
      }
      e = true;
      return q(c);
    }};
  }
  function xq(a, b) {
    const c = [];
    let d = 0, e = false, f = null;
    return {next: () => {
      if (e)
        return p;
      for (; d < a.h.length; ) {
        if (!f) {
          var h = a.h[d]().Y({default: (k) => k, multiple: () => {
            throw Error("Serialization error: The value of an entry in an array is expected to be a single item or an empty sequence. Use nested arrays when putting multiple values in an array.");
          }}).first();
          if (h === null) {
            c[d++] = null;
            continue;
          }
          f = wq(h, b);
        }
        h = f.next(0);
        f = null;
        c[d++] = h.value;
      }
      e = true;
      return q(c);
    }};
  }
  function wq(a, b) {
    if (v(a.type, 61))
      return vq(a, b);
    if (v(a.type, 62))
      return xq(a, b);
    if (v(a.type, 23)) {
      const c = a.value;
      return {next: () => q(`Q{${c.namespaceURI || ""}}${c.localName}`)};
    }
    switch (a.type) {
      case 7:
      case 8:
      case 9:
      case 11:
      case 12:
      case 13:
      case 14:
      case 15:
        const c = a.value;
        return {next: () => q(Mb(c))};
      case 47:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57:
      case 58:
        const d = a.value;
        return {next: () => q(If(d, b, false))};
      default:
        return {next: () => q(a.value)};
    }
  }
  var yq = {ANY: 0, NUMBER: 1, STRING: 2, BOOLEAN: 3, NODES: 7, FIRST_NODE: 9, STRINGS: 10, MAP: 11, ARRAY: 12, NUMBERS: 13, ALL_RESULTS: 14, ASYNC_ITERATOR: 99};
  yq[yq.ANY] = "ANY";
  yq[yq.NUMBER] = "NUMBER";
  yq[yq.STRING] = "STRING";
  yq[yq.BOOLEAN] = "BOOLEAN";
  yq[yq.NODES] = "NODES";
  yq[yq.FIRST_NODE] = "FIRST_NODE";
  yq[yq.STRINGS] = "STRINGS";
  yq[yq.MAP] = "MAP";
  yq[yq.ARRAY] = "ARRAY";
  yq[yq.NUMBERS] = "NUMBERS";
  yq[yq.ALL_RESULTS] = "ALL_RESULTS";
  yq[yq.ASYNC_ITERATOR] = "ASYNC_ITERATOR";
  function zq(a, b, c, d) {
    switch (c) {
      case 3:
        return b.fa();
      case 2:
        return b = qc(b, d).O(), b.length ? b.map((l) => jd(l, 1).value).join(" ") : "";
      case 10:
        return b = qc(b, d).O(), b.length ? b.map((l) => l.value + "") : [];
      case 1:
        return b = b.first(), b !== null && v(b.type, 2) ? b.value : NaN;
      case 9:
        b = b.first();
        if (b === null)
          return null;
        if (!v(b.type, 53))
          throw Error("Expected XPath " + Nf(a) + " to resolve to Node. Got " + Ea[b.type]);
        return If(b.value, d, false);
      case 7:
        b = b.O();
        if (!b.every((l) => v(l.type, 53)))
          throw Error("Expected XPath " + Nf(a) + " to resolve to a sequence of Nodes.");
        return b.map((l) => If(l.value, d, false));
      case 11:
        b = b.O();
        if (b.length !== 1)
          throw Error("Expected XPath " + Nf(a) + " to resolve to a single map.");
        b = b[0];
        if (!v(b.type, 61))
          throw Error("Expected XPath " + Nf(a) + " to resolve to a map");
        return vq(b, d).next(0).value;
      case 12:
        b = b.O();
        if (b.length !== 1)
          throw Error("Expected XPath " + Nf(a) + " to resolve to a single array.");
        b = b[0];
        if (!v(b.type, 62))
          throw Error("Expected XPath " + Nf(a) + " to resolve to an array");
        return xq(b, d).next(0).value;
      case 13:
        return b.O().map((l) => {
          if (!v(l.type, 2))
            throw Error("Expected XPath " + Nf(a) + " to resolve to numbers");
          return l.value;
        });
      case 99:
        const e = b.value;
        let f = null, h = false;
        const k = () => {
          for (; !h; ) {
            if (!f) {
              var l = e.next(0);
              if (l.done) {
                h = true;
                break;
              }
              f = wq(l.value, d);
            }
            l = f.next(0);
            f = null;
            return l;
          }
          return Promise.resolve({done: true, value: null});
        };
        return "asyncIterator" in Symbol ? {[Symbol.asyncIterator]() {
          return this;
        }, next: () => new Promise((l) => l(k())).catch((l) => {
          Pf(a, l);
        })} : {next: () => new Promise((l) => l(k()))};
      case 14:
        return b.O().map((l) => wq(l, d).next(0).value);
      default:
        return b = b.O(), b.every((l) => v(l.type, 53) && !v(l.type, 47)) ? (b = b.map((l) => If(l.value, d, false)), b.length === 1 ? b[0] : b) : b.length === 1 ? (b = b[0], v(b.type, 62) ? xq(b, d).next(0).value : v(b.type, 61) ? vq(b, d).next(0).value : pc(b, d).first().value) : qc(w.create(b), d).O().map((l) => l.value);
    }
  }
  let Aq = false, Bq = null;
  var Cq = {getPerformanceSummary() {
    const a = Bq.getEntriesByType("measure").filter((b) => b.name.startsWith("XPath: "));
    return Array.from(a.reduce((b, c) => {
      var d = c.name.substring(7);
      b.has(d) ? (d = b.get(d), d.times += 1, d.totalDuration += c.duration) : b.set(d, {xpath: d, times: 1, totalDuration: c.duration, average: 0});
      return b;
    }, new Map()).values()).map((b) => {
      b.average = b.totalDuration / b.times;
      return b;
    }).sort((b, c) => c.totalDuration - b.totalDuration);
  }, setPerformanceImplementation(a) {
    Bq = a;
  }, startProfiling() {
    if (Bq === null)
      throw Error("Performance API object must be set using `profiler.setPerformanceImplementation` before starting to profile");
    Bq.clearMarks();
    Bq.clearMeasures();
    Aq = true;
  }, stopProfiling() {
    Aq = false;
  }};
  let Dq = 0;
  var Eq = {XPATH_3_1_LANGUAGE: "XPath3.1", XQUERY_3_1_LANGUAGE: "XQuery3.1", XQUERY_UPDATE_3_1_LANGUAGE: "XQueryUpdate3.1"};
  const Fq = (a, b, c, d, e, f) => {
    e = e || 0;
    if (!a || typeof a !== "string" && !("nodeType" in a))
      throw new TypeError("Failed to execute 'evaluateXPath': xpathExpression must be a string or an element depicting an XQueryX DOM tree.");
    f = f || {};
    let h, k;
    try {
      const n = uq(a, b, c || null, d || {}, f, {qa: f.language === "XQueryUpdate3.1", Z: f.language === "XQuery3.1" || f.language === "XQueryUpdate3.1", debug: !!f.debug, Ga: !!f.disableCache});
      var l = n.rb;
      h = n.sb;
      k = n.ba;
    } catch (n) {
      Pf(a, n);
    }
    if (k.J)
      throw Error("XUST0001: Updating expressions should be evaluated as updating expressions");
    if (e === 3 && b && typeof b === "object" && "nodeType" in b && (c = k.D(), b = Ya(b), c !== null && !b.includes(c)))
      return false;
    try {
      b = a;
      Aq && (typeof b !== "string" && (b = Nf(b)), Bq.mark(`${b}${Dq === 0 ? "" : "@" + Dq}`), Dq++);
      const n = B(k, l, h), t = zq(a, n, e, h);
      e = a;
      Aq && (typeof e !== "string" && (e = Nf(e)), Dq--, l = `${e}${Dq === 0 ? "" : "@" + Dq}`, Bq.measure(`XPath: ${e}`, l), Bq.clearMarks(l));
      return t;
    } catch (n) {
      Pf(a, n);
    }
  };
  Object.assign(Fq, {hc: 14, ANY_TYPE: 0, Ib: 12, Jb: 99, BOOLEAN_TYPE: 3, Lb: 9, Ob: 11, Qb: 7, Rb: 13, NUMBER_TYPE: 1, Sb: 10, STRING_TYPE: 2, ic: "XPath3.1", jc: "XQuery3.1", Vb: "XQueryUpdate3.1"});
  Object.assign(Fq, {ALL_RESULTS_TYPE: 14, ANY_TYPE: 0, ARRAY_TYPE: 12, ASYNC_ITERATOR_TYPE: 99, BOOLEAN_TYPE: 3, FIRST_NODE_TYPE: 9, MAP_TYPE: 11, NODES_TYPE: 7, NUMBERS_TYPE: 13, NUMBER_TYPE: 1, STRINGS_TYPE: 10, STRING_TYPE: 2, XPATH_3_1_LANGUAGE: "XPath3.1", XQUERY_3_1_LANGUAGE: "XQuery3.1", XQUERY_UPDATE_3_1_LANGUAGE: "XQueryUpdate3.1"});
  function Gq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Jb, e);
  }
  function Hq(a, b, c, d) {
    return {pendingUpdateList: a.da.map((e) => e.h(d)), xdmValue: zq(b, w.create(a.I), c, d)};
  }
  async function Iq(a, b, c, d, e) {
    e = e || {};
    tk();
    let f, h;
    try {
      const n = uq(a, b, c || null, d || {}, e || {}, {qa: true, Z: true, debug: !!e.debug, Ga: !!e.disableCache});
      var k = n.rb;
      f = n.sb;
      h = n.ba;
    } catch (n) {
      Pf(a, n);
    }
    if (!h.J) {
      k = [];
      a = Gq(a, b, c, d, Object.assign(Object.assign({}, e), {language: "XQueryUpdate3.1"}));
      for (b = await a.next(); !b.done; b = await a.next())
        k.push(b.value);
      return Promise.resolve({pendingUpdateList: [], xdmValue: k});
    }
    let l;
    try {
      l = h.s(k, f).next(0);
    } catch (n) {
      Pf(a, n);
    }
    return Hq(l.value, a, e.returnType, f);
  }
  function Jq(a, b, c, d, e) {
    e = e || {};
    tk();
    let f, h, k;
    try {
      const n = uq(a, b, c || null, d || {}, e || {}, {qa: true, Z: true, debug: !!e.debug, Ga: !!e.disableCache});
      f = n.rb;
      h = n.sb;
      k = n.ba;
    } catch (n) {
      Pf(a, n);
    }
    if (!k.J)
      return {pendingUpdateList: [], xdmValue: Fq(a, b, c, d, e.i, Object.assign(Object.assign({}, e), {language: Fq.Vb}))};
    let l;
    try {
      l = k.s(f, h).next(0);
    } catch (n) {
      Pf(a, n);
    }
    return Hq(l.value, a, e.returnType, h);
  }
  function Kq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Ib, e);
  }
  function Lq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.BOOLEAN_TYPE, e);
  }
  function Mq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Lb, e);
  }
  function Nq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Ob, e);
  }
  function Oq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Qb, e);
  }
  function Pq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.NUMBER_TYPE, e);
  }
  function Qq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Rb, e);
  }
  function Rq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.STRING_TYPE, e);
  }
  function Sq(a, b, c, d, e) {
    return Fq(a, b, c, d, Fq.Sb, e);
  }
  function Tq(a, b, c, d) {
    b = new nb(b ? b : new Za());
    d = d ? new bb(d) : ab;
    c = c ? c = new pq(c) : null;
    a = a.map(yj);
    Se(a, b, c, d);
  }
  function X(a, b, c) {
    return {code: a, ra: b, H: c, isAstAccepted: true};
  }
  function Uq(a) {
    return {isAstAccepted: false, reason: a};
  }
  function Y(a, b) {
    return a.isAstAccepted ? b(a) : a;
  }
  function Vq(a, b) {
    return a.isAstAccepted ? b(a) : [a, null];
  }
  function Wq(a, b, c) {
    return Y(a, (d) => {
      switch (d.ra.type) {
        case 0:
          return d;
        case 1:
          return Y(Xq(c, d, "nodes"), (e) => Y(Xq(c, b, "contextItem"), (f) => X(`(function () {
							const { done, value } = ${e.code}(${f.code}).next();
							return done ? null : value;
						})()`, {type: 0}, [...e.H, ...f.H])));
        default:
          throw Error(`invalid generated code type to convert to value: ${d.ra.type}`);
      }
    });
  }
  function Yq(a, b, c, d) {
    a = Wq(a, c, d);
    return b && b.type === 0 && b.g === 3 ? a : Y(a, (e) => X(`!!${e.code}`, {type: 0}, e.H));
  }
  function Zq(a, b, c) {
    return b ? a.isAstAccepted && a.ra.type !== 0 ? Uq("Atomization only implemented for single value") : v(b.type, 1) ? a : v(b.type, 47) ? Y(Xq(c, a, "attr"), (d) => X(`(${d.code} ? domFacade.getData(${d.code}) : null)`, {type: 0}, d.H)) : Uq("Atomization only implemented for string and attribute") : Uq("Can not atomize value if type was not annotated");
  }
  function $q(a, b, c, d) {
    a = Wq(a, c, d);
    d = Zq(a, b, d);
    return zc(b) ? Y(d, (e) => X(`${e.code} ?? ''`, {type: 0}, e.H)) : d;
  }
  function ar(a, b, c) {
    return Y(Xq(c, a, "node"), (d) => d.ra.type === 1 ? d : b && !v(b.type, 53) ? Uq("Can not evaluate to node if expression does not result in nodes") : X(`(function () {
				if (${d.code} !== null && !${d.code}.nodeType) {
					throw new Error('XPDY0050: The result of the expression was not a node');
				}
				return ${d.code};
			})()`, {type: 0}, d.H));
  }
  function br(a, b, c, d) {
    return Y(a, (e) => {
      switch (e.ra.type) {
        case 1:
          return Y(Xq(d, e, "nodes"), (f) => Y(Xq(d, c, "contextItem"), (h) => X(`Array.from(${f.code}(${h.code}))`, {type: 0}, [...f.H, ...h.H])));
        case 0:
          return Y(Xq(d, ar(e, b, d), "node"), (f) => X(`(${f.code} === null ? [] : [${f.code}])`, {type: 0}, f.H));
        default:
          return Uq("Unsupported code type to evaluate to nodes");
      }
    });
  }
  function cr(a, b) {
    return Y(a, (c) => Y(b, (d) => {
      if (c.ra.type !== 0 || d.ra.type !== 0)
        throw Error("can only use emitAnd with value expressions");
      return X(`${c.code} && ${d.code}`, {type: 0}, [...c.H, ...d.H]);
    }));
  }
  function dr(a, b, c, d) {
    return (a = J(a, [b, "*"])) ? d.h(a, c, d) : [Uq(`${b} expression not found`), null];
  }
  const Ct = {equalOp: "eqOp", notEqualOp: "neOp", lessThanOrEqualOp: "leOp", lessThanOp: "ltOp", greaterThanOrEqualOp: "geOp", greaterThanOp: "gtOp"}, Dt = {eqOp: "eqOp", neOp: "neOp", leOp: "geOp", ltOp: "gtOp", geOp: "leOp", gtOp: "ltOp"};
  function Et(a, b, c, d) {
    const e = I(J(a, ["firstOperand", "*"]), "type"), f = I(J(a, ["secondOperand", "*"]), "type");
    if (!e || !f)
      return Uq("Can not generate code for value compare without both types");
    var h = [47, 1];
    if (!h.includes(e.type) || !h.includes(f.type))
      return Uq(`Unsupported types in compare: [${Ea[e.type]}, ${Ea[f.type]}]`);
    h = new Map([["eqOp", "==="], ["neOp", "!=="]]);
    if (!h.has(b))
      return Uq(b + " not yet implemented");
    const k = h.get(b);
    [b] = dr(a, "firstOperand", c, d);
    b = Wq(b, c, d);
    b = Zq(b, e, d);
    return Y(Xq(d, b, "first"), (l) => {
      var [n] = dr(a, "secondOperand", c, d);
      n = Wq(n, c, d);
      n = Zq(n, f, d);
      return Y(Xq(d, n, "second"), (t) => {
        const u = [];
        zc(e) && u.push(`${l.code} === null`);
        zc(f) && u.push(`${t.code} === null`);
        return X(`(${u.length ? `${u.join(" || ")} ? null : ` : ""}${l.code} ${k} ${t.code})`, {type: 0}, [...l.H, ...t.H]);
      });
    });
  }
  function Ft(a, b, c, d, e, f) {
    var h = I(J(a, [b, "*"]), "type");
    const k = I(J(a, [c, "*"]), "type");
    if (!h || !k)
      return Uq("Can not generate code for general compare without both types");
    var l = [47, 1];
    if (!l.includes(h.type) || !l.includes(k.type))
      return Uq(`Unsupported types in compare: [${Ea[h.type]}, ${Ea[k.type]}]`);
    l = new Map([["eqOp", "==="], ["neOp", "!=="]]);
    if (!l.has(d))
      return Uq(d + " not yet implemented");
    const n = l.get(d);
    [b] = dr(a, b, e, f);
    b = Wq(b, e, f);
    h = Zq(b, h, f);
    return Y(Xq(f, h, "single"), (t) => {
      const [u] = dr(a, c, e, f);
      return Y(Xq(f, u, "multiple"), (y) => {
        if (y.ra.type !== 1)
          return Uq("can only generate general compare for a single value and a generator");
        const z = Gt(f, Ht(f, "n")), F = Zq(z, k, f);
        return Y(e, (O) => Y(F, (U) => X(`(function () {
									for (const ${z.code} of ${y.code}(${O.code})) {
										${U.H.join("\n")}
										if (${U.code} ${n} ${t.code}) {
											return true;
										}
									}
									return false;
								})()`, {type: 0}, [...t.H, ...z.H, ...O.H, ...y.H])));
      });
    });
  }
  function It(a) {
    return JSON.stringify(a).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }
  const Ot = {"false#0": Jt, "local-name#0": Kt, "local-name#1": Kt, "name#0": Lt, "name#1": Lt, "not#1": Mt, "true#0": Nt}, Pt = {["http://fontoxml.com/fontoxpath"]: ["version#0"], [""]: ["root#1", "path#1"]};
  function Qt(a, b, c, d) {
    const [e] = d.h(a, c, d);
    a = I(a, "type");
    if (b ? b.g === 2 || b.g === 1 : 1)
      return Uq("Not supported: sequence arguments with multiple items");
    if (v(b.type, 53))
      return b = Wq(e, c, d), ar(b, a, d);
    switch (b.type) {
      case 59:
        return Wq(e, c, d);
      case 0:
        return Yq(e, a, c, d);
      case 1:
        return $q(e, a, c, d);
    }
    return Uq(`Argument types not supported: ${a ? Ea[a.type] : "unknown"} -> ${Ea[b.type]}`);
  }
  function Rt(a, b, c, d) {
    if (a.length !== b.length || b.some((l) => l === 4))
      return Uq("Not supported: variadic function or mismatch in argument count");
    if (a.length === 0)
      return X("", {type: 0}, []);
    const [e, ...f] = a, [h, ...k] = b;
    a = Xq(d, Qt(e, h, c, d), "arg");
    return f.length === 0 ? a : Y(a, (l) => {
      const n = Rt(f, k, c, d);
      return Y(n, (t) => X(`${l.code}, ${t.code}`, {type: 0}, [...l.H, ...t.H]));
    });
  }
  function St(a, b) {
    return Y(a, (c) => (b ? b.g === 2 || b.g === 1 : 1) || ![0, 1].includes(b.type) && !v(b.type, 53) ? Uq(`Function return type ${Ea[b.type]} not supported`) : c);
  }
  function Tt(a, b, c) {
    const {localName: d, namespaceURI: e} = rg(G(a, "functionName")), f = K(G(a, "arguments"), "*");
    var h = f.length;
    const k = `${d}#${h}`, l = e === c.D;
    if (l) {
      const n = Ot[k];
      if (n !== void 0)
        return n(a, b, c);
    }
    if ((a = Pt[l ? "" : e]) && !a.includes(k))
      return Uq(`Not supported: built-in function not on allow list: ${k}`);
    h = Vf(e, d, h);
    if (!h)
      return Uq(`Unknown function / arity: ${k}`);
    if (h.J)
      return Uq("Not supported: updating functions");
    b = Rt(f, h.j, b, c);
    b = Y(b, (n) => X(`runtimeLib.callFunction(domFacade, ${It(e)}, ${It(d)}, [${n.code}], options)`, {type: 0}, n.H));
    return St(b, h.i);
  }
  function Ut(a, b) {
    return Y(Xq(b, a, "contextItem"), (c) => X(c.code, {type: 0}, [...c.H, `if (${c.code} === undefined || ${c.code} === null) {
					throw errXPDY0002('The function which was called depends on dynamic context, which is absent.');
				}`]));
  }
  function Vt(a, b, c, d) {
    if ((a = J(a, ["arguments", "*"])) && a[0] !== "contextItemExpr") {
      const e = I(a, "type");
      if (!e || !v(e.type, 53))
        return Uq("name function only implemented if arg is a node");
      [a] = c.h(a, b, c);
    } else
      a = Ut(b, c);
    b = Wq(a, b, c);
    return Y(Xq(c, b, "arg"), (e) => X(`(${e.code} ? ${d(e.code)} : '')`, {type: 0}, e.H));
  }
  function Lt(a, b, c) {
    return Vt(a, b, c, (d) => `(((${d}.prefix || '').length !== 0 ? ${d}.prefix + ':' : '')
		+ (${d}.localName || ${d}.target || ''))`);
  }
  function Kt(a, b, c) {
    return Vt(a, b, c, (d) => `(${d}.localName || ${d}.target || '')`);
  }
  function Mt(a, b, c) {
    var d = J(a, ["arguments", "*"]);
    a = I(d, "type");
    [d] = c.h(d, b, c);
    b = Yq(d, a, b, c);
    return Y(b, (e) => X(`!${e.code}`, {type: 0}, e.H));
  }
  function Jt() {
    return X("false", {type: 0}, []);
  }
  function Nt() {
    return X("true", {type: 0}, []);
  }
  function Wt(a, b, c, d) {
    const [e, f] = dr(a, "firstOperand", c, d);
    var h = I(J(a, ["firstOperand", "*"]), "type");
    h = Yq(e, h, c, d);
    const [k, l] = dr(a, "secondOperand", c, d);
    h = Y(h, (t) => {
      var u = I(J(a, ["secondOperand", "*"]), "type");
      u = Yq(k, u, c, d);
      return Y(u, (y) => X(`(${t.code} ${b} ${y.code})`, {type: 0}, [...t.H, ...y.H]));
    });
    const n = b === "&&" ? fh(f, l) : f === l ? f : null;
    return [h, n];
  }
  function Xt(a, b, c) {
    return Y(a, (d) => Y(b, (e) => Y(c, (f) => X(`for (${d.code}) {
						${e.H.join("\n")}
						if (!(${e.code})) {
							continue;
						}
						${f.H.join("\n")}
						${f.code}
					}`, {type: 2}, d.H))));
  }
  function Yt(a, b, c, d, e) {
    const f = b ? `, "${b}"` : "";
    b = Y(d, (h) => Y(e, (k) => X(`let ${h.code} = domFacade.getFirstChild(${k.code}${f});
							${h.code};
							${h.code} = domFacade.getNextSibling(${h.code}${f})`, {type: 2}, [...h.H, ...k.H])));
    return Xt(b, a, c);
  }
  function Zt(a, b, c, d, e) {
    const f = fh(b, "type-2"), h = Y(e, (k) => X(`(${k.code} && ${k.code}.nodeType === /*ELEMENT_NODE*/ ${1} ? domFacade.getAllAttributes(${k.code}${f ? `, "${f}"` : ""}) : [])`, {type: 0}, k.H));
    b = Y(d, (k) => Y(h, (l) => X(`const ${k.code} of ${l.code}`, {type: 2}, [...k.H, ...l.H])));
    return Xt(b, a, c);
  }
  function $t(a, b, c, d, e) {
    const f = b ? `, "${b}"` : "";
    b = Y(e, (h) => X(`domFacade.getParentNode(${h.code}${f})`, {type: 0}, h.H));
    return au(d, b, a, c);
  }
  function au(a, b, c, d) {
    const e = cr(a, c);
    return Y(a, (f) => Y(b, (h) => Y(e, (k) => Y(d, (l) => X(`const ${f.code} = ${h.code};
						${k.H.join("\n")}
						if (${k.code}) {
							${l.H.join("\n")}
							${l.code}
						}`, {type: 2}, [...f.H, ...h.H])))));
  }
  function bu(a, b, c, d, e, f) {
    a = H(a);
    switch (a) {
      case "attribute":
        return [Zt(b, c, d, e, f), "type-1"];
      case "child":
        return [Yt(b, c, d, e, f), null];
      case "parent":
        return [$t(b, c, d, e, f), null];
      case "self":
        return [au(e, f, b, d), c];
      default:
        return [Uq(`Unsupported: the ${a} axis`), null];
    }
  }
  const cu = {Tb: "textTest", Kb: "elementTest", Pb: "nameTest", Ub: "Wildcard", Hb: "anyKindTest"};
  var du = Object.values(cu);
  function eu(a) {
    return [Y(a, (b) => X(`${b.code}.nodeType === /*TEXT_NODE*/ ${3}`, {type: 0}, [])), "type-3"];
  }
  function fu(a, b) {
    if (a.namespaceURI === null && a.prefix !== "*") {
      b = b.$(a.prefix || "") || null;
      if (!b && a.prefix)
        throw Error(`XPST0081: The prefix ${a.prefix} could not be resolved.`);
      a.namespaceURI = b;
    }
  }
  function gu(a, b, c, d) {
    fu(a, d);
    const e = a.prefix, f = a.namespaceURI, h = a.localName;
    return Vq(c, (k) => {
      var l = b ? X(`${k.code}.nodeType
						&& (${k.code}.nodeType === /*ELEMENT_NODE*/ ${1}
						|| ${k.code}.nodeType === /*ATTRIBUTE_NODE*/ ${2})`, {type: 0}, []) : X(`${k.code}.nodeType
						&& ${k.code}.nodeType === /*ELEMENT_NODE*/ ${1}`, {type: 0}, []);
      if (e === "*")
        return h === "*" ? [l, b ? "type-1-or-type-2" : "type-1"] : [cr(l, X(`${k.code}.localName === ${It(h)}`, {type: 0}, [])), `name-${h}`];
      l = h === "*" ? l : cr(l, X(`${k.code}.localName === ${It(h)}`, {type: 0}, []));
      var n = X(It(f), {type: 0}, []);
      n = e === "" && b ? Y(n, (t) => X(`${k.code}.nodeType === /*ELEMENT_NODE*/ ${1} ? ${t.code} : null`, {type: 0}, t.H)) : n;
      n = Y(n, (t) => X(`(${k.code}.namespaceURI || null) === ((${t.code}) || null)`, {type: 0}, t.H));
      return [cr(l, n), `name-${h}`];
    });
  }
  function hu(a, b, c) {
    const d = (a = G(a, "elementName")) && G(a, "star");
    if (a === null || d)
      return [Y(b, (e) => X(`${e.code}.nodeType === /*ELEMENT_NODE*/ ${1}`, {type: 0}, [])), "type-1"];
    a = rg(G(a, "QName"));
    return gu(a, false, b, c);
  }
  function iu(a) {
    return [Y(a, (b) => X(`!!${b.code}.nodeType`, {type: 0}, [])), null];
  }
  function ju(a, b, c, d) {
    var e = a[0];
    switch (e) {
      case cu.Kb:
        return hu(a, c, d);
      case cu.Tb:
        return eu(c);
      case cu.Pb:
        return gu(rg(a), b, c, d);
      case cu.Ub:
        return G(a, "star") ? (e = G(a, "uri"), e !== null ? a = gu({localName: "*", namespaceURI: H(e), prefix: ""}, b, c, d) : (e = G(a, "NCName"), a = G(a, "*")[0] === "star" ? gu({localName: H(e), namespaceURI: null, prefix: "*"}, b, c, d) : gu({localName: "*", namespaceURI: null, prefix: H(e)}, b, c, d))) : a = gu({localName: "*", namespaceURI: null, prefix: "*"}, b, c, d), a;
      case cu.Hb:
        return iu(c);
      default:
        return [
          Uq(`Test not implemented: '${e}`),
          null
        ];
    }
  }
  function ku(a, b, c) {
    const [d, e] = c.h(a, b, c);
    return [Yq(d, I(a, "type"), b, c), e];
  }
  function lu(a, b, c) {
    a = a ? K(a, "*") : [];
    const [d, e] = a.reduce(([f, h], k) => {
      if (!f)
        return ku(k, b, c);
      let l = h;
      return Vq(f, (n) => {
        const [t, u] = ku(k, b, c);
        l = fh(h, u);
        return [Y(t, (y) => X(`${n.code} && ${y.code}`, {type: 0}, [...n.H, ...y.H])), l];
      });
    }, [null, null]);
    return [d ? Y(d, (f) => X(`(function () {
							${f.H.join("\n")}
							return ${f.code};
						})()`, {type: 0}, [])) : null, e];
  }
  function mu(a, b, c, d) {
    if (a.length === 0)
      return [Y(c, (z) => X(`yield ${z.code};`, {type: 2}, z.H)), null];
    const [e, ...f] = a;
    if (0 < K(e, "lookup").length)
      return [Uq("Unsupported: lookups"), null];
    const h = Gt(d, Ht(d, "contextItem"));
    a = G(e, "predicates");
    const [k, l] = lu(a, h, d);
    if (a = G(e, "xpathAxis")) {
      var n = G(e, du);
      if (!n)
        return [Uq("Unsupported test in step"), null];
      var t = H(a);
      b = t === "attribute" || t === "self" && b;
      const [z, F] = ju(n, b, h, d);
      n = k === null ? z : cr(z, k);
      t = fh(F, l);
      [b] = mu(f, b, h, d);
      return bu(a, n, t, b, h, c);
    }
    a = J(e, ["filterExpr", "*"]);
    if (!a)
      return [Uq("Unsupported: unknown step type"), null];
    const [u, y] = d.h(a, c, d);
    return [Y(u, (z) => {
      const F = f.length === 0 ? X("", {type: 2}, []) : X(`if (${h.code} !== null && !${h.code}.nodeType) {
									throw new Error('XPTY0019: The result of E1 in a path expression E1/E2 should evaluate to a sequence of nodes.');
								}`, {type: 2}, []), [O] = mu(f, true, h, d), U = k === null ? O : Y(k, (ba) => Y(O, (Ga) => X(`if (${ba.code}) {
									${Ga.H.join("\n")}
									${Ga.code}
								}`, {type: 2}, ba.H)));
      return Y(U, (ba) => {
        switch (z.ra.type) {
          case 1:
            return Y(c, (Ga) => X(`for (const ${h.code} of ${z.code}(${Ga.code})) {
									${ba.H.join("\n")}
									${ba.code}
								}`, {type: 2}, [...h.H, ...z.H, ...F.H]));
          case 0:
            return X(`const ${h.code} = ${z.code};
							${F.code}
							if (${h.code} !== null) {
								${ba.H.join("\n")}
								${ba.code}
							}`, {type: 2}, [...h.H, ...z.H, ...F.H]);
          default:
            return Uq("Unsupported generated code type for filterExpr");
        }
      });
    }), y];
  }
  function nu(a) {
    return Y(a, (b) => X(`(function () {
				let n = ${b.code};
				while (n.nodeType !== /*DOCUMENT_NODE*/${9}) {
					n = domFacade.getParentNode(n);
					if (n === null) {
						throw new Error('XPDY0050: the root node of the context node is not a document node.');
					}
				}
				return n;
			})()`, {type: 0}, b.H));
  }
  function ou(a, b, c) {
    return Vq(b, (d) => {
      if (0 < K(a, "lookup").length)
        return [Uq("Unsupported: lookups"), null];
      var e = G(a, "predicates");
      const [f, h] = lu(e, d, c);
      e = G(a, du);
      if (!e)
        return [Uq("Unsupported test in step"), null];
      const [k, l] = ju(e, true, d, c);
      e = f === null ? k : cr(k, f);
      const n = fh(l, h);
      return [Y(e, (t) => X(`((${t.code}) ? ${d.code} : null)`, {type: 0}, [...d.H, ...t.H])), n];
    });
  }
  function pu(a, b, c) {
    const d = K(a, "stepExpr");
    if (d.length === 1) {
      const k = G(d[0], "xpathAxis");
      if (k && H(k) === "self")
        return ou(d[0], b, c);
    }
    const e = Gt(c, Ht(c, "contextItem"));
    b = (a = G(a, "rootExpr")) ? Xq(c, nu(e), "root") : e;
    const [f, h] = mu(d, !a, b, c);
    return [Y(f, (k) => X(`(function* (${e.code}) {
			${k.H.join("\n")}
			${k.code}
		})`, {type: 1}, [])), h];
  }
  function qu(a, b, c) {
    const d = a[0];
    switch (d) {
      case "contextItemExpr":
        return [b, null];
      case "pathExpr":
        return pu(a, b, c);
      case "andOp":
        return Wt(a, "&&", b, c);
      case "orOp":
        return Wt(a, "||", b, c);
      case "stringConstantExpr":
        return a = G(a, "value")[1] || "", a = It(a), [X(a, {type: 0}, []), null];
      case "equalOp":
      case "notEqualOp":
      case "lessThanOrEqualOp":
      case "lessThanOp":
      case "greaterThanOrEqualOp":
      case "greaterThanOp":
      case "eqOp":
      case "neOp":
      case "ltOp":
      case "leOp":
      case "gtOp":
      case "geOp":
      case "isOp":
      case "nodeBeforeOp":
      case "nodeAfterOp":
        a:
          switch (d) {
            case "eqOp":
            case "neOp":
            case "ltOp":
            case "leOp":
            case "gtOp":
            case "geOp":
            case "isOp":
              a = Et(a, d, b, c);
              break a;
            case "equalOp":
            case "notEqualOp":
            case "lessThanOrEqualOp":
            case "lessThanOp":
            case "greaterThanOrEqualOp":
            case "greaterThanOp":
              const e = I(J(a, ["firstOperand", "*"]), "type"), f = I(J(a, ["secondOperand", "*"]), "type");
              a = e && f ? e.g === 3 && f.g === 3 ? Et(a, Ct[d], b, c) : e.g === 3 ? Ft(a, "firstOperand", "secondOperand", Ct[d], b, c) : f.g === 3 ? Ft(a, "secondOperand", "firstOperand", Dt[Ct[d]], b, c) : Uq("General comparison for sequences is not implemented") : Uq("types of compare are not known");
              break a;
            default:
              a = Uq(`Unsupported compare type: ${d}`);
          }
        return [
          a,
          null
        ];
      case "functionCallExpr":
        return [Tt(a, b, c), null];
      default:
        return [Uq(`Unsupported: the base expression '${d}'.`), null];
    }
  }
  function Xq(a, b, c) {
    return Y(b, (d) => {
      var e = a.o.get(d);
      e || (e = Ht(a, c), e = X(e, d.ra, [...d.H, `const ${e} = ${d.code};`]), a.o.set(d, e), a.o.set(e, e));
      return e;
    });
  }
  function Ht(a, b = "v") {
    const c = a.v.get(b) || 0;
    a.v.set(b, c + 1);
    return `${b}${c}`;
  }
  function Gt(a, b) {
    b = X(b, {type: 0}, []);
    a.o.set(b, b);
    return b;
  }
  var ru = class {
    constructor(a, b) {
      this.o = new Map();
      this.v = new Map();
      this.$ = a;
      this.D = b;
      this.h = qu;
    }
  };
  function su(a) {
    const b = K(a, "*");
    if (a[0] === "pathExpr")
      return true;
    for (const c of b)
      if (su(c))
        return true;
    return false;
  }
  function tu(a, b, c) {
    c = c || {};
    b = b || 0;
    if (typeof a === "string") {
      a = uk(a);
      var d = {Z: c.language === "XQuery3.1" || c.language === "XQueryUpdate3.1", debug: false};
      try {
        var e = Wp(a, d);
      } catch (h) {
        Pf(a, h);
      }
    } else
      e = pk(a);
    a = G(e, "mainModule");
    if (!a)
      return Uq("Unsupported: XQuery Library modules are not supported.");
    if (G(a, "prolog"))
      return Uq("Unsupported: XQuery Prologs are not supported.");
    d = c.defaultFunctionNamespaceURI === void 0 ? "http://www.w3.org/2005/xpath-functions" : c.defaultFunctionNamespaceURI;
    a = new ru(c.namespaceResolver || sq(null), d);
    c = new Zg(new jg(new Yf(a.$, {}, d, c.functionNameResolver || tq("http://www.w3.org/2005/xpath-functions"))));
    N(e, c);
    if (c = G(e, "mainModule"))
      if (G(c, "prolog"))
        a = Uq("Unsupported: XQuery.");
      else {
        var f = J(c, ["queryBody", "*"]);
        c = Gt(a, "contextItem");
        [d] = a.h(f, c, a);
        b:
          switch (f = I(f, "type"), b) {
            case 9:
              b = Wq(d, c, a);
              a = ar(b, f, a);
              break b;
            case 7:
              a = br(d, f, c, a);
              break b;
            case 3:
              a = Yq(d, f, c, a);
              break b;
            case 2:
              a = $q(d, f, c, a);
              break b;
            default:
              a = Uq(`Unsupported: the return type '${b}'.`);
          }
        a.isAstAccepted && (a = `
		${a.H.join("\n")}
		return ${a.code};`, b = "\n	return (contextItem, domFacade, runtimeLib, options) => {\n		const {\n			errXPDY0002,\n		} = runtimeLib;", su(e) && (b += '\n		if (!contextItem) {\n			throw errXPDY0002("Context is needed to evaluate the given path expression.");\n		}\n\n		if (!contextItem.nodeType) {\n			throw new Error("Context item must be subtype of node().");\n		}\n		'), a = {code: b + (a + "}\n//# sourceURL=generated.js"), isAstAccepted: true});
      }
    else
      a = Uq("Unsupported: Can not execute a library module.");
    return a;
  }
  class uu extends Error {
    constructor(a, b, c) {
      var d = a.stack;
      d && (d.includes(a.message) && (d = d.substr(d.indexOf(a.message) + a.message.length).trim()), d = d.split("\n"), d.splice(10), d = d.map((e) => e.startsWith("    ") || e.startsWith("	") ? e : `    ${e}`), d = d.join("\n"));
      super(`Custom XPath function Q{${c}}${b} raised:
${a.message}
${d}`);
    }
  }
  function vu(a, b, c) {
    return b.g === 0 ? a.G() ? null : wq(a.first(), c).next(0).value : b.g === 2 || b.g === 1 ? a.O().map((d) => {
      if (v(d.type, 47))
        throw Error("Cannot pass attribute nodes to custom functions");
      return wq(d, c).next(0).value;
    }) : wq(a.first(), c).next(0).value;
  }
  function wu(a) {
    if (typeof a === "object")
      return a;
    a = a.split(":");
    if (a.length !== 2)
      throw Error("Do not register custom functions in the default function namespace");
    const [b, c] = a;
    a = Xf[b];
    if (!a) {
      a = `generated_namespace_uri_${b}`;
      if (Xf[b])
        throw Error("Prefix already registered: Do not register the same prefix twice.");
      Xf[b] = a;
    }
    return {localName: c, namespaceURI: a};
  }
  function xu(a, b, c, d) {
    const {namespaceURI: e, localName: f} = wu(a);
    if (!e)
      throw cg();
    const h = b.map((l) => Ja(l)), k = Ja(c);
    Wf(e, f, h, k, function(l, n, t) {
      var u = Array.from(arguments);
      u.splice(0, 3);
      u = u.map((F, O) => vu(F, h[O], n));
      const y = {currentContext: n.o, domFacade: n.h.h};
      let z;
      try {
        z = d.apply(void 0, [y, ...u]);
      } catch (F) {
        throw new uu(F, f, e);
      }
      return z && typeof z === "object" && Object.getOwnPropertySymbols(z).includes(qq) ? w.create(z.xb) : Zb(n.h, z, k);
    });
  }
  var yu = {callFunction(a, b, c, d, e) {
    const f = Vf(b, c, d.length);
    if (!f)
      throw Error("function not found for codegen function call");
    b = new cc({N: null, Fa: 0, za: w.empty(), wa: {}});
    const h = new nb(a);
    a = new ic(false, false, h, null, null, e ? e.currentContext : null, null);
    d = f.callFunction(b, a, null, ...d.map((k, l) => Zb(h, k, f.j[l])));
    return vu(d, {type: 59, g: 0}, a);
  }, errXPDY0002: lc};
  var zu = (a, b, c, d) => {
    c = c ? c : new Za();
    return a()(b !== null && b !== void 0 ? b : null, c, yu, d);
  };
  const Au = {["http://www.w3.org/2005/XQueryX"]: "xqx", ["http://www.w3.org/2007/xquery-update-10"]: "xquf", ["http://fontoxml.com/fontoxpath"]: "x"};
  function Bu(a, b) {
    switch (a) {
      case "copySource":
      case "insertAfter":
      case "insertAsFirst":
      case "insertAsLast":
      case "insertBefore":
      case "insertInto":
      case "modifyExpr":
      case "newNameExpr":
      case "replacementExpr":
      case "replaceValue":
      case "returnExpr":
      case "sourceExpr":
      case "targetExpr":
      case "transformCopies":
      case "transformCopy":
        return {localName: a, kb: b || "http://www.w3.org/2005/XQueryX"};
      case "deleteExpr":
      case "insertExpr":
      case "renameExpr":
      case "replaceExpr":
      case "transformExpr":
        return {localName: a, kb: "http://www.w3.org/2007/xquery-update-10"};
      case "x:stackTrace":
        return {localName: "stackTrace", kb: "http://fontoxml.com/fontoxpath"};
      default:
        return {localName: a, kb: "http://www.w3.org/2005/XQueryX"};
    }
  }
  function Cu(a, b, c, d, e) {
    if (typeof c === "string")
      return c.length === 0 ? null : b.createTextNode(c);
    if (!Array.isArray(c))
      throw new TypeError("JsonML element should be an array or string");
    var f = Bu(c[0], d);
    d = f.localName;
    f = f.kb;
    const h = b.createElementNS(f, Au[f] + ":" + d), k = c[1];
    var l = 1;
    if (typeof k === "object" && !Array.isArray(k)) {
      if (k !== null)
        for (var n of Object.keys(k))
          l = k[n], l !== null && (n === "type" ? l !== void 0 && a.setAttributeNS(h, f, "fontoxpath:" + n, Ha(l)) : (n !== "start" && n !== "end" || d !== "stackTrace" || (l = JSON.stringify(l)), e && n === "prefix" && l === "" || a.setAttributeNS(h, f, Au[f] + ":" + n, l)));
      l = 2;
    }
    for (let t = l, u = c.length; t < u; ++t)
      n = Cu(a, b, c[t], f, e), n !== null && a.insertBefore(h, n, null);
    return h;
  }
  function Du(a, b, c, d = ab) {
    a = uk(a);
    let e;
    try {
      e = Wp(a, {Z: b.language === "XQuery3.1" || b.language === "XQueryUpdate3.1", debug: b.debug});
    } catch (l) {
      Pf(a, l);
    }
    var f = new Yf(b.namespaceResolver || (() => null), {}, b.defaultFunctionNamespaceURI === void 0 ? "http://www.w3.org/2005/xpath-functions" : b.defaultFunctionNamespaceURI, b.functionNameResolver || (() => null));
    f = new jg(f);
    var h = G(e, ["mainModule", "libraryModule"]), k = G(h, "moduleDecl");
    if (k) {
      const l = H(G(k, "prefix"));
      k = H(G(k, "uri"));
      ng(f, l, k);
    }
    (h = G(h, "prolog")) && Zp(h, f, false, a);
    b.annotateAst !== false && Rg(e, new Zg(f));
    f = new Za();
    b = Cu(d, c, e, null, b.kc === false);
    d.insertBefore(b, c.createComment(a), f.getFirstChild(b));
    return b;
  }
  function Eu(a) {
    return Promise.resolve(a);
  }
  function Fu(a, b = {debug: false}) {
    b = Wp(a, {Z: true, debug: b.debug});
    Rg(b, new Zg());
    b = G(b, "libraryModule");
    if (!b)
      throw Error("XQuery module must be declared in a library module.");
    var c = G(b, "moduleDecl"), d = G(c, "uri");
    const e = H(d);
    c = G(c, "prefix");
    d = H(c);
    c = new jg(new Yf(() => null, Object.create(null), "http://www.w3.org/2005/xpath-functions", tq("http://www.w3.org/2005/xpath-functions")));
    ng(c, d, e);
    b = G(b, "prolog");
    if (b !== null) {
      let f;
      try {
        f = Zp(b, c, true, a);
      } catch (h) {
        Pf(a, h);
      }
      f.Ha.forEach(({namespaceURI: h}) => {
        if (e !== h)
          throw Error("XQST0048: Functions and variables declared in a module must reside in the module target namespace.");
      });
      rk(e, f);
    } else
      rk(e, {Ha: [], Ta: [], oa: null, source: a});
    return e;
  }
  const Gu = new Map();
  function Hu(a) {
    var b;
    a: {
      if (b = lk.get(a)) {
        for (const c of Object.keys(b))
          if (b[c] && b[c].length) {
            b = b[c][0].h;
            break a;
          }
      }
      b = null;
    }
    if (b)
      return b;
    if (Gu.has(a))
      return Gu.get(a);
    b = typeof a === "string" ? Wp(a, {Z: false}) : pk(a);
    b = J(b, ["mainModule", "queryBody", "*"]);
    if (b === null)
      throw Error("Library modules do not have a specificity");
    b = kk(b, {qa: false, Z: false});
    Gu.set(a, b);
    return b;
  }
  function Iu(a) {
    return Hu(a).D();
  }
  function Ju(a, b) {
    return af(Hu(a).o, Hu(b).o);
  }
  var Ku = new Za();
  typeof fontoxpathGlobal !== "undefined" && (fontoxpathGlobal.compareSpecificity = Ju, fontoxpathGlobal.compileXPathToJavaScript = tu, fontoxpathGlobal.domFacade = Ku, fontoxpathGlobal.evaluateXPath = Fq, fontoxpathGlobal.evaluateXPathToArray = Kq, fontoxpathGlobal.evaluateXPathToAsyncIterator = Gq, fontoxpathGlobal.evaluateXPathToBoolean = Lq, fontoxpathGlobal.evaluateXPathToFirstNode = Mq, fontoxpathGlobal.evaluateXPathToMap = Nq, fontoxpathGlobal.evaluateXPathToNodes = Oq, fontoxpathGlobal.evaluateXPathToNumber = Pq, fontoxpathGlobal.evaluateXPathToNumbers = Qq, fontoxpathGlobal.evaluateXPathToString = Rq, fontoxpathGlobal.evaluateXPathToStrings = Sq, fontoxpathGlobal.evaluateUpdatingExpression = Iq, fontoxpathGlobal.evaluateUpdatingExpressionSync = Jq, fontoxpathGlobal.executeJavaScriptCompiledXPath = zu, fontoxpathGlobal.executePendingUpdateList = Tq, fontoxpathGlobal.getBucketForSelector = Iu, fontoxpathGlobal.getBucketsForNode = Ya, fontoxpathGlobal.precompileXPath = Eu, fontoxpathGlobal.registerXQueryModule = Fu, fontoxpathGlobal.registerCustomXPathFunction = xu, fontoxpathGlobal.parseScript = Du, fontoxpathGlobal.profiler = Cq, fontoxpathGlobal.createTypedValueFactory = rq, fontoxpathGlobal.finalizeModuleRegistration = tk, fontoxpathGlobal.Language = Eq, fontoxpathGlobal.ReturnType = yq);
  return fontoxpathGlobal;
}.call(typeof window === "undefined" ? void 0 : window, xspattern, prsc);
const compareSpecificity = fontoxpath.compareSpecificity;
const compileXPathToJavaScript = fontoxpath.compileXPathToJavaScript;
const createTypedValueFactory = fontoxpath.createTypedValueFactory;
const domFacade = fontoxpath.domFacade;
const evaluateUpdatingExpression = fontoxpath.evaluateUpdatingExpression;
const evaluateUpdatingExpressionSync = fontoxpath.evaluateUpdatingExpressionSync;
const evaluateXPath = fontoxpath.evaluateXPath;
const evaluateXPathToArray = fontoxpath.evaluateXPathToArray;
const evaluateXPathToAsyncIterator = fontoxpath.evaluateXPathToAsyncIterator;
const evaluateXPathToBoolean = fontoxpath.evaluateXPathToBoolean;
const evaluateXPathToFirstNode = fontoxpath.evaluateXPathToFirstNode;
const evaluateXPathToMap = fontoxpath.evaluateXPathToMap;
const evaluateXPathToNodes = fontoxpath.evaluateXPathToNodes;
const evaluateXPathToNumber = fontoxpath.evaluateXPathToNumber;
const evaluateXPathToNumbers = fontoxpath.evaluateXPathToNumbers;
const evaluateXPathToString = fontoxpath.evaluateXPathToString;
const evaluateXPathToStrings = fontoxpath.evaluateXPathToStrings;
const executeJavaScriptCompiledXPath = fontoxpath.executeJavaScriptCompiledXPath;
const executePendingUpdateList = fontoxpath.executePendingUpdateList;
const finalizeModuleRegistration = fontoxpath.finalizeModuleRegistration;
const getBucketForSelector = fontoxpath.getBucketForSelector;
const getBucketsForNode = fontoxpath.getBucketsForNode;
const Language = fontoxpath.Language;
const parseScript = fontoxpath.parseScript;
const precompileXPath = fontoxpath.precompileXPath;
const profiler = fontoxpath.profiler;
const registerCustomXPathFunction = fontoxpath.registerCustomXPathFunction;
const registerXQueryModule = fontoxpath.registerXQueryModule;
const ReturnType = fontoxpath.ReturnType;
export default fontoxpath;
export {Language, ReturnType, compareSpecificity, compileXPathToJavaScript, createTypedValueFactory, domFacade, evaluateUpdatingExpression, evaluateUpdatingExpressionSync, evaluateXPath, evaluateXPathToArray, evaluateXPathToAsyncIterator, evaluateXPathToBoolean, evaluateXPathToFirstNode, evaluateXPathToMap, evaluateXPathToNodes, evaluateXPathToNumber, evaluateXPathToNumbers, evaluateXPathToString, evaluateXPathToStrings, executeJavaScriptCompiledXPath, executePendingUpdateList, finalizeModuleRegistration, getBucketForSelector, getBucketsForNode, parseScript, precompileXPath, profiler, registerCustomXPathFunction, registerXQueryModule};
