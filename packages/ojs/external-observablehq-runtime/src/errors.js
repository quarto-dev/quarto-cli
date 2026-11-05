export class RuntimeError extends Error {
  constructor(message, input) {
    super(message);
    this.input = input;
  }
}

RuntimeError.prototype.name = "RuntimeError";
