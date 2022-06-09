class Token {
  constructor(value, type) {
    this._value = value;
    this._type = type;
    this._format = "";
  }
  get value() {
    return this._value;
  }
  set value(value) {
    this._value = value;
  }
  get type() {
    return this._type;
  }
  set type(type) {
    this._type = type;
  }
  get format() {
    return this._format;
  }
  set format(format) {
    this._format = format;
  }
}
class Parser {
  constructor(name, pattern) {
    this.name = name;
    this.pattern = pattern;
  }
  parse(date) {
    const match = this.pattern.exec(date);
    if (!match || !match.groups) {
      return;
    }
    let tokens = [];
    for (const [key, val] of Object.entries(match.groups)) {
      if (val) {
        tokens.push(new Token(val, /delim\d+/.test(key) ? "delimiter" : key));
      }
    }
    return {
      tokens,
      index: match.index,
      parser: this.name
    };
  }
}
const abbreviatedTimezones = "UT|CAT|CET|CVT|EAT|EET|GMT|MUT|RET|SAST|SCT|WAST|WAT|WEST|WET|WST|WT|ADT|AFT|ALMT|AMST|AMT|ANAST|ANAT|AQTT|AST|AZST|AZT|BNT|BST|BTT|CHOST|CHOT|CST|EEST|EET|GET|GST|HKT|HOVST|HOVT|ICT|IDT|IRDT|IRKST|IRKT|IST|JST|KGT|KRAST|KRAT|KST|MAGST|MAGT|MMT|MSK|MVT|NOVST|NOVT|NPT|OMSST|OMST|ORAT|PETST|PETT|PHT|PKT|PYT|QYZT|SAKT|SGT|SRET|TJT|TLT|TMT|TRT|ULAST|ULAT|UZT|VLAST|VLAT|WIB|WIT|YAKST|YAKT|YEKST|YEKT|ART|CAST|CEST|CLST|CLT|DAVT|DDUT|GMT|MAWT|NZDT|NZST|ROTT|SYOT|VOST|ADT|AST|AT|AZOST|AZOT|ACDT|ACST|ACT|ACWST|AEDT|AEST|AET|AWDT|AWST|CXT|LHDT|LHST|NFDT|NFT|AST|AT|CDT|CIDST|CIST|CST|EDT|EST|ET|CST|CT|EST|ET|BST|CEST|CET|EEST|EET|FET|GET|GMT|IST|KUYT|MSD|MSK|SAMT|TRT|WEST|WET|CCT|EAT|IOT|TFT|ADT|AKDT|AKST|AST|AT|CDT|CST|CT|EDT|EGST|EGT|ET|GMT|HDT|HST|MDT|MST|MT|NDT|NST|PDT|PMDT|PMST|PST|PT|WGST|WGT|AoE|BST|CHADT|CHAST|CHUT|CKT|ChST|EASST|EAST|FJST|FJT|GALT|GAMT|GILT|HST|KOST|LINT|MART|MHT|NCT|NRT|NUT|NZDT|NZST|PGT|PHOT|PONT|PST|PWT|SBT|SST|TAHT|TKT|TOST|TOT|TVT|VUT|WAKT|WFT|WST|YAPT|ACT|AMST|AMT|ART|BOT|BRST|BRT|CLST|CLT|COT|ECT|FKST|FKT|FNT|GFT|GST|GYT|PET|PYST|PYT|SRT|UYST|UYT|VET|WARST";
const dayOfMonthAndMonthNameDateFormatParser = new Parser("DayOfMonthAndMonthNameDateFormatParser", new RegExp(`^(?<dayOfWeek>(?:Sun?|Mon?|Tu(?:es)?|We(?:dnes)?|Th(?:urs)?|Fri?|Sa(?:tur)?)(?:day)?)?(?<delim1>,)?(?<delim2>\\s)?(?<dayOfMonth>(?:3[0-1]|[1-2]\\d|0?[1-9])(?:st|nd|rd|th)?)(?<delim3>\\s)(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?<delim4>,)?(?<delim5>\\s)?(?<year>\\d{4}|\\d{2})?(?:(?<delim6>,)?(?<delim7>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim8>[:.])(?<minute>[0-5]\\d))?(?:(?<delim9>[:.])(?<second>[0-5]\\d))?(?:(?<delim10>.)(?<millisecond>\\d{3}))?(?<delim11>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim12>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?$`));
const iSO8601BasicDateTimeFormatParser = new Parser("ISO8601BasicDateTimeFormatParser", new RegExp("^(?<year>[+-]\\d{6}|\\d{4})(?:(?<month>\\d{2})(?:(?<dayOfMonth>\\d{2}))?|(?<escapeText>W)(?<isoWeekOfYear>\\d{2})(?:(?<isoDayOfWeek>\\d))?|(?<dayOfYear>\\d{3}))?(?:(?<delim1>T| )(?:(?<twentyFourHour>\\d{2})(?:(?<minute>\\d{2})(?:(?<second>\\d{2})(?:(?<delim2>[.,])(?<millisecond>\\d{1,9}))?)?)?)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z)?)?$"));
const iSO8601ExtendedDateTimeFormatParser = new Parser("ISO8601ExtendedDateTimeFormatParser", new RegExp("^(?<year>[+-]\\d{6}|\\d{4})(?<delim1>\\-)(?:(?<month>\\d{2})(?:(?<delim2>\\-)(?<dayOfMonth>\\d{2}))?|(?<escapeText>W)(?<isoWeekOfYear>\\d{2})(?:(?<delim3>\\-)(?<isoDayOfWeek>\\d))?|(?<dayOfYear>\\d{3}))(?:(?<delim4>T| )(?:(?<twentyFourHour>\\d{2})(?:(?<delim5>:)(?<minute>\\d{2})(?:(?<delim6>:)(?<second>\\d{2})(?:(?<delim7>[.,])(?<millisecond>\\d{1,9}))?)?)?)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z)?)?$"));
const monthNameAndDayOfMonthDateFormatParser = new Parser("MonthNameAndDayOfMonthDateFormatParser", new RegExp(`^(?<dayOfWeek>(?:Sun?|Mon?|Tu(?:es)?|We(?:dnes)?|Th(?:urs)?|Fri?|Sa(?:tur)?)(?:day)?)?(?<delim1>,)?(?<delim2>\\s)?(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?<delim3>\\s)(?<dayOfMonth>(?:3[0-1]|[1-2]\\d|0?[1-9])(?:st|nd|rd|th)?)(?<delim4>,)?(?<delim5>\\s)?(?<year>\\d{4}|\\d{2})?(?:(?:(?<delim6>,)?(?<delim7>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim8>[:.])(?<minute>[0-5]\\d))?(?:(?<delim9>[:.])(?<second>[0-5]\\d))?(?:(?<delim10>.)(?<millisecond>\\d{3}))?(?<delim11>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim12>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?)?$`));
const rFC2822DateTimeFormatParser = new Parser("RFC2822DateTimeFormatParser", new RegExp("^(?:(?<dayOfWeek>Mon|Tue|Wed|Thu|Fri|Sat|Sun)(?<delim1>,)?(?<delim2>\\s))?(?<dayOfMonth>\\d{1,2})(?<delim3>\\s)(?<month>Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?<delim4>\\s)(?<year>\\d{2,4})(?<delim5>\\s)(?<twentyFourHour>\\d{2})(?<delim6>:)(?<minute>\\d{2})(?:(?<delim7>:)(?<second>\\d{2}))?(?<delim8>\\s)(?<timezone>(?:(?:UT|GMT|[ECMP][SD]T)|[Zz]|[+-]\\d{4}))$"));
const slashDelimitedDateTimeFormatParser = new Parser("SlashDelimitedDateFormatParser", new RegExp(`^(?<year>\\d{4}|\\d{2})(?<delim1>[/.-])(?<month>0?[1-9]|1[0-2])(?:(?<delim2>[/.-])(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1]))?(?:(?:(?<delim3>,)?(?<delim4>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim5>[:.])(?<minute>[0-5]\\d))?(?:(?<delim6>[:.])(?<second>[0-5]\\d))?(?:(?<delim7>.)(?<millisecond>\\d{3}))?(?<delim8>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim9>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?)?$`));
const twelveHourTimeFormatParser = new Parser("TwelveHourTimeFormatParser", new RegExp(`^(?<twelveHour>0?[1-9]|1[0-2])(?:(?<delim1>[:.])(?<minute>[0-5]\\d))?(?:(?<delim2>[:.])(?<second>[0-5]\\d))?(?:(?<delim3>.)(?<millisecond>\\d{3}))?(?<delim4>\\s)?(?<meridiem>am|pm|AM|PM)(?:(?<delim5>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?$`));
const twentyFourHourTimeFormatParser = new Parser("TwentyFourHourTimeFormatParser", new RegExp(`^(?<twentyFourHour>2[0-3]|0?\\d|1\\d)(?<delim1>[:.])(?<minute>[0-5]\\d)(?:(?<delim2>[:.])(?<second>[0-5]\\d))?(?:(?<delim3>.)(?<millisecond>\\d{3}))?(?:(?<delim4>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?$`));
const uKStyleSlashDelimitedDateTimeFormatParser = new Parser("UKStyleSlashDelimitedDateFormatParser", new RegExp(`^(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])(?<delim1>[/.-])(?<month>0?[1-9]|1[0-2])(?:(?<delim2>[/.-])(?<year>\\d{4}|\\d{2}))?(?:(?:(?<delim3>,)?(?<delim4>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim5>[:.])(?<minute>[0-5]\\d))?(?:(?<delim6>[:.])(?<second>[0-5]\\d))?(?:(?<delim7>.)(?<millisecond>\\d{3}))?(?<delim8>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim9>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?)?$`));
const uSStyleSlashDelimitedDateTimeFormatParser = new Parser("USStyleSlashDelimitedDateFormatParser", new RegExp(`^(?<month>0?[1-9]|1[0-2])(?<delim1>[/.-])(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])(?:(?<delim2>[/.-])(?<year>\\d{4}|\\d{2}))?(?:(?:(?<delim3>,)?(?<delim4>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim5>[:.])(?<minute>[0-5]\\d))?(?:(?<delim6>[:.])(?<second>[0-5]\\d))?(?:(?<delim7>.)(?<millisecond>\\d{3}))?(?<delim8>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim9>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?)?$`));
const dashDelimitedWithMonthNameDateTimeFormatParser = new Parser("DashDelimitedWithMonthNameDateTimeFormatParser", new RegExp(`^(?<dayOfMonth>0?[1-9]|[1-2]\\d|3[0-1])(?<delim1>-)(?<month>Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?<delim2>-)?(?<year>\\d{4}|\\d{2})?(?:(?:(?<delim3>,)?(?<delim4>\\s)(?:(?<twentyFourHour>2[0-3]|0?\\d|1\\d)|(?<twelveHour>0?[1-9]|1[0-2]))(?:(?<delim5>[:.])(?<minute>[0-5]\\d))?(?:(?<delim6>[:.])(?<second>[0-5]\\d))?(?:(?<delim7>.)(?<millisecond>\\d{3}))?(?<delim8>\\s)?(?<meridiem>am|pm|AM|PM)?(?:(?<delim9>\\s)(?<timezone>[+-]\\d{2}(?::?\\d{2})?|Z|${abbreviatedTimezones}))?)?)?$`));
const parsers = [
  iSO8601ExtendedDateTimeFormatParser,
  iSO8601BasicDateTimeFormatParser,
  rFC2822DateTimeFormatParser,
  slashDelimitedDateTimeFormatParser,
  uKStyleSlashDelimitedDateTimeFormatParser,
  uSStyleSlashDelimitedDateTimeFormatParser,
  monthNameAndDayOfMonthDateFormatParser,
  dayOfMonthAndMonthNameDateFormatParser,
  twentyFourHourTimeFormatParser,
  twelveHourTimeFormatParser,
  dashDelimitedWithMonthNameDateTimeFormatParser
];
class StandardFormatParsersRefiner {
  constructor(name) {
    this.name = name;
  }
  refine(parsedResults) {
    const res = parsedResults.filter((r) => {
      return r.parser === "ISO8601ExtendedDateTimeFormatParser" || r.parser === "ISO8601BasicDateTimeFormatParser" || r.parser === "RFC2822DateTimeFormatParser";
    });
    if (res.length === 0) {
      return parsedResults;
    }
    return res;
  }
}
class TimeFormatRefiner {
  constructor(name) {
    this.name = name;
  }
  refine(parsedResults) {
    parsedResults.forEach((r) => {
      let meridiemExists = false;
      r.tokens.forEach((t) => {
        if (t.type === "meridiem") {
          meridiemExists = true;
        }
      });
      if (meridiemExists) {
        r.tokens.forEach((t) => {
          if (t.type === "twentyFourHour") {
            t.type = "twelveHour";
          }
        });
      }
    });
    return parsedResults;
  }
}
const timeFormatRefiner = new TimeFormatRefiner("TimeFormatRefiner");
const standardFormatParsersRefiner = new StandardFormatParsersRefiner("StandardFormatParsersRefiner");
const refiners = [
  standardFormatParsersRefiner,
  timeFormatRefiner
];
class YearFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{2}/, "YY");
      this._map.set(/\d{4}/, "YYYY");
      this._map.set(/[+-]\d{6}/, "YYYYYY");
    } else {
      this._map.set(/\d{2}/, "%y");
      this._map.set(/\d{4}/, "%Y");
      this._map.set(/[+-]\d{6}/, "NA");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class MonthFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,2}/, "M");
      this._map.set(/\d{2}/, "MM");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "Mo");
      this._map.set(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, "MMM");
      this._map.set(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, "MMMM");
    } else {
      this._map.set(/\d{1,2}/, "NA");
      this._map.set(/\d{2}/, "%m");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "NA");
      this._map.set(/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/, "%b");
      this._map.set(/^(January|February|March|April|May|June|July|August|September|October|November|December)$/, "%B");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class DayOfMonthFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,2}/, "D");
      this._map.set(/\d{2}/, "DD");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "Do");
    } else {
      this._map.set(/\d{1,2}/, "%-e");
      this._map.set(/\d{2}/, "%d");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "%o");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class DelimiterFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.format = format;
    this.type = type;
  }
  assign(token) {
  }
}
class MinuteFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,2}/, "m");
      this._map.set(/\d{2}/, "mm");
    } else {
      this._map.set(/\d{1,2}/, "NA");
      this._map.set(/\d{2}/, "%M");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class SecondFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,2}/, "s");
      this._map.set(/\d{2}/, "ss");
    } else {
      this._map.set(/\d{1,2}/, "NA");
      this._map.set(/\d{2}/, "%S");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class MillisecondFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d/, "S");
      this._map.set(/\d{2}/, "SS");
      this._map.set(/\d{3}/, "SSS");
    } else {
      this._map.set(/\d/, "NA");
      this._map.set(/\d{2}/, "NA");
      this._map.set(/\d{3}/, "%L");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class TimezoneFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    const abbreviatedTimezoneRegex = new RegExp("UT|CAT|CET|CVT|EAT|EET|GMT|MUT|RET|SAST|SCT|WAST|WAT|WEST|WET|WST|WT|ADT|AFT|ALMT|AMST|AMT|ANAST|ANAT|AQTT|AST|AZST|AZT|BNT|BST|BTT|CHOST|CHOT|CST|EEST|EET|GET|GST|HKT|HOVST|HOVT|ICT|IDT|IRDT|IRKST|IRKT|IST|JST|KGT|KRAST|KRAT|KST|MAGST|MAGT|MMT|MSK|MVT|NOVST|NOVT|NPT|OMSST|OMST|ORAT|PETST|PETT|PHT|PKT|PYT|QYZT|SAKT|SGT|SRET|TJT|TLT|TMT|TRT|ULAST|ULAT|UZT|VLAST|VLAT|WIB|WIT|YAKST|YAKT|YEKST|YEKT|ART|CAST|CEST|CLST|CLT|DAVT|DDUT|GMT|MAWT|NZDT|NZST|ROTT|SYOT|VOST|ADT|AST|AT|AZOST|AZOT|ACDT|ACST|ACT|ACWST|AEDT|AEST|AET|AWDT|AWST|CXT|LHDT|LHST|NFDT|NFT|AST|AT|CDT|CIDST|CIST|CST|EDT|EST|ET|CST|CT|EST|ET|BST|CEST|CET|EEST|EET|FET|GET|GMT|IST|KUYT|MSD|MSK|SAMT|TRT|WEST|WET|CCT|EAT|IOT|TFT|ADT|AKDT|AKST|AST|AT|CDT|CST|CT|EDT|EGST|EGT|ET|GMT|HDT|HST|MDT|MST|MT|NDT|NST|PDT|PMDT|PMST|PST|PT|WGST|WGT|AoE|BST|CHADT|CHAST|CHUT|CKT|ChST|EASST|EAST|FJST|FJT|GALT|GAMT|GILT|HST|KOST|LINT|MART|MHT|NCT|NRT|NUT|NZDT|NZST|PGT|PHOT|PONT|PST|PWT|SBT|SST|TAHT|TKT|TOST|TOT|TVT|VUT|WAKT|WFT|WST|YAPT|ACT|AMST|AMT|ART|BOT|BRST|BRT|CLST|CLT|COT|ECT|FKST|FKT|FNT|GFT|GST|GYT|PET|PYST|PYT|SRT|UYST|UYT|VET|WARST");
    if (!format || format === "default") {
      this._map.set(/[+-]\d{2}(?::\d{2})?/, "Z");
      this._map.set(/[+-]\d{4}/, "ZZ");
      this._map.set(/Z/, "[Z]");
      this._map.set(/z/, "[z]");
      this._map.set(abbreviatedTimezoneRegex, "z");
    } else {
      this._map.set(/[+-]\d{2}(?::\d{2})?/, "%:z");
      this._map.set(/[+-]\d{4}/, "%z");
      this._map.set(/Z/, "Z");
      this._map.set(/z/, "z");
      this._map.set(abbreviatedTimezoneRegex, "%Z");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class DayOfYearFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,3}/, "DDD");
      this._map.set(/\d{3}/, "DDDD");
      this._map.set(/\d{1,3}(?:st|nd|rd|th)/, "DDDo");
    } else {
      this._map.set(/\d{1,3}/, "NA");
      this._map.set(/\d{3}/, "%j");
      this._map.set(/\d{1,3}(?:st|nd|rd|th)/, "NA");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class EscapeTextFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    if (this._testTokenType(token)) {
      token.format = !this.format || this.format === "default" ? `[${token.value}]` : token.value;
    }
  }
}
class ISODayOfWeekFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/[1-7]/, "E");
    } else {
      this._map.set(/[1-7]/, "%u");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class ISOWeekOfYearFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/\d{1,2}/, "W");
      this._map.set(/\d{2}/, "WW");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "Wo");
    } else {
      this._map.set(/\d{1,2}/, "NA");
      this._map.set(/\d{2}/, "%U");
      this._map.set(/\d{1,2}(?:st|nd|rd|th)/, "NA");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class TwentyFourHourFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/^(\d|1\d|2[0-3])$/, "H");
      this._map.set(/^([0-1]\d|2[0-3])$/, "HH");
    } else {
      this._map.set(/^(\d|1\d|2[0-3])$/, "%-k");
      this._map.set(/^([0-1]\d|2[0-3])$/, "%H");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class TwelveHourFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/^([1-9]|1[0-2])$/, "h");
      this._map.set(/^(0\d|1[0-2])$/, "hh");
    } else {
      this._map.set(/^([1-9]|1[0-2])$/, "%-l");
      this._map.set(/^(0\d|1[0-2])$/, "%I");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class DayOfWeekFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/[0-6]/, "d");
      this._map.set(/[0-6](?:st|nd|rd|th)/, "do");
      this._map.set(/(?:Su|Mo|Tu|We|Th|Fr|Sa)/, "dd");
      this._map.set(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/, "ddd");
      this._map.set(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/, "dddd");
    } else {
      this._map.set(/[0-6]/, "%w");
      this._map.set(/[0-6](?:st|nd|rd|th)/, "NA");
      this._map.set(/(?:Su|Mo|Tu|We|Th|Fr|Sa)/, "NA");
      this._map.set(/(?:Sun|Mon|Tue|Wed|Thu|Fri|Sat)/, "%a");
      this._map.set(/(?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)/, "%A");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
class MeridiemFormatTokenAssigner {
  constructor(name, type, format) {
    this.name = name;
    this.type = type;
    this.format = format;
    this._map = new Map();
    if (!format || format === "default") {
      this._map.set(/am|pm/, "a");
      this._map.set(/AM|PM/, "A");
    } else {
      this._map.set(/am|pm/, "%P");
      this._map.set(/AM|PM/, "%p");
    }
  }
  _testTokenType(token) {
    return token.type === this.type;
  }
  assign(token) {
    this._map.forEach((formatToken, pattern) => {
      if (this._testTokenType(token) && pattern.test(token.value)) {
        token.format = formatToken;
      }
    });
  }
}
const dayOfMonthFormatTokenAssigner = new DayOfMonthFormatTokenAssigner("DelimiterFormatTokenAssigner", "dayOfMonth");
const dayOfWeekFormatTokenAssigner = new DayOfWeekFormatTokenAssigner("DayOfWeekFormatTokenAssigner", "dayOfWeek");
const dayOfYearFormatTokenAssigner = new DayOfYearFormatTokenAssigner("DayOfYearFormatTokenAssigner", "dayOfYear");
const delimiterFormatTokenAssigner = new DelimiterFormatTokenAssigner("DelimiterFormatTokenAssigner", "delimiter");
const escapeTextFormatTokenAssigner = new EscapeTextFormatTokenAssigner("EscapeTextFormatTokenAssigner", "escapeText");
const iSODayOfWeekFormatTokenAssigner = new ISODayOfWeekFormatTokenAssigner("ISODayOfWeekFormatTokenAssigner", "isoDayOfWeek");
const iSOWeekOfYearFormatTokenAssigner = new ISOWeekOfYearFormatTokenAssigner("ISOWeekOfYearFormatTokenAssigner", "isoWeekOfYear");
const meridiemFormatTokenAssigner = new MeridiemFormatTokenAssigner("MeridiemFormatTokenAssigner", "meridiem");
const millisecondFormatTokenAssigner = new MillisecondFormatTokenAssigner("MillisecondFormatTokenAssigner", "millisecond");
const minuteFormatTokenAssigner = new MinuteFormatTokenAssigner("MinuteFormatTokenAssigner", "minute");
const monthFormatTokenAssigner = new MonthFormatTokenAssigner("MonthFormatTokenAssigner", "month");
const secondFormatTokenAssigner = new SecondFormatTokenAssigner("SecondFormatTokenAssigner", "second");
const timezoneFormatTokenAssigner = new TimezoneFormatTokenAssigner("TimezoneFormatTokenAssigner", "timezone");
const twelveHourFormatTokenAssigner = new TwelveHourFormatTokenAssigner("TwelveHourFormatTokenAssigner", "twelveHour");
const twentyFourHourFormatTokenAssigner = new TwentyFourHourFormatTokenAssigner("TwentyFourHourFormatTokenAssigner", "twentyFourHour");
const yearFormatTokenAssigner = new YearFormatTokenAssigner("YearFormatTokenAssigner", "year");
const strftimeDayOfMonthFormatTokenAssigner = new DayOfMonthFormatTokenAssigner("DelimiterFormatTokenAssigner", "dayOfMonth", "strftime");
const strftimeDayOfWeekFormatTokenAssigner = new DayOfWeekFormatTokenAssigner("DayOfWeekFormatTokenAssigner", "dayOfWeek", "strftime");
const strftimeDayOfYearFormatTokenAssigner = new DayOfYearFormatTokenAssigner("DayOfYearFormatTokenAssigner", "dayOfYear", "strftime");
const strftimeDelimiterFormatTokenAssigner = new DelimiterFormatTokenAssigner("DelimiterFormatTokenAssigner", "delimiter", "strftime");
const strftimeEscapeTextFormatTokenAssigner = new EscapeTextFormatTokenAssigner("EscapeTextFormatTokenAssigner", "escapeText", "strftime");
const strftimeISODayOfWeekFormatTokenAssigner = new ISODayOfWeekFormatTokenAssigner("ISODayOfWeekFormatTokenAssigner", "isoDayOfWeek", "strftime");
const strftimeISOWeekOfYearFormatTokenAssigner = new ISOWeekOfYearFormatTokenAssigner("ISOWeekOfYearFormatTokenAssigner", "isoWeekOfYear", "strftime");
const strftimeMeridiemFormatTokenAssigner = new MeridiemFormatTokenAssigner("MeridiemFormatTokenAssigner", "meridiem", "strftime");
const strftimeMillisecondFormatTokenAssigner = new MillisecondFormatTokenAssigner("MillisecondFormatTokenAssigner", "millisecond", "strftime");
const strftimeMinuteFormatTokenAssigner = new MinuteFormatTokenAssigner("MinuteFormatTokenAssigner", "minute", "strftime");
const strftimeMonthFormatTokenAssigner = new MonthFormatTokenAssigner("MonthFormatTokenAssigner", "month", "strftime");
const strftimeSecondFormatTokenAssigner = new SecondFormatTokenAssigner("SecondFormatTokenAssigner", "second", "strftime");
const strftimeTimezoneFormatTokenAssigner = new TimezoneFormatTokenAssigner("TimezoneFormatTokenAssigner", "timezone", "strftime");
const strftimeTwelveHourFormatTokenAssigner = new TwelveHourFormatTokenAssigner("TwelveHourFormatTokenAssigner", "twelveHour", "strftime");
const strftimeTwentyFourHourFormatTokenAssigner = new TwentyFourHourFormatTokenAssigner("TwentyFourHourFormatTokenAssigner", "twentyFourHour", "strftime");
const strftimeYearFormatTokenAssigner = new YearFormatTokenAssigner("YearFormatTokenAssigner", "year", "strftime");
const defaultAssigners = [
  yearFormatTokenAssigner,
  monthFormatTokenAssigner,
  dayOfMonthFormatTokenAssigner,
  delimiterFormatTokenAssigner,
  minuteFormatTokenAssigner,
  secondFormatTokenAssigner,
  millisecondFormatTokenAssigner,
  timezoneFormatTokenAssigner,
  dayOfYearFormatTokenAssigner,
  escapeTextFormatTokenAssigner,
  iSODayOfWeekFormatTokenAssigner,
  iSOWeekOfYearFormatTokenAssigner,
  twentyFourHourFormatTokenAssigner,
  twelveHourFormatTokenAssigner,
  dayOfWeekFormatTokenAssigner,
  meridiemFormatTokenAssigner
];
const strftimeAssigners = [
  strftimeDayOfMonthFormatTokenAssigner,
  strftimeDayOfWeekFormatTokenAssigner,
  strftimeDayOfYearFormatTokenAssigner,
  strftimeDelimiterFormatTokenAssigner,
  strftimeEscapeTextFormatTokenAssigner,
  strftimeISODayOfWeekFormatTokenAssigner,
  strftimeISOWeekOfYearFormatTokenAssigner,
  strftimeMeridiemFormatTokenAssigner,
  strftimeMillisecondFormatTokenAssigner,
  strftimeMinuteFormatTokenAssigner,
  strftimeMonthFormatTokenAssigner,
  strftimeSecondFormatTokenAssigner,
  strftimeTimezoneFormatTokenAssigner,
  strftimeTwelveHourFormatTokenAssigner,
  strftimeTwentyFourHourFormatTokenAssigner,
  strftimeYearFormatTokenAssigner
];
class Guesser {
  constructor() {
  }
  static parse(date) {
    const parsedResults = [];
    parsers.forEach((parser) => {
      const parsedResult = parser.parse(date);
      if (parsedResult) {
        parsedResults.push(Object.assign({}, parsedResult));
      }
    });
    return parsedResults;
  }
  static refine(parsedResults) {
    let refinedParsedResults = [...parsedResults];
    refiners.forEach((refiner) => {
      refinedParsedResults = [
        ...refiner.refine(refinedParsedResults)
      ];
    });
    return refinedParsedResults;
  }
  static assign(tokens, format) {
    let assigners = !format || format === "default" ? defaultAssigners : strftimeAssigners;
    assigners.forEach((assigner) => {
      tokens.forEach((token) => {
        assigner.assign(token);
      });
    });
  }
  static getFormatString(tokens) {
    let formatString = "";
    tokens.forEach((token) => {
      if (token.format === "NA") {
        throw Error(`Couldn't find strftime modifier for "${token.value}"`);
      }
      formatString += token.format ? token.format : token.value;
    });
    return formatString;
  }
}
function guessFormat(date, format) {
  const parsedResults = Guesser.parse(date);
  const refinedParsedResults = Guesser.refine(parsedResults);
  if (refinedParsedResults.length === 0) {
    throw Error("Couldn't parse date");
  }
  refinedParsedResults.forEach((r) => Guesser.assign(r.tokens, format));
  let matchedFormats = [];
  refinedParsedResults.forEach((r) => matchedFormats.push(Guesser.getFormatString(r.tokens)));
  return matchedFormats.length === 1 ? matchedFormats[0] : matchedFormats;
}
export default guessFormat;
