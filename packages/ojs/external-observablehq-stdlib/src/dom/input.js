export function input(type) {
  var input = document.createElement("input");
  if (type != null) input.type = type;
  return input;
}
