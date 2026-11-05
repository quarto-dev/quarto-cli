function names(cell) {
  if (cell.body && cell.body.specifiers)
    return cell.body.specifiers.map(
      d => `${d.view ? "viewof " : d.mutable ? "mutable " : ""}${d.local.name}`
    );

  if (cell.id && cell.id.type && cell.id) {
    if (cell.id.type === "ViewExpression") return [`viewof ${cell.id.id.name}`];
    if (cell.id.type === "MutableExpression")
      return [`mutable ${cell.id.id.name}`];
    if (cell.id.name) return [cell.id.name];
  }

  return [];
}

function references(cell) {
  if (cell.references)
    return cell.references.map(d => {
      if (d.name) return d.name;
      if (d.type === "ViewExpression") return `viewof ${d.id.name}`;
      if (d.type === "MutableExpression") return `mutable ${d.id.name}`;
      return null;
    });

  if (cell.body && cell.body.injections)
    return cell.body.injections.map(
      d =>
        `${d.view ? "viewof " : d.mutable ? "mutable " : ""}${d.imported.name}`
    );

  return [];
}

function getCellRefs(module) {
  const cells = [];
  for (const cell of module.cells) {
    const ns = names(cell);
    const refs = references(cell);
    if (!ns || !ns.length) continue;
    for (const name of ns) {
      cells.push([name, refs]);
      if (name.startsWith("viewof "))
        cells.push([name.substring("viewof ".length), [name]]);
    }
  }
  return new Map(cells);
}

export function treeShakeModule(module, targets) {
  const cellRefs = getCellRefs(module);

  const embed = new Set();
  const todo = targets.slice();
  while (todo.length) {
    const d = todo.pop();
    embed.add(d);
    // happens when 1) d is an stdlib cell, 2) d doesnt have a defintion,
    // or 3) d is in the window/global object. Let's be forgiving
    // and let it happen
    if (!cellRefs.has(d)) continue;
    const refs = cellRefs.get(d);
    for (const ref of refs) if (!embed.has(ref)) todo.push(ref);
  }
  return {
    cells: module.cells.filter(
      cell => names(cell).filter(name => embed.has(name)).length
    )
  };
}
