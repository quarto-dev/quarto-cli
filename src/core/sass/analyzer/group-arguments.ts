import { withType } from './ast-utils.ts';

// FIXME in SCSS, _declarations_ have a `!default` flag, not _values_
// but the parser we have puts the `!default` flag on the values
// we need to lift it up to the declaration level

export const groupArguments = (outer: any) =>
  withType(outer, (node: any) => {
    if (node.type !== "function") {
      return node;
    }
    const newArguments: any[] = [];
    const newGroup = (): any => {
      return {
        type: "node_group",
        start: node.start, // just so that simplifyLineInfo can handle it later
        next: node.next,
        children: [],
      };
    }
    let thisArgument = newGroup();
    const flushGroup = () => {
      if (thisArgument.children.length > 1) {
        newArguments.push(thisArgument);
      } else {
        newArguments.push(thisArgument.children[0]);
      }
      thisArgument = newGroup();
    }
    if (node.children.length < 2) {
      throw new Error("function node has no arguments");
    }
    for (const arg of node.children[1].children) {
      if (arg.type === "punctuation" && arg.value === ",") {
        flushGroup();
      } else {
        thisArgument.children.push(arg);
      }
    }
    if (thisArgument.children.length > 0) {
      flushGroup();
    }
    node.children[1].children = newArguments;
    return node;    
  });
