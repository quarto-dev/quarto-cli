{
  const values = [];
  for await (const value of foo()) {
    values.push(value);
  }
  return values;
}
