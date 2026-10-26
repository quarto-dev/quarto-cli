export function isArqueroTable(value) {
  // Arquero tables have a `toArrowBuffer` function
  return value && typeof value.toArrowBuffer === "function";
}
