export async function valueof(variable) {
  await variable._module._runtime._compute();
  try { return {value: await variable._promise}; }
  catch (error) { return {error: error.toString()}; }
}

export function promiseInspector() {
  let fulfilled, rejected;
  const promise = new Promise((resolve, reject) => {
    fulfilled = resolve;
    rejected = reject;
  });
  promise.fulfilled = fulfilled;
  promise.rejected = rejected;
  return promise;
}

export function sleep(ms = 50) {
  return delay(undefined, ms);
}

export function delay(value, ms) {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
