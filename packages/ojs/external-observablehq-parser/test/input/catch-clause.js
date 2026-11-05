{
  try {
    let [x] = y;
    x++;
    return x;
  } catch (e) {
    return e;
  }
}
