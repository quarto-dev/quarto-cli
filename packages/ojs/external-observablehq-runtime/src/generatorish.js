export function generatorish(value) {
  return value
      && typeof value.next === "function"
      && typeof value.return === "function";
}
