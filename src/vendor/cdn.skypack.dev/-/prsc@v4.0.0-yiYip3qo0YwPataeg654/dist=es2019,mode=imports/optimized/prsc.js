function n(n2, t2) {
  return {success: true, offset: n2, value: t2};
}
function t(t2) {
  return n(t2, void 0);
}
function e(n2, t2, e2 = false) {
  return {success: false, offset: n2, expected: t2, fatal: e2};
}
function r(t2) {
  return (r2, u2) => {
    const o2 = u2 + t2.length;
    return r2.slice(u2, o2) === t2 ? n(o2, t2) : e(u2, [t2]);
  };
}
function u(n2) {
  return n2 > 65535 ? 2 : 1;
}
function o(n2, r2) {
  return (o2, c2) => {
    const f2 = o2.codePointAt(c2);
    return f2 !== void 0 && n2(f2) ? t(c2 + u(f2)) : e(c2, r2);
  };
}
function c(n2, r2) {
  return (u2, o2) => {
    const c2 = o2;
    for (; ; ) {
      const t2 = u2.codePointAt(o2);
      if (t2 === void 0)
        break;
      if (!n2(t2))
        break;
      o2 += t2 > 65535 ? 2 : 1;
    }
    return r2 !== void 0 && o2 === c2 ? e(o2, r2) : t(o2);
  };
}
function f(n2, t2, e2) {
  return o((e3) => n2 <= e3 && e3 <= t2, e2 || [`${String.fromCodePoint(n2)}-${String.fromCodePoint(t2)}`]);
}
function s(n2) {
  return (r2, o2) => {
    let c2 = n2;
    for (; c2 > 0; ) {
      const n3 = r2.codePointAt(o2);
      if (n3 === void 0)
        return e(o2, ["any character"]);
      o2 += u(n3), c2 -= 1;
    }
    return t(o2);
  };
}
function i(t2, e2) {
  return (r2, u2) => {
    const o2 = t2(r2, u2);
    return o2.success ? n(o2.offset, e2(o2.value)) : o2;
  };
}
function l(n2) {
  return i(n2, () => {
  });
}
function a(n2, t2, r2, u2) {
  return (o2, c2) => {
    const f2 = n2(o2, c2);
    return f2.success ? t2(f2.value) ? f2 : e(c2, r2, u2) : f2;
  };
}
function d(n2, t2) {
  return (r2, u2) => {
    let o2 = null;
    for (const e2 of n2) {
      const n3 = e2(r2, u2);
      if (n3.success)
        return n3;
      if (o2 === null || n3.offset > o2.offset ? o2 = n3 : n3.offset === o2.offset && t2 === void 0 && (o2.expected = o2.expected.concat(n3.expected)), n3.fatal)
        return n3;
    }
    return t2 = t2 || (o2 == null ? void 0 : o2.expected) || [], o2 && (o2.expected = t2), o2 || e(u2, t2);
  };
}
function v(t2) {
  return (e2, r2) => {
    const u2 = t2(e2, r2);
    return u2.success || u2.fatal ? u2 : n(r2, null);
  };
}
function p(t2) {
  return (e2, r2) => {
    let u2 = [], o2 = r2;
    for (; ; ) {
      const n2 = t2(e2, o2);
      if (!n2.success) {
        if (n2.fatal)
          return n2;
        break;
      }
      if (u2.push(n2.value), n2.offset === o2)
        break;
      o2 = n2.offset;
    }
    return n(o2, u2);
  };
}
function x(n2) {
  return (e2, r2) => {
    let u2 = r2;
    for (; ; ) {
      const t2 = n2(e2, u2);
      if (!t2.success) {
        if (t2.fatal)
          return t2;
        break;
      }
      if (t2.offset === u2)
        break;
      u2 = t2.offset;
    }
    return t(u2);
  };
}
function y(n2) {
  return i(n2, (n3) => n3.filter((n4) => n4 !== void 0));
}
function b(t2, e2, r2) {
  return (u2, o2) => {
    const c2 = t2(u2, o2);
    if (!c2.success)
      return c2;
    const f2 = e2(u2, c2.offset);
    return f2.success ? n(f2.offset, r2(c2.value, f2.value)) : f2;
  };
}
function h(...t2) {
  return (e2, r2) => {
    const u2 = [];
    for (const n2 of t2) {
      const t3 = n2(e2, r2);
      if (!t3.success)
        return t3;
      r2 = t3.offset, u2.push(t3.value);
    }
    return n(r2, u2);
  };
}
function k(...n2) {
  return (e2, r2) => {
    for (const t2 of n2) {
      const n3 = t2(e2, r2);
      if (!n3.success)
        return n3;
      r2 = n3.offset;
    }
    return t(r2);
  };
}
function P(n2) {
  return b(n2, p(n2), (n3, t2) => [n3].concat(t2));
}
function g(n2, t2) {
  return n2;
}
function A(n2, t2) {
  return t2;
}
function m(n2) {
  return b(n2, x(n2), A);
}
function C(n2, t2) {
  return b(n2, t2, A);
}
function S(n2, t2) {
  return b(n2, t2, g);
}
function $(n2, t2, e2, r2 = false) {
  return C(n2, r2 ? D(S(t2, e2)) : S(t2, e2));
}
function j(t2) {
  return (e2, r2) => {
    const u2 = t2(e2, r2);
    return u2.success ? n(u2.offset, e2.slice(r2, u2.offset)) : u2;
  };
}
function q(t2) {
  return (e2, r2) => {
    const u2 = t2(e2, r2);
    return u2.success ? n(r2, u2.value) : u2;
  };
}
function w(n2, r2) {
  return (u2, o2) => n2(u2, o2).success ? e(o2, r2) : t(o2);
}
function z(n2, t2, e2) {
  return C(w(t2, e2), n2);
}
function B(n2, t2, r2 = 0, u2 = []) {
  return (o2, c2) => {
    const f2 = o2.codePointAt(c2 + r2);
    if (f2 === void 0)
      return e(c2, u2);
    const s2 = n2[f2];
    return s2 === void 0 ? t2 === void 0 ? e(c2, u2) : t2(o2, c2) : s2(o2, c2);
  };
}
function D(n2) {
  return (t2, r2) => {
    const u2 = n2(t2, r2);
    return u2.success ? u2 : e(u2.offset, u2.expected, true);
  };
}
const E = (n2, r2) => r2 === 0 ? t(r2) : e(r2, ["start of input"]), F = (n2, r2) => n2.length === r2 ? t(r2) : e(r2, ["end of input"]);
function G(n2) {
  return b(n2, F, g);
}
function H(n2) {
  const t2 = [];
  let e2 = n2.next();
  for (; !e2.done; )
    t2.push(e2.value), e2 = n2.next();
  return [t2, e2.value];
}
function I(n2) {
  return function* (t2, e2) {
    const r2 = n2(t2, e2);
    return r2.success && (yield r2.value), r2;
  };
}
function J(n2, t2) {
  return function* (e2, r2) {
    const u2 = yield* n2(e2, r2);
    return u2.success ? yield* t2(e2, u2.offset) : u2;
  };
}
function K(n2) {
  return function* (t2, e2) {
    const r2 = n2(t2, e2);
    let u2 = r2.next();
    for (; !u2.done; ) {
      const n3 = u2.value;
      n3 !== void 0 && (yield n3), u2 = r2.next();
    }
    return u2.value;
  };
}
function L(n2) {
  return function* (e2, r2) {
    for (; ; ) {
      const [u2, o2] = H(n2(e2, r2));
      if (!o2.success)
        return o2.fatal ? o2 : t(r2);
      if (yield* u2, r2 === o2.offset)
        return t(r2);
      r2 = o2.offset;
    }
  };
}
function M(n2) {
  return function* (e2, r2) {
    const [u2, o2] = H(n2(e2, r2));
    return o2.success ? (yield* u2, o2) : o2.fatal ? o2 : t(r2);
  };
}
function N(n2) {
  return function* (t2, e2) {
    const r2 = yield* n2(t2, e2);
    return r2.success ? F(t2, r2.offset) : r2;
  };
}
export {o as codepoint, c as codepoints, H as collect, G as complete, l as consume, D as cut, $ as delimited, B as dispatch, F as end, e as error, z as except, a as filter, y as filterUndefined, g as first, S as followed, i as map, w as not, t as ok, n as okWithValue, v as optional, d as or, q as peek, P as plus, m as plusConsumed, C as preceded, f as range, j as recognize, A as second, h as sequence, k as sequenceConsumed, s as skipChars, p as star, x as starConsumed, E as start, I as streaming, N as streamingComplete, K as streamingFilterUndefined, M as streamingOptional, L as streamingStar, J as streamingThen, b as then, r as token};
export default null;
