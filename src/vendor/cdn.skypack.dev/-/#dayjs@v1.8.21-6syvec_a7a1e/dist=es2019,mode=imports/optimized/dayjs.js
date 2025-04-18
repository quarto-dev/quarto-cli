var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function createCommonjsModule(fn, basedir, module) {
  return module = {
    path: basedir,
    exports: {},
    require: function(path, base) {
      return commonjsRequire(path, base === void 0 || base === null ? module.path : base);
    }
  }, fn(module, module.exports), module.exports;
}
function commonjsRequire() {
  throw new Error("Dynamic requires are not currently supported by @rollup/plugin-commonjs");
}
var dayjs_min = createCommonjsModule(function(module, exports) {
  !function(t, n) {
    module.exports = n();
  }(commonjsGlobal, function() {
    var t = "millisecond", n = "second", e = "minute", r = "hour", i = "day", s = "week", u = "month", o = "quarter", a = "year", h = /^(\d{4})-?(\d{1,2})-?(\d{0,2})[^0-9]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?.?(\d{1,3})?$/, f = /\[([^\]]+)]|Y{2,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g, c = function(t2, n2, e2) {
      var r2 = String(t2);
      return !r2 || r2.length >= n2 ? t2 : "" + Array(n2 + 1 - r2.length).join(e2) + t2;
    }, d = {s: c, z: function(t2) {
      var n2 = -t2.utcOffset(), e2 = Math.abs(n2), r2 = Math.floor(e2 / 60), i2 = e2 % 60;
      return (n2 <= 0 ? "+" : "-") + c(r2, 2, "0") + ":" + c(i2, 2, "0");
    }, m: function(t2, n2) {
      var e2 = 12 * (n2.year() - t2.year()) + (n2.month() - t2.month()), r2 = t2.clone().add(e2, u), i2 = n2 - r2 < 0, s2 = t2.clone().add(e2 + (i2 ? -1 : 1), u);
      return Number(-(e2 + (n2 - r2) / (i2 ? r2 - s2 : s2 - r2)) || 0);
    }, a: function(t2) {
      return t2 < 0 ? Math.ceil(t2) || 0 : Math.floor(t2);
    }, p: function(h2) {
      return {M: u, y: a, w: s, d: i, D: "date", h: r, m: e, s: n, ms: t, Q: o}[h2] || String(h2 || "").toLowerCase().replace(/s$/, "");
    }, u: function(t2) {
      return t2 === void 0;
    }}, $ = {name: "en", weekdays: "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"), months: "January_February_March_April_May_June_July_August_September_October_November_December".split("_")}, l = "en", m = {};
    m[l] = $;
    var y = function(t2) {
      return t2 instanceof v;
    }, M = function(t2, n2, e2) {
      var r2;
      if (!t2)
        return l;
      if (typeof t2 == "string")
        m[t2] && (r2 = t2), n2 && (m[t2] = n2, r2 = t2);
      else {
        var i2 = t2.name;
        m[i2] = t2, r2 = i2;
      }
      return e2 || (l = r2), r2;
    }, g = function(t2, n2, e2) {
      if (y(t2))
        return t2.clone();
      var r2 = n2 ? typeof n2 == "string" ? {format: n2, pl: e2} : n2 : {};
      return r2.date = t2, new v(r2);
    }, D = d;
    D.l = M, D.i = y, D.w = function(t2, n2) {
      return g(t2, {locale: n2.$L, utc: n2.$u, $offset: n2.$offset});
    };
    var v = function() {
      function c2(t2) {
        this.$L = this.$L || M(t2.locale, null, true), this.parse(t2);
      }
      var d2 = c2.prototype;
      return d2.parse = function(t2) {
        this.$d = function(t3) {
          var n2 = t3.date, e2 = t3.utc;
          if (n2 === null)
            return new Date(NaN);
          if (D.u(n2))
            return new Date();
          if (n2 instanceof Date)
            return new Date(n2);
          if (typeof n2 == "string" && !/Z$/i.test(n2)) {
            var r2 = n2.match(h);
            if (r2)
              return e2 ? new Date(Date.UTC(r2[1], r2[2] - 1, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, r2[7] || 0)) : new Date(r2[1], r2[2] - 1, r2[3] || 1, r2[4] || 0, r2[5] || 0, r2[6] || 0, r2[7] || 0);
          }
          return new Date(n2);
        }(t2), this.init();
      }, d2.init = function() {
        var t2 = this.$d;
        this.$y = t2.getFullYear(), this.$M = t2.getMonth(), this.$D = t2.getDate(), this.$W = t2.getDay(), this.$H = t2.getHours(), this.$m = t2.getMinutes(), this.$s = t2.getSeconds(), this.$ms = t2.getMilliseconds();
      }, d2.$utils = function() {
        return D;
      }, d2.isValid = function() {
        return !(this.$d.toString() === "Invalid Date");
      }, d2.isSame = function(t2, n2) {
        var e2 = g(t2);
        return this.startOf(n2) <= e2 && e2 <= this.endOf(n2);
      }, d2.isAfter = function(t2, n2) {
        return g(t2) < this.startOf(n2);
      }, d2.isBefore = function(t2, n2) {
        return this.endOf(n2) < g(t2);
      }, d2.$g = function(t2, n2, e2) {
        return D.u(t2) ? this[n2] : this.set(e2, t2);
      }, d2.year = function(t2) {
        return this.$g(t2, "$y", a);
      }, d2.month = function(t2) {
        return this.$g(t2, "$M", u);
      }, d2.day = function(t2) {
        return this.$g(t2, "$W", i);
      }, d2.date = function(t2) {
        return this.$g(t2, "$D", "date");
      }, d2.hour = function(t2) {
        return this.$g(t2, "$H", r);
      }, d2.minute = function(t2) {
        return this.$g(t2, "$m", e);
      }, d2.second = function(t2) {
        return this.$g(t2, "$s", n);
      }, d2.millisecond = function(n2) {
        return this.$g(n2, "$ms", t);
      }, d2.unix = function() {
        return Math.floor(this.valueOf() / 1e3);
      }, d2.valueOf = function() {
        return this.$d.getTime();
      }, d2.startOf = function(t2, o2) {
        var h2 = this, f2 = !!D.u(o2) || o2, c3 = D.p(t2), d3 = function(t3, n2) {
          var e2 = D.w(h2.$u ? Date.UTC(h2.$y, n2, t3) : new Date(h2.$y, n2, t3), h2);
          return f2 ? e2 : e2.endOf(i);
        }, $2 = function(t3, n2) {
          return D.w(h2.toDate()[t3].apply(h2.toDate(), (f2 ? [0, 0, 0, 0] : [23, 59, 59, 999]).slice(n2)), h2);
        }, l2 = this.$W, m2 = this.$M, y2 = this.$D, M2 = "set" + (this.$u ? "UTC" : "");
        switch (c3) {
          case a:
            return f2 ? d3(1, 0) : d3(31, 11);
          case u:
            return f2 ? d3(1, m2) : d3(0, m2 + 1);
          case s:
            var g2 = this.$locale().weekStart || 0, v2 = (l2 < g2 ? l2 + 7 : l2) - g2;
            return d3(f2 ? y2 - v2 : y2 + (6 - v2), m2);
          case i:
          case "date":
            return $2(M2 + "Hours", 0);
          case r:
            return $2(M2 + "Minutes", 1);
          case e:
            return $2(M2 + "Seconds", 2);
          case n:
            return $2(M2 + "Milliseconds", 3);
          default:
            return this.clone();
        }
      }, d2.endOf = function(t2) {
        return this.startOf(t2, false);
      }, d2.$set = function(s2, o2) {
        var h2, f2 = D.p(s2), c3 = "set" + (this.$u ? "UTC" : ""), d3 = (h2 = {}, h2[i] = c3 + "Date", h2.date = c3 + "Date", h2[u] = c3 + "Month", h2[a] = c3 + "FullYear", h2[r] = c3 + "Hours", h2[e] = c3 + "Minutes", h2[n] = c3 + "Seconds", h2[t] = c3 + "Milliseconds", h2)[f2], $2 = f2 === i ? this.$D + (o2 - this.$W) : o2;
        if (f2 === u || f2 === a) {
          var l2 = this.clone().set("date", 1);
          l2.$d[d3]($2), l2.init(), this.$d = l2.set("date", Math.min(this.$D, l2.daysInMonth())).toDate();
        } else
          d3 && this.$d[d3]($2);
        return this.init(), this;
      }, d2.set = function(t2, n2) {
        return this.clone().$set(t2, n2);
      }, d2.get = function(t2) {
        return this[D.p(t2)]();
      }, d2.add = function(t2, o2) {
        var h2, f2 = this;
        t2 = Number(t2);
        var c3 = D.p(o2), d3 = function(n2) {
          var e2 = g(f2);
          return D.w(e2.date(e2.date() + Math.round(n2 * t2)), f2);
        };
        if (c3 === u)
          return this.set(u, this.$M + t2);
        if (c3 === a)
          return this.set(a, this.$y + t2);
        if (c3 === i)
          return d3(1);
        if (c3 === s)
          return d3(7);
        var $2 = (h2 = {}, h2[e] = 6e4, h2[r] = 36e5, h2[n] = 1e3, h2)[c3] || 1, l2 = this.$d.getTime() + t2 * $2;
        return D.w(l2, this);
      }, d2.subtract = function(t2, n2) {
        return this.add(-1 * t2, n2);
      }, d2.format = function(t2) {
        var n2 = this;
        if (!this.isValid())
          return "Invalid Date";
        var e2 = t2 || "YYYY-MM-DDTHH:mm:ssZ", r2 = D.z(this), i2 = this.$locale(), s2 = this.$H, u2 = this.$m, o2 = this.$M, a2 = i2.weekdays, h2 = i2.months, c3 = function(t3, r3, i3, s3) {
          return t3 && (t3[r3] || t3(n2, e2)) || i3[r3].substr(0, s3);
        }, d3 = function(t3) {
          return D.s(s2 % 12 || 12, t3, "0");
        }, $2 = i2.meridiem || function(t3, n3, e3) {
          var r3 = t3 < 12 ? "AM" : "PM";
          return e3 ? r3.toLowerCase() : r3;
        }, l2 = {YY: String(this.$y).slice(-2), YYYY: this.$y, M: o2 + 1, MM: D.s(o2 + 1, 2, "0"), MMM: c3(i2.monthsShort, o2, h2, 3), MMMM: h2[o2] || h2(this, e2), D: this.$D, DD: D.s(this.$D, 2, "0"), d: String(this.$W), dd: c3(i2.weekdaysMin, this.$W, a2, 2), ddd: c3(i2.weekdaysShort, this.$W, a2, 3), dddd: a2[this.$W], H: String(s2), HH: D.s(s2, 2, "0"), h: d3(1), hh: d3(2), a: $2(s2, u2, true), A: $2(s2, u2, false), m: String(u2), mm: D.s(u2, 2, "0"), s: String(this.$s), ss: D.s(this.$s, 2, "0"), SSS: D.s(this.$ms, 3, "0"), Z: r2};
        return e2.replace(f, function(t3, n3) {
          return n3 || l2[t3] || r2.replace(":", "");
        });
      }, d2.utcOffset = function() {
        return 15 * -Math.round(this.$d.getTimezoneOffset() / 15);
      }, d2.diff = function(t2, h2, f2) {
        var c3, d3 = D.p(h2), $2 = g(t2), l2 = 6e4 * ($2.utcOffset() - this.utcOffset()), m2 = this - $2, y2 = D.m(this, $2);
        return y2 = (c3 = {}, c3[a] = y2 / 12, c3[u] = y2, c3[o] = y2 / 3, c3[s] = (m2 - l2) / 6048e5, c3[i] = (m2 - l2) / 864e5, c3[r] = m2 / 36e5, c3[e] = m2 / 6e4, c3[n] = m2 / 1e3, c3)[d3] || m2, f2 ? y2 : D.a(y2);
      }, d2.daysInMonth = function() {
        return this.endOf(u).$D;
      }, d2.$locale = function() {
        return m[this.$L];
      }, d2.locale = function(t2, n2) {
        if (!t2)
          return this.$L;
        var e2 = this.clone(), r2 = M(t2, n2, true);
        return r2 && (e2.$L = r2), e2;
      }, d2.clone = function() {
        return D.w(this.$d, this);
      }, d2.toDate = function() {
        return new Date(this.valueOf());
      }, d2.toJSON = function() {
        return this.isValid() ? this.toISOString() : null;
      }, d2.toISOString = function() {
        return this.$d.toISOString();
      }, d2.toString = function() {
        return this.$d.toUTCString();
      }, c2;
    }();
    return g.prototype = v.prototype, g.extend = function(t2, n2) {
      return t2(n2, v, g), g;
    }, g.locale = M, g.isDayjs = y, g.unix = function(t2) {
      return g(1e3 * t2);
    }, g.en = m[l], g.Ls = m, g;
  });
});
var Ls = dayjs_min.Ls;
export default dayjs_min;
var en = dayjs_min.en;
var extend = dayjs_min.extend;
var isDayjs = dayjs_min.isDayjs;
var locale = dayjs_min.locale;
var unix = dayjs_min.unix;
export {Ls, dayjs_min as __moduleExports, en, extend, isDayjs, locale, unix};
