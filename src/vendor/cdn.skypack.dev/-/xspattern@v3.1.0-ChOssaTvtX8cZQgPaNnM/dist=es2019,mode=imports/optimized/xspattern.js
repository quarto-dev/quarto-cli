import {compileVM} from "/-/whynot@v5.0.0-TIWeI93neceQKiPCfmA6/dist=es2019,mode=imports/optimized/whynot.js";
function B(A) {
  return (B2) => B2 === A;
}
function a(A, B2) {
  if (A === null || B2 === null)
    throw new Error("unescaped hyphen may not be used as a range endpoint");
  if (B2 < A)
    throw new Error("character range is in the wrong order");
  return (a2) => A <= a2 && a2 <= B2;
}
function n(A) {
  return true;
}
function e() {
  return false;
}
function t(A, B2) {
  return (a2) => A(a2) || B2(a2);
}
function G(A, B2) {
  switch (B2.kind) {
    case "predicate":
      return void A.test(B2.value);
    case "regexp":
      return void r(A, B2.value, false);
  }
}
function i(A, B2) {
  B2.forEach((B3) => {
    !function(A2, B4) {
      const [a2, {min: n2, max: e2}] = B4;
      if (e2 !== null) {
        for (let B5 = 0; B5 < n2; ++B5)
          G(A2, a2);
        for (let B5 = n2; B5 < e2; ++B5) {
          const B6 = A2.jump([]);
          B6.data.push(A2.program.length), G(A2, a2), B6.data.push(A2.program.length);
        }
      } else if (n2 > 0) {
        for (let B6 = 0; B6 < n2 - 1; ++B6)
          G(A2, a2);
        const B5 = A2.program.length;
        G(A2, a2), A2.jump([B5]).data.push(A2.program.length);
      } else {
        const B5 = A2.program.length, n3 = A2.jump([]);
        n3.data.push(A2.program.length), G(A2, a2), A2.jump([B5]), n3.data.push(A2.program.length);
      }
    }(A, B3);
  });
}
function r(A, B2, a2) {
  const n2 = A.program.length, e2 = A.jump([]);
  a2 && (e2.data.push(A.program.length), A.test(() => true), A.jump([n2]));
  const t2 = [];
  if (B2.forEach((B3) => {
    e2.data.push(A.program.length), i(A, B3), t2.push(A.jump([]));
  }), t2.forEach((B3) => {
    B3.data.push(A.program.length);
  }), a2) {
    const B3 = A.program.length, a3 = A.jump([]);
    a3.data.push(A.program.length), A.test(() => true), A.jump([B3]), a3.data.push(A.program.length);
  }
}
function o(A, B2) {
  return {success: true, offset: A, value: B2};
}
function l(A) {
  return o(A, void 0);
}
function H(A, B2, a2 = false) {
  return {success: false, offset: A, expected: B2, fatal: a2};
}
function C(A) {
  return (B2, a2) => {
    const n2 = a2 + A.length;
    return B2.slice(a2, n2) === A ? o(n2, A) : H(a2, [A]);
  };
}
function u(A, B2) {
  return (a2, n2) => {
    const e2 = A(a2, n2);
    return e2.success ? o(e2.offset, B2(e2.value)) : e2;
  };
}
function s(A, B2, a2, n2) {
  return (e2, t2) => {
    const G2 = A(e2, t2);
    return G2.success ? B2(G2.value) ? G2 : H(t2, a2, n2) : G2;
  };
}
function c(A, B2) {
  return (a2, n2) => {
    let e2 = null;
    for (const t2 of A) {
      const A2 = t2(a2, n2);
      if (A2.success)
        return A2;
      if (e2 === null || A2.offset > e2.offset ? e2 = A2 : A2.offset === e2.offset && B2 === void 0 && (e2.expected = e2.expected.concat(A2.expected)), A2.fatal)
        return A2;
    }
    return B2 = B2 || (e2 == null ? void 0 : e2.expected) || [], e2 && (e2.expected = B2), e2 || H(n2, B2);
  };
}
function D(A) {
  return (B2, a2) => {
    const n2 = A(B2, a2);
    return n2.success || n2.fatal ? n2 : o(a2, null);
  };
}
function m(A) {
  return (B2, a2) => {
    let n2 = [], e2 = a2;
    for (; ; ) {
      const a3 = A(B2, e2);
      if (!a3.success) {
        if (a3.fatal)
          return a3;
        break;
      }
      if (n2.push(a3.value), a3.offset === e2)
        break;
      e2 = a3.offset;
    }
    return o(e2, n2);
  };
}
function I(A, B2, a2) {
  return (n2, e2) => {
    const t2 = A(n2, e2);
    if (!t2.success)
      return t2;
    const G2 = B2(n2, t2.offset);
    return G2.success ? o(G2.offset, a2(t2.value, G2.value)) : G2;
  };
}
function d(A) {
  return I(A, m(A), (A2, B2) => [A2].concat(B2));
}
function h(A, B2) {
  return A;
}
function p(A, B2) {
  return B2;
}
function T(A, B2) {
  return I(A, B2, p);
}
function F(A, B2) {
  return I(A, B2, h);
}
function E(A, B2, a2, n2 = false) {
  return T(A, n2 ? f(F(B2, a2)) : F(B2, a2));
}
function g(A, B2) {
  return (a2, n2) => A(a2, n2).success ? H(n2, B2) : l(n2);
}
function f(A) {
  return (B2, a2) => {
    const n2 = A(B2, a2);
    return n2.success ? n2 : H(n2.offset, n2.expected, true);
  };
}
const P = (A, B2) => A.length === B2 ? l(B2) : H(B2, ["end of input"]);
const M = ["Lu", "Ll", "Lt", "Lm", "Lo", "Mn", "Mc", "Me", "Nd", "Nl", "No", "Pc", "Pd", "Ps", "Pe", "Pi", "Pf", "Po", "Zs", "Zl", "Zp", "Sm", "Sc", "Sk", "So", "Cc", "Cf", "Co", "Cn"];
const J = {};
function S(A) {
  return A.codePointAt(0);
}
"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("").forEach((A, B2) => {
  J[A] = B2;
});
const K = (A) => A === -1 || A === -2;
function b(A) {
  return (B2) => !K(B2) && !A(B2);
}
function y(A, B2) {
  return B2 === null ? A : (a2) => A(a2) && !B2(a2);
}
const Q = function(A, B2) {
  const n2 = new Map();
  let e2 = 0;
  return A.forEach((A2, G2) => {
    const i2 = B2[G2];
    A2 !== null && A2.split("|").forEach((A3) => {
      const B3 = n2.get(A3), G3 = a(e2, e2 + i2 - 1);
      n2.set(A3, B3 ? t(B3, G3) : G3);
    }), e2 += i2;
  }), n2;
}(["BasicLatin", "Latin-1Supplement", "LatinExtended-A", "LatinExtended-B", "IPAExtensions", "SpacingModifierLetters", "CombiningDiacriticalMarks", "GreekandCoptic|Greek", "Cyrillic", "CyrillicSupplement", "Armenian", "Hebrew", "Arabic", "Syriac", "ArabicSupplement", "Thaana", "NKo", "Samaritan", "Mandaic", "SyriacSupplement", "ArabicExtended-B", "ArabicExtended-A", "Devanagari", "Bengali", "Gurmukhi", "Gujarati", "Oriya", "Tamil", "Telugu", "Kannada", "Malayalam", "Sinhala", "Thai", "Lao", "Tibetan", "Myanmar", "Georgian", "HangulJamo", "Ethiopic", "EthiopicSupplement", "Cherokee", "UnifiedCanadianAboriginalSyllabics", "Ogham", "Runic", "Tagalog", "Hanunoo", "Buhid", "Tagbanwa", "Khmer", "Mongolian", "UnifiedCanadianAboriginalSyllabicsExtended", "Limbu", "TaiLe", "NewTaiLue", "KhmerSymbols", "Buginese", "TaiTham", "CombiningDiacriticalMarksExtended", "Balinese", "Sundanese", "Batak", "Lepcha", "OlChiki", "CyrillicExtended-C", "GeorgianExtended", "SundaneseSupplement", "VedicExtensions", "PhoneticExtensions", "PhoneticExtensionsSupplement", "CombiningDiacriticalMarksSupplement", "LatinExtendedAdditional", "GreekExtended", "GeneralPunctuation", "SuperscriptsandSubscripts", "CurrencySymbols", "CombiningDiacriticalMarksforSymbols|CombiningMarksforSymbols", "LetterlikeSymbols", "NumberForms", "Arrows", "MathematicalOperators", "MiscellaneousTechnical", "ControlPictures", "OpticalCharacterRecognition", "EnclosedAlphanumerics", "BoxDrawing", "BlockElements", "GeometricShapes", "MiscellaneousSymbols", "Dingbats", "MiscellaneousMathematicalSymbols-A", "SupplementalArrows-A", "BraillePatterns", "SupplementalArrows-B", "MiscellaneousMathematicalSymbols-B", "SupplementalMathematicalOperators", "MiscellaneousSymbolsandArrows", "Glagolitic", "LatinExtended-C", "Coptic", "GeorgianSupplement", "Tifinagh", "EthiopicExtended", "CyrillicExtended-A", "SupplementalPunctuation", "CJKRadicalsSupplement", "KangxiRadicals", null, "IdeographicDescriptionCharacters", "CJKSymbolsandPunctuation", "Hiragana", "Katakana", "Bopomofo", "HangulCompatibilityJamo", "Kanbun", "BopomofoExtended", "CJKStrokes", "KatakanaPhoneticExtensions", "EnclosedCJKLettersandMonths", "CJKCompatibility", "CJKUnifiedIdeographsExtensionA", "YijingHexagramSymbols", "CJKUnifiedIdeographs", "YiSyllables", "YiRadicals", "Lisu", "Vai", "CyrillicExtended-B", "Bamum", "ModifierToneLetters", "LatinExtended-D", "SylotiNagri", "CommonIndicNumberForms", "Phags-pa", "Saurashtra", "DevanagariExtended", "KayahLi", "Rejang", "HangulJamoExtended-A", "Javanese", "MyanmarExtended-B", "Cham", "MyanmarExtended-A", "TaiViet", "MeeteiMayekExtensions", "EthiopicExtended-A", "LatinExtended-E", "CherokeeSupplement", "MeeteiMayek", "HangulSyllables", "HangulJamoExtended-B", "HighSurrogates", "HighPrivateUseSurrogates", "LowSurrogates", "PrivateUseArea|PrivateUse", "CJKCompatibilityIdeographs", "AlphabeticPresentationForms", "ArabicPresentationForms-A", "VariationSelectors", "VerticalForms", "CombiningHalfMarks", "CJKCompatibilityForms", "SmallFormVariants", "ArabicPresentationForms-B", "HalfwidthandFullwidthForms", "Specials", "LinearBSyllabary", "LinearBIdeograms", "AegeanNumbers", "AncientGreekNumbers", "AncientSymbols", "PhaistosDisc", null, "Lycian", "Carian", "CopticEpactNumbers", "OldItalic", "Gothic", "OldPermic", "Ugaritic", "OldPersian", null, "Deseret", "Shavian", "Osmanya", "Osage", "Elbasan", "CaucasianAlbanian", "Vithkuqi", null, "LinearA", "LatinExtended-F", null, "CypriotSyllabary", "ImperialAramaic", "Palmyrene", "Nabataean", null, "Hatran", "Phoenician", "Lydian", null, "MeroiticHieroglyphs", "MeroiticCursive", "Kharoshthi", "OldSouthArabian", "OldNorthArabian", null, "Manichaean", "Avestan", "InscriptionalParthian", "InscriptionalPahlavi", "PsalterPahlavi", null, "OldTurkic", null, "OldHungarian", "HanifiRohingya", null, "RumiNumeralSymbols", "Yezidi", "ArabicExtended-C", "OldSogdian", "Sogdian", "OldUyghur", "Chorasmian", "Elymaic", "Brahmi", "Kaithi", "SoraSompeng", "Chakma", "Mahajani", "Sharada", "SinhalaArchaicNumbers", "Khojki", null, "Multani", "Khudawadi", "Grantha", null, "Newa", "Tirhuta", null, "Siddham", "Modi", "MongolianSupplement", "Takri", null, "Ahom", null, "Dogra", null, "WarangCiti", "DivesAkuru", null, "Nandinagari", "ZanabazarSquare", "Soyombo", "UnifiedCanadianAboriginalSyllabicsExtended-A", "PauCinHau", "DevanagariExtended-A", null, "Bhaiksuki", "Marchen", null, "MasaramGondi", "GunjalaGondi", null, "Makasar", "Kawi", null, "LisuSupplement", "TamilSupplement", "Cuneiform", "CuneiformNumbersandPunctuation", "EarlyDynasticCuneiform", null, "Cypro-Minoan", "EgyptianHieroglyphs", "EgyptianHieroglyphFormatControls", null, "AnatolianHieroglyphs", null, "BamumSupplement", "Mro", "Tangsa", "BassaVah", "PahawhHmong", null, "Medefaidrin", null, "Miao", null, "IdeographicSymbolsandPunctuation", "Tangut", "TangutComponents", "KhitanSmallScript", "TangutSupplement", null, "KanaExtended-B", "KanaSupplement", "KanaExtended-A", "SmallKanaExtension", "Nushu", null, "Duployan", "ShorthandFormatControls", null, "ZnamennyMusicalNotation", null, "ByzantineMusicalSymbols", "MusicalSymbols", "AncientGreekMusicalNotation", null, "KaktovikNumerals", "MayanNumerals", "TaiXuanJingSymbols", "CountingRodNumerals", null, "MathematicalAlphanumericSymbols", "SuttonSignWriting", null, "LatinExtended-G", "GlagoliticSupplement", "CyrillicExtended-D", null, "NyiakengPuachueHmong", null, "Toto", "Wancho", null, "NagMundari", null, "EthiopicExtended-B", "MendeKikakui", null, "Adlam", null, "IndicSiyaqNumbers", null, "OttomanSiyaqNumbers", null, "ArabicMathematicalAlphabeticSymbols", null, "MahjongTiles", "DominoTiles", "PlayingCards", "EnclosedAlphanumericSupplement", "EnclosedIdeographicSupplement", "MiscellaneousSymbolsandPictographs", "Emoticons", "OrnamentalDingbats", "TransportandMapSymbols", "AlchemicalSymbols", "GeometricShapesExtended", "SupplementalArrows-C", "SupplementalSymbolsandPictographs", "ChessSymbols", "SymbolsandPictographsExtended-A", "SymbolsforLegacyComputing", null, "CJKUnifiedIdeographsExtensionB", null, "CJKUnifiedIdeographsExtensionC", "CJKUnifiedIdeographsExtensionD", "CJKUnifiedIdeographsExtensionE", "CJKUnifiedIdeographsExtensionF", null, "CJKCompatibilityIdeographsSupplement", null, "CJKUnifiedIdeographsExtensionG", "CJKUnifiedIdeographsExtensionH", null, "Tags", null, "VariationSelectorsSupplement", null, "SupplementaryPrivateUseArea-A|PrivateUse", "SupplementaryPrivateUseArea-B|PrivateUse"], [128, 128, 128, 208, 96, 80, 112, 144, 256, 48, 96, 112, 256, 80, 48, 64, 64, 64, 32, 16, 48, 96, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 256, 160, 96, 256, 384, 32, 96, 640, 32, 96, 32, 32, 32, 32, 128, 176, 80, 80, 48, 96, 32, 32, 144, 80, 128, 64, 64, 80, 48, 16, 48, 16, 48, 128, 64, 64, 256, 256, 112, 48, 48, 48, 80, 64, 112, 256, 256, 64, 32, 160, 128, 32, 96, 256, 192, 48, 16, 256, 128, 128, 256, 256, 96, 32, 128, 48, 80, 96, 32, 128, 128, 224, 16, 16, 64, 96, 96, 48, 96, 16, 32, 48, 16, 256, 256, 6592, 64, 20992, 1168, 64, 48, 320, 96, 96, 32, 224, 48, 16, 64, 96, 32, 48, 48, 32, 96, 32, 96, 32, 96, 32, 48, 64, 80, 64, 11184, 80, 896, 128, 1024, 6400, 512, 80, 688, 16, 16, 16, 32, 32, 144, 240, 16, 128, 128, 64, 80, 64, 48, 128, 32, 64, 32, 48, 32, 48, 32, 64, 32, 80, 48, 48, 80, 48, 64, 80, 64, 384, 64, 64, 64, 32, 32, 48, 48, 32, 32, 32, 64, 32, 96, 96, 32, 32, 32, 64, 64, 32, 32, 48, 80, 80, 48, 128, 64, 288, 32, 64, 64, 48, 64, 64, 48, 32, 128, 80, 48, 80, 48, 96, 32, 80, 48, 48, 80, 128, 128, 128, 96, 160, 128, 96, 32, 80, 48, 80, 176, 80, 80, 96, 96, 64, 96, 80, 96, 16, 64, 96, 160, 112, 80, 64, 96, 80, 304, 32, 96, 80, 16, 64, 1024, 128, 208, 2624, 112, 1072, 48, 4e3, 640, 8576, 576, 48, 96, 48, 144, 688, 96, 96, 160, 64, 32, 6144, 768, 512, 128, 8816, 16, 256, 48, 64, 400, 2304, 160, 16, 4688, 208, 48, 256, 256, 80, 112, 32, 32, 96, 32, 128, 1024, 688, 1104, 256, 48, 96, 112, 80, 320, 48, 64, 464, 48, 736, 32, 224, 32, 96, 784, 80, 64, 80, 176, 256, 256, 48, 112, 96, 256, 256, 768, 80, 48, 128, 128, 128, 256, 256, 112, 144, 256, 1024, 42720, 32, 4160, 224, 5776, 7488, 3088, 544, 1504, 4944, 4192, 711760, 128, 128, 240, 65040, 65536, 65536]), x = function(A) {
  const n2 = new Map(), G2 = A.split(""), i2 = M.map(() => []);
  let r2 = 0, o2 = 0;
  for (; o2 < G2.length; ) {
    const A2 = J[G2[o2]], n3 = (31 & A2) - 2;
    let e2 = 1 + J[G2[o2 + 1]];
    switch (32 & A2 ? (e2 += J[G2[o2 + 2]] << 6, e2 += J[G2[o2 + 3]] << 12, e2 += J[G2[o2 + 4]] << 18, o2 += 5) : o2 += 2, n3) {
      case -2: {
        let A3 = 0;
        for (let a2 = r2; a2 < r2 + e2; ++a2) {
          i2[A3].push(B(a2)), A3 = (A3 + 1) % 2;
        }
        break;
      }
      case -1:
        break;
      default: {
        const A3 = i2[n3];
        e2 === 1 ? A3.push(B(r2)) : A3.push(a(r2, r2 + e2 - 1));
        break;
      }
    }
    r2 += e2;
  }
  const l2 = new Map();
  return M.forEach((A2, B2) => {
    const a2 = i2[B2].reduce(t, e);
    n2.set(A2, a2);
    const G3 = A2.charAt(0), r3 = l2.get(G3) || [];
    l2.set(G3, r3), r3.push(a2);
  }), l2.forEach((A2, B2) => {
    n2.set(B2, A2.reduce(t, e));
  }), n2;
}("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");
function L(A) {
  return A === 32 || A === 9 || A === 10 || A === 13;
}
const X = [B(S(":")), a(S("A"), S("Z")), B(S("_")), a(S("a"), S("z")), a(192, 214), a(216, 246), a(192, 214), a(216, 246), a(248, 767), a(880, 893), a(895, 8191), a(8204, 8205), a(8304, 8591), a(11264, 12271), a(12289, 55295), a(63744, 64975), a(65008, 65533), a(65536, 983039)].reduce(t), Z = [X, B(S("-")), B(S(".")), a(S("0"), S("9")), B(183), a(768, 879), a(8255, 8256)].reduce(t), O = x.get("Nd"), k = b(O), N = y(a(0, 1114111), [x.get("P"), x.get("Z"), x.get("C")].reduce(t)), v = b(N);
function w(A) {
  return A !== 10 && A !== 13 && !K(A);
}
const Y = {s: L, S: b(L), i: X, I: b(X), c: Z, C: b(Z), d: O, D: k, w: N, W: v}, U = C("*"), j = C("\\"), R = C("{"), V = C("}"), W = C("["), q = C("]"), z = C("^"), $ = C("$"), _ = C(","), AA = C("-"), BA = C("("), aA = C(")"), nA = C("."), eA = C("|"), tA = C("+"), GA = C("?"), iA = C("-["), rA = S("0");
function oA(A) {
  function e2(A2) {
    return new Set(A2.split("").map((A3) => S(A3)));
  }
  function G2(A2, B2) {
    const a2 = A2.codePointAt(B2);
    return a2 === void 0 ? H(B2, ["any character"]) : o(B2 + String.fromCodePoint(a2).length, a2);
  }
  const i2 = A.language === "xpath" ? T(j, c([u(C("n"), () => 10), u(C("r"), () => 13), u(C("t"), () => 9), u(c([j, eA, nA, AA, z, GA, U, tA, R, V, $, BA, aA, W, q]), (A2) => S(A2))])) : T(j, c([u(C("n"), () => 10), u(C("r"), () => 13), u(C("t"), () => 9), u(c([j, eA, nA, AA, z, GA, U, tA, R, V, BA, aA, W, q]), (A2) => S(A2))]));
  function r2(A2, B2) {
    const a2 = e2(B2);
    return I(C(A2), D(s(G2, (A3) => a2.has(A3), B2.split(""))), (A3, B3) => function(A4) {
      const B4 = x.get(A4);
      if (B4 == null)
        throw new Error(A4 + " is not a valid unicode category");
      return B4;
    }(B3 === null ? A3 : A3 + String.fromCodePoint(B3)));
  }
  const l2 = c([r2("L", "ultmo"), r2("M", "nce"), r2("N", "dlo"), r2("P", "cdseifo"), r2("Z", "slp"), r2("S", "mcko"), r2("C", "cfon")]), p2 = [a(S("a"), S("z")), a(S("A"), S("Z")), a(S("0"), S("9")), B(45)].reduce(t), M2 = c([l2, u(T(C("Is"), function(A2) {
    return (B2, a2) => {
      const n2 = A2(B2, a2);
      return n2.success ? o(n2.offset, B2.slice(a2, n2.offset)) : n2;
    };
  }(d(s(G2, p2, ["block identifier"])))), (B2) => function(A2, B3) {
    const a2 = Q.get(A2);
    if (a2 === void 0) {
      if (B3)
        return n;
      throw new Error(`The unicode block identifier "${A2}" is not known.`);
    }
    return a2;
  }(B2, A.language !== "xpath"))]), J2 = E(C("\\p{"), M2, V, true), K2 = u(E(C("\\P{"), M2, V, true), b), L2 = T(j, u(c("sSiIcCdDwW".split("").map((A2) => C(A2))), (A2) => Y[A2])), X2 = u(nA, () => w), Z2 = c([L2, J2, K2]), O2 = e2("\\[]"), k2 = c([i2, s(G2, (A2) => !O2.has(A2), ["unescaped character"])]), N2 = c([u(AA, () => null), k2]), v2 = I(N2, T(AA, N2), a);
  function oA2(A2, B2) {
    return [A2].concat(B2 || []);
  }
  const lA2 = u(function(A2) {
    return (B2, a2) => {
      const n2 = A2(B2, a2);
      return n2.success ? o(a2, n2.value) : n2;
    };
  }(c([q, iA])), () => null), HA2 = S("-"), CA = c([u(F(F(AA, g(W, ["not ["])), lA2), () => HA2), T(g(AA, ["not -"]), k2)]), uA = c([I(u(CA, B), c([function(A2, B2) {
    return uA(A2, B2);
  }, lA2]), oA2), I(c([v2, Z2]), c([cA, lA2]), oA2)]);
  const sA = c([I(u(k2, B), c([uA, lA2]), oA2), I(c([v2, Z2]), c([cA, lA2]), oA2)]);
  function cA(A2, B2) {
    return sA(A2, B2);
  }
  const DA = u(sA, (A2) => A2.reduce(t)), mA = u(T(z, DA), b), IA = I(c([T(g(z, ["not ^"]), DA), mA]), D(T(AA, function(A2, B2) {
    return dA(A2, B2);
  })), y), dA = E(W, IA, q, true);
  const hA = A.language === "xpath" ? c([u(i2, B), Z2, dA, X2, u(z, () => (A2) => A2 === -1), u($, () => (A2) => A2 === -2)]) : c([u(i2, B), Z2, dA, X2]), pA = A.language === "xpath" ? e2(".\\?*+{}()|^$[]") : e2(".\\?*+{}()|[]"), TA = s(G2, (A2) => !pA.has(A2), ["NormalChar"]), FA = u(T(j, I(u(s(G2, a(S("1"), S("9")), ["digit"]), (A2) => A2 - rA), m(u(s(G2, a(rA, S("9")), ["digit"]), (A2) => A2 - rA)), (A2, B2) => {
    B2.reduce((A3, B3) => 10 * A3 + B3, A2);
  })), (A2) => {
    throw new Error("Backreferences in XPath patterns are not yet implemented.");
  }), EA = A.language === "xpath" ? c([u(TA, (A2) => ({kind: "predicate", value: B(A2)})), u(hA, (A2) => ({kind: "predicate", value: A2})), u(E(BA, T(D(C("?:")), SA), aA, true), (A2) => ({kind: "regexp", value: A2})), FA]) : c([u(TA, (A2) => ({kind: "predicate", value: B(A2)})), u(hA, (A2) => ({kind: "predicate", value: A2})), u(E(BA, SA, aA, true), (A2) => ({kind: "regexp", value: A2}))]), gA = u(d(u(s(G2, a(rA, S("9")), ["digit"]), (A2) => A2 - rA)), (A2) => A2.reduce((A3, B2) => 10 * A3 + B2)), fA = c([I(gA, T(_, gA), (A2, B2) => {
    if (B2 < A2)
      throw new Error("quantifier range is in the wrong order");
    return {min: A2, max: B2};
  }), I(gA, _, (A2) => ({min: A2, max: null})), u(gA, (A2) => ({min: A2, max: A2}))]), PA = A.language === "xpath" ? I(c([u(GA, () => ({min: 0, max: 1})), u(U, () => ({min: 0, max: null})), u(tA, () => ({min: 1, max: null})), E(R, fA, V, true)]), D(GA), (A2, B2) => A2) : c([u(GA, () => ({min: 0, max: 1})), u(U, () => ({min: 0, max: null})), u(tA, () => ({min: 1, max: null})), E(R, fA, V, true)]), MA = m(I(EA, u(D(PA), (A2) => A2 === null ? {min: 1, max: 1} : A2), (A2, B2) => [A2, B2])), JA = I(MA, m(T(eA, f(MA))), (A2, B2) => [A2].concat(B2));
  function SA(A2, B2) {
    return JA(A2, B2);
  }
  const KA = function(A2) {
    return I(A2, P, h);
  }(JA);
  return function(A2) {
    let B2;
    try {
      B2 = KA(A2, 0);
    } catch (B3) {
      throw new Error(`Error parsing pattern "${A2}": ${B3 instanceof Error ? B3.message : B3}`);
    }
    return B2.success ? B2.value : function(A3, B3, a2) {
      const n2 = a2.map((A4) => `"${A4}"`);
      throw new Error(`Error parsing pattern "${A3}" at offset ${B3}: expected ${n2.length > 1 ? "one of " + n2.join(", ") : n2[0]} but found "${A3.slice(B3, B3 + 1)}"`);
    }(A2, B2.offset, B2.expected);
  };
}
function lA(A) {
  return [...A].map((A2) => A2.codePointAt(0));
}
function HA(B2, a2 = {language: "xsd"}) {
  const n2 = oA(a2)(B2), e2 = compileVM((A) => {
    r(A, n2, a2.language === "xpath"), A.accept();
  });
  return function(A) {
    const B3 = a2.language === "xpath" ? [-1, ...lA(A), -2] : lA(A);
    return e2.execute(B3).success;
  };
}
export {HA as compile};
export default null;
