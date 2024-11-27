import { withType } from './ast-utils.ts';

// FIXME in SCSS, _declarations_ have a `!default` flag, not _values_
// but the parser we have puts the `!default` flag on the values
// we need to lift it up to the declaration level

export const explicitlyTagDefaultValues = (outer: any) =>
  withType(outer, (node: any) => {
    const l = node.value?.length;
    if (node?.type !== "value" || l < 2) {
      return node;
    }
    if (node.value[l - 1]?.type !== "identifier" || 
      node.value[l - 1]?.value !== "default" ||
      node.value[l - 2]?.type !== "operator" ||
      node.value[l - 2]?.value !== "!") {
      return node;
    }
    return {
      ...node,
      value: node.value.slice(0, -2),
      isDefault: true,
    };
  });