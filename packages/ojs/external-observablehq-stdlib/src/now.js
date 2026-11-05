export function* now() {
  while (true) {
    yield Date.now();
  }
}
