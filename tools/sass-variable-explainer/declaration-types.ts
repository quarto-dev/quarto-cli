export const propagateDeclarationTypes = (ast: any) => {

  const declarationsToTrack = new Map<string, any>();

  const typesToSkip = new Set([
    "identifier", "boolean",
    "number", "dimension", "percentage", 
    "string", "string_double", "string_single"]);

  const namesToIgnore: Set<string> = new Set([
    "title-banner-image", // with this hack, we can assume all other instances of 'null' are color
    "theme",
    "theme-name",
    "enable-grid-classes",
    "enable-cssgrid",
    "nav-tabs-link-active-border-color",
    "navbar-light-bg",
    "navbar-dark-bg",
    "navbar-light-color",
    "navbar-light-hover-color",
    "navbar-light-active-color",
    "navbar-light-disabled-color",
    "navbar-light-toggler-icon-bg",
    "navbar-light-toggler-border-color",
    "navbar-light-brand-color",
    "navbar-light-brand-hover-color",
    "navbar-dark-color",
    "navbar-dark-hover-color",
    "navbar-dark-active-color",
    "navbar-dark-disabled-color",
    "navbar-dark-toggler-icon-bg",
    "navbar-dark-toggler-border-color",
    "navbar-dark-brand-color",
    "navbar-dark-brand-hover-color",
  ]);

  const speciallyKnownTypes: Record<string, string> = {
    "link-color": "color",
    "input-border-color": "color",
    "title-banner-color": "color",
    "theme": "string",
  };

  for (const node of ast.children) {
    if (node?.type !== "declaration") {
      continue;
    }

    // ignore declarations that have documented
    // non-standard !default rules because of the
    // way we set if() conditions in our SCSS
    const varName = node?.property?.variable?.value;
    if (namesToIgnore.has(varName)) {
      continue;
    }
    const varValue = node?.value?.value;
    if (declarationsToTrack.has(varName)) {
      const prevDeclaration = declarationsToTrack.get(varName);
      if (prevDeclaration?.value?.isDefault &&
        node?.value?.isDefault) {
        // pass
      } else if (!prevDeclaration?.value?.isDefault &&
        !node?.value?.isDefault) {
        declarationsToTrack.set(varName, node);
      } else {
        // are these special cases?
        if (speciallyKnownTypes[varName]) {
          node.valueType = speciallyKnownTypes[varName];
          declarationsToTrack.set(varName, node);
        } else {
          console.log("Warning: variable redeclaration with conflicting default settings");
          console.log("variable: ", varName);
          console.log("lines ", prevDeclaration?.line, node?.line);
        }
      }
    } else {
      declarationsToTrack.set(varName, node);
    }
  }

  const valueTypeMap: Record<string, string> = {
    "number": "number",
    "boolean": "boolean",
    "string": "string",
    "dimension": "dimension",
    "percentage": "percentage",
    "identifier": "identifier",
    "color_hex": "color",
    "named_color": "color",
    "string_double": "string",
    "string_single": "string",
    "null": "color", // This is specific to our themes, and requires excluding 'title-banner-image' above
  };

  const functionTypeResolver: Record<string, (node: any) => string | undefined> = {
    "theme-contrast": (_: any) => "color",
    "quote": (_: any) => "string",
    "url": (_: any) => "string",
    "tint-color": (_: any) => "color",
    "shade-color": (_: any) => "color",
    "lighten": (_: any) => "color",
    "darken": (_: any) => "color",
    "mix": (_: any) => "color",
    "shift-color": (_: any) => "color",
    "linear-gradient": (_: any) => "image",
    "color-contrast": (_: any) => "color",
    "translate3d": (_: any) => "transform-function",
    "rotate": (_: any) => "transform-function",
    "translate": (_: any) => "transform-function",
    "scale": (_: any) => "transform-function",
    "calc": (_: any) => "calc-value", // this can be a number, percentage, or dimension, but we don't presently care
    "add": (_: any) => "__unimplemented__",
    "subtract": (_: any) => "__unimplemented__",
    "brightness": (_: any) => "filter",
    "minmax": (_: any) => "grid-template",
    "var": (valueNode: any) => "__unimplemented__",

    // This is used in bslib as an instance of the hack described here:
    // https://css-tricks.com/when-sass-and-new-css-features-collide/
    // it's truly atrocious and we'll never be able to track this kind of thing properly,
    // but we can at least make sure it doesn't break the rest of the analysis
    "Min": (_: any) => "__unimplemented__",

    "theme-override-value": (valueNode: any) => {
      const defaultValue = valueNode?.arguments?.children[2];
      if (defaultValue && typeForValue(defaultValue)) {
        return typeForValue(defaultValue);
      } else {
        return undefined;
      }
    },
    "if": (valueNode: any) => {
      const _condition = valueNode?.arguments?.children[0];
      const trueValue = valueNode?.arguments?.children[1];
      const falseValue = valueNode?.arguments?.children[2];
      // we will assume type consistency for now
      if (trueValue) {
        const trueType = typeForValue(trueValue);
        if (trueType) {
          return trueType;
        }
      }
      if (falseValue) {
        const falseType = typeForValue(falseValue);
        if (falseType) {
          return falseType;
        }
      }
      return undefined;
    }
  }

  const typeForValue = (valueNode: any): string | undefined => {
    const nodeValueType = valueNode?.type;
    if (valueTypeMap[nodeValueType]) {
      return valueTypeMap[nodeValueType];
    }
    if (nodeValueType === "variable") {
      const nodeVariableName = valueNode?.value;
      if (!declarationsToTrack.has(nodeVariableName) && !namesToIgnore.has(nodeVariableName)) {
        console.log("Warning: variable used before declaration");
        console.log("variable: ", nodeVariableName, valueNode.line);
        return undefined;
      } else {
        const valueType = declarationsToTrack.get(nodeVariableName)?.valueType;
        if (valueType) {
          return valueType;
        }
      } 
    }
    if (nodeValueType === "function") {
      const functionName = valueNode?.identifier?.value;
      if (functionTypeResolver[functionName]) {
        return functionTypeResolver[functionName](valueNode);
      }
    }
  }

  // tag all declarations with values of known types
  for (const [name, node] of declarationsToTrack) {
    if (node?.value?.type === "value") {
      const valueType = node.value.value[0].valueType || typeForValue(node.value.value[0]);
      if (valueType) {
        node.valueType = valueType;
      }
    }
  }
  return declarationsToTrack;
 
  // // now warn about variables with unknown types
  // for (const [name, node] of declarationsToTrack) {
  //   if (node.valueType === "color") {
  //     console.log(name, node.line)
  //   }
  //   if (!node.valueType && node.value.value.length === 1) {
  //     // ignore unknown types for multi-value declarations, assume they're arrays which we don't care about.
  //     if (node.value.value[0]?.type === "parentheses") {
  //       continue;
  //     }
  //     console.log("Warning: variable with unknown type");
  //     console.log("variable: ", name, node);
  //   }
  // }
}
