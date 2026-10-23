import {promises as fs} from "fs";
import * as path from "path";

export default function fetchit(description, run) {
  return it(description, withFetch(run));
}

fetchit.skip = (description, run) => {
  return it.skip(description, withFetch(run));
};

fetchit.only = (description, run) => {
  return it.only(description, withFetch(run));
};

function withFetch(run) {
  return async () => {
    global.fetch = async (href) => new Response(path.resolve("./test/data", href.replace(/^https:\/\//, "")));
    try {
      return await run();
    } finally {
      delete global.fetch;
    }
  };
}

class Response {
  constructor(href) {
    this._href = href;
    this.ok = true;
    this.status = 200;
  }
  async text() {
    return fs.readFile(this._href, {encoding: "utf-8"});
  }
  async json() {
    return JSON.parse(await this.text());
  }
}
