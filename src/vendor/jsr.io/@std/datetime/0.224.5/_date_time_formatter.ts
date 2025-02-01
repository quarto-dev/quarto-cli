// Copyright 2018-2024 the Deno authors. All rights reserved. MIT license.
// This module is browser compatible.

function digits(value: string | number, count = 2): string {
  return String(value).padStart(count, "0");
}

// as declared as in namespace Intl
type DateTimeFormatPartTypes =
  | "day"
  | "dayPeriod"
  // | "era"
  | "hour"
  | "literal"
  | "minute"
  | "month"
  | "second"
  | "timeZoneName"
  // | "weekday"
  | "year"
  | "fractionalSecond";

interface DateTimeFormatPart {
  type: DateTimeFormatPartTypes;
  value: string;
}

type TimeZone = "UTC";

interface Options {
  timeZone?: TimeZone;
}

type FormatPart = {
  type: DateTimeFormatPartTypes;
  value: string | number;
  hour12?: boolean;
};
type Format = FormatPart[];

const QUOTED_LITERAL_REGEXP = /^(')(?<value>\\.|[^\']*)\1/;
const LITERAL_REGEXP = /^(?<value>.+?\s*)/;
const SYMBOL_REGEXP = /^(?<symbol>([a-zA-Z])\2*)/;

// according to unicode symbols (http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table)
function formatToParts(format: string) {
  const tokens: Format = [];
  let index = 0;
  while (index < format.length) {
    const substring = format.slice(index);
    const symbol = SYMBOL_REGEXP.exec(substring)?.groups?.symbol;
    switch (symbol) {
      case "yyyy":
        tokens.push({ type: "year", value: "numeric" });
        index += symbol.length;
        continue;
      case "yy":
        tokens.push({ type: "year", value: "2-digit" });
        index += symbol.length;
        continue;
      case "MM":
        tokens.push({ type: "month", value: "2-digit" });
        index += symbol.length;
        continue;
      case "M":
        tokens.push({ type: "month", value: "numeric" });
        index += symbol.length;
        continue;
      case "dd":
        tokens.push({ type: "day", value: "2-digit" });
        index += symbol.length;
        continue;
      case "d":
        tokens.push({ type: "day", value: "numeric" });
        index += symbol.length;
        continue;
      case "HH":
        tokens.push({ type: "hour", value: "2-digit" });
        index += symbol.length;
        continue;
      case "H":
        tokens.push({ type: "hour", value: "numeric" });
        index += symbol.length;
        continue;
      case "hh":
        tokens.push({ type: "hour", value: "2-digit", hour12: true });
        index += symbol.length;
        continue;
      case "h":
        tokens.push({ type: "hour", value: "numeric", hour12: true });
        index += symbol.length;
        continue;
      case "mm":
        tokens.push({ type: "minute", value: "2-digit" });
        index += symbol.length;
        continue;
      case "m":
        tokens.push({ type: "minute", value: "numeric" });
        index += symbol.length;
        continue;
      case "ss":
        tokens.push({ type: "second", value: "2-digit" });
        index += symbol.length;
        continue;
      case "s":
        tokens.push({ type: "second", value: "numeric" });
        index += symbol.length;
        continue;
      case "SSS":
        tokens.push({ type: "fractionalSecond", value: 3 });
        index += symbol.length;
        continue;
      case "SS":
        tokens.push({ type: "fractionalSecond", value: 2 });
        index += symbol.length;
        continue;
      case "S":
        tokens.push({ type: "fractionalSecond", value: 1 });
        index += symbol.length;
        continue;
      case "a":
        tokens.push({ type: "dayPeriod", value: 1 });
        index += symbol.length;
        continue;
    }

    const quotedLiteralMatch = QUOTED_LITERAL_REGEXP.exec(substring);
    if (quotedLiteralMatch) {
      const value = quotedLiteralMatch.groups!.value as string;
      tokens.push({ type: "literal", value });
      index += quotedLiteralMatch[0].length;
      continue;
    }

    const literalGroups = LITERAL_REGEXP.exec(substring)!.groups!;
    const value = literalGroups.value as string;
    tokens.push({ type: "literal", value });
    index += value.length;
  }

  return tokens;
}

export class DateTimeFormatter {
  #format: Format;

  constructor(formatString: string) {
    this.#format = formatToParts(formatString);
  }

  format(date: Date, options: Options = {}): string {
    let string = "";

    const utc = options.timeZone === "UTC";

    for (const token of this.#format) {
      const type = token.type;

      switch (type) {
        case "year": {
          const value = utc ? date.getUTCFullYear() : date.getFullYear();
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2).slice(-2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "month": {
          const value = (utc ? date.getUTCMonth() : date.getMonth()) + 1;
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "day": {
          const value = utc ? date.getUTCDate() : date.getDate();
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "hour": {
          let value = utc ? date.getUTCHours() : date.getHours();
          if (token.hour12) {
            if (value === 0) value = 12;
            else if (value > 12) value -= 12;
          }
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "minute": {
          const value = utc ? date.getUTCMinutes() : date.getMinutes();
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "second": {
          const value = utc ? date.getUTCSeconds() : date.getSeconds();
          switch (token.value) {
            case "numeric": {
              string += value;
              break;
            }
            case "2-digit": {
              string += digits(value, 2);
              break;
            }
            default:
              throw Error(
                `FormatterError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "fractionalSecond": {
          const value = utc
            ? date.getUTCMilliseconds()
            : date.getMilliseconds();
          string += digits(value, Number(token.value));
          break;
        }
        // FIXME(bartlomieju)
        case "timeZoneName": {
          // string += utc ? "Z" : token.value
          break;
        }
        case "dayPeriod": {
          string += date.getHours() >= 12 ? "PM" : "AM";
          break;
        }
        case "literal": {
          string += token.value;
          break;
        }

        default:
          throw Error(`FormatterError: { ${token.type} ${token.value} }`);
      }
    }

    return string;
  }

  parseToParts(string: string): DateTimeFormatPart[] {
    const parts: DateTimeFormatPart[] = [];

    for (const token of this.#format) {
      const type = token.type;

      let value = "";
      switch (token.type) {
        case "year": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,4}/.exec(string)?.[0] as string;
              break;
            }
            case "2-digit": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "month": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              break;
            }
            case "2-digit": {
              value = /^\d{2}/.exec(string)?.[0] as string;
              break;
            }
            case "narrow": {
              value = /^[a-zA-Z]+/.exec(string)?.[0] as string;
              break;
            }
            case "short": {
              value = /^[a-zA-Z]+/.exec(string)?.[0] as string;
              break;
            }
            case "long": {
              value = /^[a-zA-Z]+/.exec(string)?.[0] as string;
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "day": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              break;
            }
            case "2-digit": {
              value = /^\d{2}/.exec(string)?.[0] as string;
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "hour": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              if (token.hour12 && parseInt(value) > 12) {
                console.error(
                  `Trying to parse hour greater than 12. Use 'H' instead of 'h'.`,
                );
              }
              break;
            }
            case "2-digit": {
              value = /^\d{2}/.exec(string)?.[0] as string;
              if (token.hour12 && parseInt(value) > 12) {
                console.error(
                  `Trying to parse hour greater than 12. Use 'HH' instead of 'hh'.`,
                );
              }
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "minute": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              break;
            }
            case "2-digit": {
              value = /^\d{2}/.exec(string)?.[0] as string;
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "second": {
          switch (token.value) {
            case "numeric": {
              value = /^\d{1,2}/.exec(string)?.[0] as string;
              break;
            }
            case "2-digit": {
              value = /^\d{2}/.exec(string)?.[0] as string;
              break;
            }
            default:
              throw Error(
                `ParserError: value "${token.value}" is not supported`,
              );
          }
          break;
        }
        case "fractionalSecond": {
          value = new RegExp(`^\\d{${token.value}}`).exec(string)
            ?.[0] as string;
          break;
        }
        case "timeZoneName": {
          value = token.value as string;
          break;
        }
        case "dayPeriod": {
          value = /^(A|P)M/.exec(string)?.[0] as string;
          break;
        }
        case "literal": {
          if (!string.startsWith(token.value as string)) {
            throw Error(
              `Literal "${token.value}" not found "${string.slice(0, 25)}"`,
            );
          }
          value = token.value as string;
          break;
        }

        default:
          throw Error(`${token.type} ${token.value}`);
      }

      if (!value) {
        throw Error(
          `value not valid for token { ${type} ${value} } ${
            string.slice(
              0,
              25,
            )
          }`,
        );
      }
      parts.push({ type, value });

      string = string.slice(value.length);
    }

    if (string.length) {
      throw Error(
        `datetime string was not fully parsed! ${string.slice(0, 25)}`,
      );
    }

    return parts;
  }

  /** sort & filter dateTimeFormatPart */
  sortDateTimeFormatPart(parts: DateTimeFormatPart[]): DateTimeFormatPart[] {
    let result: DateTimeFormatPart[] = [];
    const typeArray = [
      "year",
      "month",
      "day",
      "hour",
      "minute",
      "second",
      "fractionalSecond",
    ];
    for (const type of typeArray) {
      const current = parts.findIndex((el) => el.type === type);
      if (current !== -1) {
        result = result.concat(parts.splice(current, 1));
      }
    }
    result = result.concat(parts);
    return result;
  }

  partsToDate(parts: DateTimeFormatPart[]): Date {
    const date = new Date();
    const utc = parts.find(
      (part) => part.type === "timeZoneName" && part.value === "UTC",
    );

    const dayPart = parts.find((part) => part.type === "day");

    utc ? date.setUTCHours(0, 0, 0, 0) : date.setHours(0, 0, 0, 0);
    for (const part of parts) {
      switch (part.type) {
        case "year": {
          const value = Number(part.value.padStart(4, "20"));
          utc ? date.setUTCFullYear(value) : date.setFullYear(value);
          break;
        }
        case "month": {
          const value = Number(part.value) - 1;
          if (dayPart) {
            utc
              ? date.setUTCMonth(value, Number(dayPart.value))
              : date.setMonth(value, Number(dayPart.value));
          } else {
            utc ? date.setUTCMonth(value) : date.setMonth(value);
          }
          break;
        }
        case "day": {
          const value = Number(part.value);
          utc ? date.setUTCDate(value) : date.setDate(value);
          break;
        }
        case "hour": {
          let value = Number(part.value);
          const dayPeriod = parts.find(
            (part: DateTimeFormatPart) => part.type === "dayPeriod",
          );
          if (dayPeriod?.value === "PM") value += 12;
          utc ? date.setUTCHours(value) : date.setHours(value);
          break;
        }
        case "minute": {
          const value = Number(part.value);
          utc ? date.setUTCMinutes(value) : date.setMinutes(value);
          break;
        }
        case "second": {
          const value = Number(part.value);
          utc ? date.setUTCSeconds(value) : date.setSeconds(value);
          break;
        }
        case "fractionalSecond": {
          const value = Number(part.value);
          utc ? date.setUTCMilliseconds(value) : date.setMilliseconds(value);
          break;
        }
      }
    }
    return date;
  }

  parse(string: string): Date {
    const parts = this.parseToParts(string);
    const sortParts = this.sortDateTimeFormatPart(parts);
    return this.partsToDate(sortParts);
  }
}
