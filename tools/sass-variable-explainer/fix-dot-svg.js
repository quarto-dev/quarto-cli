const desiredWidth = 800;
for (const svg of Array.from(document.querySelectorAll("svg"))) {
  const viewBox = svg.getAttribute("viewBox").split(" ");
  svg.setAttribute("width", String(desiredWidth));
  svg.setAttribute(
    "height",
    String((desiredWidth / parseFloat(viewBox[2])) * parseFloat(viewBox[3]))
  );
}
