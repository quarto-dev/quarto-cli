{
  for await (const value of foo()) {
    yield value;
  }
}
