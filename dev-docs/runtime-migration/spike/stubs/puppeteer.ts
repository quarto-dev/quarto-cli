// spike stub: puppeteer (deno.land/x port) is replaced by puppeteer-core in a real migration
const notAvailable = () => { throw new Error("puppeteer stub: not available in the Node spike"); };
export default new Proxy({}, { get: () => notAvailable });
