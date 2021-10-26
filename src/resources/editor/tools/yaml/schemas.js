const core = window._quartoCoreLib;
let _schemas;

export async function getSchemas() {
  if (_schemas) {
    return _schemas;
  }
  const response = await fetch('/quarto/resources/editor/tools/yaml/quarto-json-schemas.json');
  _schemas = response.json();
  return _schemas;
}

export function navigateSchema(schema, path)
{
  const refs = {};
  function inner(subSchema, index) {
    if (subSchema.$id) {
      refs[subSchema.$id] = subSchema;
    }
    if (subSchema.$ref) {
      if (refs[subSchema.$ref] === undefined) {
        throw new Error(`Internal error: schema reference ${subSchema.$ref} undefined`);
      }
      subSchema = refs[subSchema.$ref];
    }
    if (index === path.length) {
      return [subSchema];
    }
    const st = core.schemaType(subSchema);
    if (st === "object") {
      const key = path[index];
      if (subSchema.properties[key] === undefined) {
        // because we're using this in an autocomplete scenario, there's the "last entry is a prefix of a
        // valid key" special case.
        if (index !== path.length - 1) {
          return [];
        }
        const completions = Object.getOwnPropertyNames(subSchema.properties).filter(
          name => name.startsWith(key));
        if (completions.length === 0) {
          return [];
        }
        return [subSchema];
      }
      return inner(subSchema.properties[key], index + 1);
    } else if (st === "array") {
      // arrays are uniformly typed, easy
      if (subSchema.items === undefined) {
        // no items schema, can't navigate to expected schema
        return [];
      }
      return inner(subSchema.items, index + 1);
    } else if (st === "anyOf") {
      return subSchema.anyOf.map(ss => inner(ss, index));
    } else if (st === "allOf") {
      // FIXME
      throw new Error("Internal error: don't know how to navigate allOf schema :(");
    } else if (st === "oneOf") {
      const result = subSchema.oneOf.map(ss => inner(ss, index)).flat(Infinity);
      if (result.length !== 1) {
        return [];
      } else {
        return result;
      }
    } else {
      // if path wanted to navigate deeper but this is a YAML
      // "terminal" (not a compound type) then this is not a valid
      // schema to complete on.
      return [];
    }
  };
  return inner(schema, 0).flat(Infinity);
}
