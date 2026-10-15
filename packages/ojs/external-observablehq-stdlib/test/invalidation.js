export default typeof AbortController === "undefined" || typeof performance === "undefined" ? mockit : it;

function mockit(description, run) {
  return it(description, withMock(run));
}

mockit.skip = (description, run) => {
  return it.skip(description, withMock(run));
};

mockit.only = (description, run) => {
  return it.only(description, withMock(run));
};

class MockAbortController {
  constructor() {
    this.signal = {aborted: false};
  }
  abort() {
    this.signal.aborted = true;
  }
}

class MockPerformance {
  static now() {
    return Date.now();
  }
}

function withMock(run) {
  return async () => {
    global.AbortController = MockAbortController;
    global.performance = MockPerformance;
    try {
      return await run();
    } finally {
      delete global.AbortController;
      delete global.performance;
    }
  };
}

export function invalidator() {
  let invalidate;
  const invalidation = new Promise((resolve) => (invalidate = resolve));
  return [invalidation, invalidate];
}
