export const walk = (node: any, cb: (node: any) => unknown) => {
  if (!node || typeof node !== "object") return;
  if (!cb(node)) {
    return;
  };
  for (const key of Object.keys(node)) {
    walk(node[key], cb);
  }
}

export const withType = (node: any, func: (ast: any) => any) => {
  if (!node?.type) {
    return node;
  }
  return func(node);
}

export const withTypeAndArray = (node: any, func: (ast: any) => any) => {
  if (!node?.type) {
    return node;
  }
  if (!node?.children || !Array.isArray(node.children)) {
    return node;
  }
  return func(node);
}

export const filterDeep = (outer: any, cb: (v: any) => boolean): any =>
  withType(outer, (ast: any) => {
    return Object.fromEntries(Object.entries(ast).map(([k, v]) => {
      if (Array.isArray(v)) {
        return [k, v.filter(cb).map((v: any) => filterDeep(v, cb))];
      } else if (v && typeof v === "object") {
        return [k, filterDeep(v, cb)];
      } else {
        return [k, v];
      }
    }));
  });

  export const mapDeep = (outer: any, cb: (mapped: any) => any): any =>
  withType(outer, (ast: any) => {
    if (Array.isArray(ast.children)) {
      ast.children = ast.children.map((v: any) => mapDeep(v, cb));
    }
    if (Array.isArray(ast.value)) {
      ast.value = ast.value.map((v: any) => mapDeep(v, cb));
    }
    return cb(ast);
  });

export const collect = (outer: any, cb: (v: any) => boolean): any[] => {
  const results: any = [];
  walk(outer, (node: any) => {
    if (cb(node)) {
      results.push(node);
    }
    return true;
  });
  return results;
}

export const annotateNode = (node: any, annotation: Record<string, unknown>) => {
  if (!node.annotation) {
    node.annotation = {};
  }
  Object.assign(node.annotation, annotation);
  return node;
}