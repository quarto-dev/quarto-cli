import {arrow11 as arrow} from "./dependencies.js";
import {cdn} from "./require.js";

// Returns true if the vaue is an Apache Arrow table. This uses a “duck” test
// (instead of strict instanceof) because we want it to work with a range of
// Apache Arrow versions at least 7.0.0 or above.
// https://arrow.apache.org/docs/7.0/js/classes/Arrow_dom.Table.html
export function isArrowTable(value) {
  return (
    value &&
    typeof value.getChild === "function" &&
    typeof value.toArray === "function" &&
    value.schema &&
    Array.isArray(value.schema.fields)
  );
}

export function getArrowTableSchema(table) {
  return table.schema.fields.map(getArrowFieldSchema);
}

function getArrowFieldSchema(field) {
  return {
    name: field.name,
    type: getArrowType(field.type),
    nullable: field.nullable,
    databaseType: String(field.type)
  };
}

// https://github.com/apache/arrow/blob/89f9a0948961f6e94f1ef5e4f310b707d22a3c11/js/src/enum.ts#L140-L141
function getArrowType(type) {
  switch (type.typeId) {
    case 2: // Int
      return "integer";
    case 3: // Float
    case 7: // Decimal
      return "number";
    case 4: // Binary
    case 15: // FixedSizeBinary
      return "buffer";
    case 5: // Utf8
      return "string";
    case 6: // Bool
      return "boolean";
    case 8: // Date
    case 9: // Time
    case 10: // Timestamp
      return "date";
    case 12: // List
    case 16: // FixedSizeList
      return "array";
    case 13: // Struct
    case 14: // Union
      return "object";
    case 11: // Interval
    case 17: // Map
    default:
      return "other";
  }
}

export async function loadArrow() {
  return await import(`${cdn}${arrow.resolve()}`);
}
