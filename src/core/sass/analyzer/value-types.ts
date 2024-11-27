import { withType } from "./ast-utils.ts";
import { namedColors, units } from "./css-information.ts";

const typedImmediateValues: Record<string, any> = {
  false: { type: "boolean", value: false },
  true: { type: "boolean", value: true },
  null: { type: "null", value: null },
}

export const fixImmediateTypes = (outer: any) =>
  withType(outer, (node: any) => {
    if (node.type === "identifier" && typedImmediateValues[node.value]) {
      return {...node, ...typedImmediateValues[node.value]};
    }
    return node;
  });

export const tagNamedColors = (outer: any) =>
  withType(outer, (node: any) => {
    if (node.type !== "identifier" || !namedColors.has(node?.value)) {
      return node;
    }
    return {
      ...node,
      type: "named_color",
    };
  });

export const tagColorConstructors = (outer: any) =>
  withType(outer, (node: any) => {
    if (node.type !== "function") {
      return node;
    }
    const name = node.children[0].value;
    if (node.children[0].type !== "identifier" || !name) {
      return node;
    }
    const colorConstructors = new Set([
      "rgb", "rgba", "hsl", "hsla",
    ]);
    if (colorConstructors.has(name)) {
      return {
        ...node,
        valueType: "color",
      };
    }
    return node;
  });

  // this also finds percentages
export const findDimensionValues = (outer: any) =>
  withType(outer, (node: any) => {
    const replace = (value: any[]) => {
      const newValues = [];
      for (let i = 0; i < value.length; ++i) {
        const thisValue = value[i];
        const nextValue = value[i + 1];
        if (thisValue?.type === "number" && 
          nextValue?.type === "identifier" && 
          units.has(nextValue?.value)) {
          newValues.push({
            ...thisValue,
            type: "dimension",
            unit: nextValue.value,
          });
          ++i;
        } else if (thisValue?.type === "number" &&
          nextValue?.type === "operator" &&
          nextValue?.value === "%") {
          // this might be chancy if there's stuff like (3 % 2) floating around
          // I couldn't find any in our .scss files, but :grimace:
          newValues.push({
            ...thisValue,
            type: "percentage",
          });
          ++i;
        } else {
          newValues.push(thisValue);
        }
      }
      return newValues;
    }
    if (node.type === "value" && Array.isArray(node.value)) {
      return {
        ...node,
        value: replace(node.value),
      };
    }
    if (node.type === "node_group") {
      return {
        ...node,
        children: replace(node.children),
      }
    }
    return node;
    // if (node?.type !== "value") {
    //   return node;
    // }
    // const value = node?.value;
    // if (!Array.isArray(value)) {
    //   return node;
    // }
    // const newValues = [];
    // for (let i = 0; i < value.length; ++i) {
    //   const thisValue = value[i];
    //   const nextValue = value[i + 1];
    //   if (thisValue?.type === "number" && 
    //     nextValue?.type === "identifier" && 
    //     units.has(nextValue?.value)) {
    //     newValues.push({
    //       ...thisValue,
    //       type: "dimension",
    //       unit: nextValue.value,
    //     });
    //     ++i;
    //   } else if (thisValue?.type === "number" &&
    //     nextValue?.type === "operator" &&
    //     nextValue?.value === "%") {
    //     // this might be chancy if there's stuff like (3 % 2) floating around
    //     // I couldn't find any in our .scss files, but :grimace:
    //     newValues.push({
    //       ...thisValue,
    //       type: "percentage",
    //     });
    //     ++i;
    //   } else {
    //     newValues.push(thisValue);
    //   }
    // }
    // return {
    //   ...node,
    //   value: newValues,
    // };
  });
