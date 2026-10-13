export function fromEntries(obj) {
  const result = {};
  for (const [key, value] of obj) {
    result[key] = value;
  }
  return result;
}