function t(t2, s2, r2, i2) {
  const n2 = {op: s2, func: r2, data: i2};
  return t2.push(n2), n2;
}
function s(t2, s2) {
  return t2;
}
class r {
  constructor() {
    this.program = [];
  }
  test(s2, r3) {
    return t(this.program, 5, s2, r3 === void 0 ? null : r3);
  }
  jump(s2) {
    return t(this.program, 3, null, s2);
  }
  record(r3, i2) {
    return t(this.program, 4, i2 === void 0 ? s : i2, r3);
  }
  bad(s2 = 1) {
    return t(this.program, 1, null, s2);
  }
  accept() {
    return t(this.program, 0, null, null);
  }
  fail(s2) {
    return t(this.program, 2, s2 || null, null);
  }
}
class i {
  constructor(t2, s2, r2) {
    this.programLength = t2, this.maxFromByPc = s2, this.maxSurvivorFromByPc = r2;
  }
  static fromProgram(t2) {
    const s2 = t2.length, r2 = [], n2 = [];
    return t2.forEach((t3) => {
      r2.push(0), n2.push(0);
    }), t2.forEach((t3, i2) => {
      switch (t3.op) {
        case 2:
          if (t3.func === null)
            return;
          if (i2 + 1 >= s2)
            throw new Error("Invalid program: program could run past end");
          r2[i2 + 1] += 1;
          break;
        case 1:
        case 4:
          if (i2 + 1 >= s2)
            throw new Error("Invalid program: program could run past end");
          r2[i2 + 1] += 1;
          break;
        case 3:
          t3.data.forEach((t4) => {
            if (t4 < 0 || t4 >= s2)
              throw new Error("Invalid program: program could run past end");
            r2[t4] += 1;
          });
          break;
        case 5:
          if (i2 + 1 >= s2)
            throw new Error("Invalid program: program could run past end");
          n2[i2 + 1] += 1;
          break;
        case 0:
          n2[i2] += 1;
      }
    }), new i(s2, r2, n2);
  }
  static createStub(t2) {
    const s2 = [], r2 = [];
    for (let i2 = 0; i2 < t2; ++i2)
      s2.push(t2), r2.push(t2);
    return new i(t2, s2, r2);
  }
}
class n {
  constructor(t2) {
    this.acceptingTraces = t2, this.success = t2.length > 0;
  }
}
class h {
  constructor(t2) {
    this.t = 0, this.i = 0, this.h = new Uint16Array(t2), this.l = new Uint8Array(t2);
  }
  getBadness(t2) {
    return this.l[t2];
  }
  add(t2, s2) {
    this.l[t2] = s2 > 255 ? 255 : s2;
    const r2 = function(t3, s3, r3, i2, n2) {
      let h3 = i2, e2 = n2;
      for (; h3 < e2; ) {
        const i3 = h3 + e2 >>> 1;
        r3 < s3[t3[i3]] ? e2 = i3 : h3 = i3 + 1;
      }
      return h3;
    }(this.h, this.l, s2, this.i, this.t);
    this.h.copyWithin(r2 + 1, r2, this.t), this.h[r2] = t2, this.t += 1;
  }
  reschedule(t2, s2) {
    const r2 = Math.max(this.l[t2], s2 > 255 ? 255 : s2);
    if (this.l[t2] !== r2) {
      const s3 = this.h.indexOf(t2, this.i);
      if (s3 < 0 || s3 >= this.t)
        return void (this.l[t2] = r2);
      this.h.copyWithin(s3, s3 + 1, this.t), this.t -= 1, this.add(t2, r2);
    }
  }
  getNextPc() {
    return this.i >= this.t ? null : this.h[this.i++];
  }
  reset() {
    this.t = 0, this.i = 0, this.l.fill(0);
  }
}
class e {
  constructor(t2) {
    this.o = [];
    let s2 = t2.length;
    t2.forEach((t3) => {
      this.o.push(t3 > 0 ? s2 : -1), s2 += t3;
    }), this.u = new Uint16Array(s2);
  }
  clear() {
    this.u.fill(0, 0, this.o.length);
  }
  add(t2, s2) {
    const r2 = this.u[s2], i2 = this.o[s2];
    this.u[s2] += 1, this.u[i2 + r2] = t2;
  }
  has(t2) {
    return this.u[t2] > 0;
  }
  forEach(t2, s2) {
    const r2 = this.u[t2], i2 = this.o[t2];
    for (let t3 = i2; t3 < i2 + r2; ++t3)
      s2(this.u[t3]);
  }
}
function l(t2, s2, r2 = false) {
  return t2 === null ? s2 : Array.isArray(t2) ? (t2.indexOf(s2) === -1 && (r2 && (t2 = t2.slice()), t2.push(s2)), t2) : t2 === s2 ? t2 : [t2, s2];
}
class c {
  constructor(t2, s2) {
    this.prefixes = t2, this.record = s2;
  }
}
function o(t2, s2) {
  let r2;
  if (s2 === null) {
    if (!Array.isArray(t2))
      return t2;
    r2 = t2;
  } else
    r2 = t2 === c.EMPTY ? [] : Array.isArray(t2) ? t2 : [t2];
  return new c(r2, s2);
}
c.EMPTY = new c([], null);
class u {
  constructor(t2) {
    this.p = [], this.v = [];
    for (let s2 = 0; s2 < t2; ++s2)
      this.p.push(0), this.v.push(null);
  }
  mergeTraces(t2, s2, r2, i2, n2, h2) {
    let e2 = false;
    return r2.forEach(s2, (s3) => {
      const r3 = this.trace(s3, i2, n2, h2);
      var c2, o2, u3;
      o2 = r3, u3 = e2, t2 = (c2 = t2) === null ? o2 : o2 === null ? c2 : Array.isArray(o2) ? o2.reduce((t3, s4) => l(t3, s4, t3 === o2), c2) : l(c2, o2, u3), e2 = t2 === r3;
    }), t2;
  }
  trace(t2, s2, r2, i2) {
    switch (this.p[t2]) {
      case 2:
        return this.v[t2];
      case 1:
        return null;
    }
    this.p[t2] = 1;
    let n2 = null;
    const h2 = s2[t2];
    if (h2 !== null)
      n2 = h2;
    else if (!r2.has(t2))
      throw new Error("Trace without source at pc " + t2);
    if (n2 = this.mergeTraces(n2, t2, r2, s2, r2, i2), n2 !== null) {
      const s3 = i2[t2];
      s3 !== null && (n2 = o(n2, s3));
    }
    return this.v[t2] = n2, this.p[t2] = 2, n2;
  }
  buildSurvivorTraces(t2, s2, r2, i2, n2) {
    for (let h2 = 0, e2 = t2.length; h2 < e2; ++h2) {
      if (!r2.has(h2)) {
        s2[h2] = null;
        continue;
      }
      this.v.fill(null), this.p.fill(0);
      const e3 = this.mergeTraces(null, h2, r2, t2, i2, n2);
      if (e3 === null)
        throw new Error("No non-cyclic paths found to survivor " + h2);
      s2[h2] = o(e3, null);
    }
    this.v.fill(null);
  }
}
class a {
  constructor(t2) {
    this.g = [], this.k = [], this.m = [], this.A = new e(t2.maxFromByPc), this.T = new e(t2.maxSurvivorFromByPc), this.S = new u(t2.programLength);
    for (let s2 = 0; s2 < t2.programLength; ++s2)
      this.g.push(null), this.k.push(null), this.m.push(null);
    this.k[0] = c.EMPTY;
  }
  reset(t2) {
    this.A.clear(), this.T.clear(), this.g.fill(null), t2 && (this.k.fill(null), this.m.fill(null), this.k[0] = c.EMPTY);
  }
  record(t2, s2) {
    this.g[t2] = s2;
  }
  has(t2) {
    return this.A.has(t2) || this.k[t2] !== null;
  }
  add(t2, s2) {
    this.A.add(t2, s2);
  }
  hasSurvivor(t2) {
    return this.T.has(t2);
  }
  addSurvivor(t2, s2) {
    this.T.add(t2, s2);
  }
  buildSurvivorTraces() {
    const t2 = this.k;
    this.S.buildSurvivorTraces(t2, this.m, this.T, this.A, this.g), this.k = this.m, this.m = t2;
  }
  getTraces(t2) {
    const s2 = t2.reduce((t3, s3) => l(t3, this.k[s3]), null);
    return s2 === null ? [] : Array.isArray(s2) ? s2 : [s2];
  }
}
class f {
  constructor(t2) {
    this.I = [], this.N = new h(t2.programLength), this.M = new h(t2.programLength), this.P = new a(t2);
  }
  reset() {
    this.N.reset(), this.N.add(0, 0), this.I.length = 0, this.P.reset(true);
  }
  getNextThreadPc() {
    return this.N.getNextPc();
  }
  step(t2, s2, r2) {
    const i2 = this.P.has(s2);
    this.P.add(t2, s2);
    const n2 = this.N.getBadness(t2) + r2;
    i2 ? this.N.reschedule(s2, n2) : this.N.add(s2, n2);
  }
  stepToNextGeneration(t2, s2) {
    const r2 = this.P.hasSurvivor(s2);
    this.P.addSurvivor(t2, s2);
    const i2 = this.N.getBadness(t2);
    r2 ? this.M.reschedule(s2, i2) : this.M.add(s2, i2);
  }
  accept(t2) {
    this.I.push(t2), this.P.addSurvivor(t2, t2);
  }
  fail(t2) {
  }
  record(t2, s2) {
    this.P.record(t2, s2);
  }
  nextGeneration() {
    this.P.buildSurvivorTraces(), this.P.reset(false);
    const t2 = this.N;
    t2.reset(), this.N = this.M, this.M = t2;
  }
  getAcceptingTraces() {
    return this.P.getTraces(this.I);
  }
}
class d {
  constructor(t2) {
    this.U = [], this.G = t2, this.V = i.fromProgram(t2), this.U.push(new f(this.V));
  }
  execute(t2, s2) {
    const r2 = this.U.pop() || new f(this.V);
    r2.reset();
    const i2 = t2.length;
    let h2, e2 = -1;
    do {
      let n2 = r2.getNextThreadPc();
      if (n2 === null)
        break;
      for (++e2, h2 = e2 >= i2 ? null : t2[e2]; n2 !== null; ) {
        const t3 = this.G[n2];
        switch (t3.op) {
          case 0:
            h2 === null ? r2.accept(n2) : r2.fail(n2);
            break;
          case 2: {
            const i3 = t3.func;
            if (i3 === null || i3(s2)) {
              r2.fail(n2);
              break;
            }
            r2.step(n2, n2 + 1, 0);
            break;
          }
          case 1:
            r2.step(n2, n2 + 1, t3.data);
            break;
          case 5:
            if (h2 === null) {
              r2.fail(n2);
              break;
            }
            if (!(0, t3.func)(h2, t3.data, s2)) {
              r2.fail(n2);
              break;
            }
            r2.stepToNextGeneration(n2, n2 + 1);
            break;
          case 3: {
            const s3 = t3.data, i3 = s3.length;
            if (i3 === 0) {
              r2.fail(n2);
              break;
            }
            for (let t4 = 0; t4 < i3; ++t4)
              r2.step(n2, s3[t4], 0);
            break;
          }
          case 4: {
            const i3 = (0, t3.func)(t3.data, e2, s2);
            i3 != null && r2.record(n2, i3), r2.step(n2, n2 + 1, 0);
            break;
          }
        }
        n2 = r2.getNextThreadPc();
      }
      r2.nextGeneration();
    } while (h2 !== null);
    const l2 = new n(r2.getAcceptingTraces());
    return r2.reset(), this.U.push(r2), l2;
  }
}
function w(t2) {
  const s2 = new r();
  return t2(s2), new d(s2.program);
}
var p = {Assembler: r, VM: d, compileVM: w};
export default p;
export {r as Assembler, d as VM, w as compileVM};
