// src/main.js
var PandocCodeDecorator = class {
  constructor(node) {
    this._node = node;
    this._spans = [];
    this.normalizeCodeRange();
    this.initializeEntryPoints();
  }
  normalizeCodeRange() {
    const n = this._node;
    const lines = n.querySelectorAll("code > span");
    for (const line of lines) {
      Array.from(line.childNodes).filter((n2) => n2.nodeType === n2.TEXT_NODE).forEach((n2) => {
        const newSpan = document.createElement("span");
        newSpan.textContent = n2.wholeText;
        n2.replaceWith(newSpan);
      });
    }
  }
  initializeEntryPoints() {
    const lines = this._node.querySelectorAll("code > span");
    let result = [];
    let offset = this._node.parentElement.dataset.sourceOffset && -Number(this._node.parentElement.dataset.sourceOffset) || 0;
    for (const line of lines) {
      let lineNumber = Number(line.id.split("-").pop());
      let column = 1;
      Array.from(line.childNodes).filter((n) => n.nodeType === n.ELEMENT_NODE && n.nodeName === "SPAN").forEach((n) => {
        result.push({
          offset,
          line: lineNumber,
          column,
          node: n
        });
        offset += n.textContent.length;
        column += n.textContent.length;
      });
      offset += 1;
    }
    this._elementEntryPoints = result;
  }
  locateEntry(offset) {
    let candidate;
    if (offset === Infinity)
      return void 0;
    for (let i = 0; i < this._elementEntryPoints.length; ++i) {
      const entry = this._elementEntryPoints[i];
      if (entry.offset > offset) {
        return { entry: candidate, index: i - 1 };
      }
      candidate = entry;
    }
    if (offset < candidate.offset + candidate.node.textContent.length) {
      return { entry: candidate, index: this._elementEntryPoints.length - 1 };
    } else {
      return void 0;
    }
  }
  offsetToLineColumn(offset) {
    let entry = this.locateEntry(offset);
    if (entry === void 0) {
      const entries = this._elementEntryPoints;
      const last = entries[entries.length - 1];
      return {
        line: last.line,
        column: last.column + Math.min(last.node.textContent.length, offset - last.offset)
      };
    }
    return {
      line: entry.entry.line,
      column: entry.entry.column + offset - entry.entry.offset
    };
  }
  ensureExactSpan(start, end) {
    const splitEntry = (entry, offset) => {
      const newSpan = document.createElement("span");
      for (const cssClass of entry.node.classList) {
        newSpan.classList.add(cssClass);
      }
      const beforeText = entry.node.textContent.slice(0, offset - entry.offset);
      const afterText = entry.node.textContent.slice(offset - entry.offset);
      entry.node.textContent = beforeText;
      newSpan.textContent = afterText;
      entry.node.after(newSpan);
      this._elementEntryPoints.push({
        offset,
        node: newSpan
      });
      this._elementEntryPoints.sort((a, b) => a.offset - b.offset);
    };
    const startEntry = this.locateEntry(start);
    if (startEntry !== void 0 && startEntry.entry.offset != start) {
      splitEntry(startEntry.entry, start);
    }
    const endEntry = this.locateEntry(end);
    if (endEntry !== void 0 && endEntry.entry.offset !== end) {
      splitEntry(endEntry.entry, end);
    }
  }
  decorateSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i = startIndex; i < endIndex; ++i) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i].node.classList.add(cssClass);
      }
    }
  }
  clearSpan(start, end, classes) {
    this.ensureExactSpan(start, end);
    const startEntry = this.locateEntry(start);
    const endEntry = this.locateEntry(end);
    if (startEntry === void 0) {
      return;
    }
    const startIndex = startEntry.index;
    const endIndex = endEntry && endEntry.index || this._elementEntryPoints.length;
    for (let i = startIndex; i < endIndex; ++i) {
      for (const cssClass of classes) {
        this._elementEntryPoints[i].node.classList.remove(cssClass);
      }
    }
  }
};
export {
  PandocCodeDecorator
};
