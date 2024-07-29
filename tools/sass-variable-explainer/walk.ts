export const walk = (node: any, cb: (node: any) => unknown) => {
  if (!node || typeof node !== "object") return;
  if (!cb(node)) {
    return;
  };
  for (const key of Object.keys(node)) {
    walk(node[key], cb);
  }
}
