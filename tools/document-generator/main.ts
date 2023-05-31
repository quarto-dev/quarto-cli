import * as mod from "https://deno.land/std/yaml/mod.ts";

type GeneratorFunction<T> = (context: GeneratorContext) => T;

type Attr = {
  id: string;
  classes: string[];
  attributes: Record<string, string>;
};

type WithAttr = {
  attr?: Attr;
};

type Code = WithAttr & {
  type: "Code";
  text: string;
};

type Link = WithAttr & {
  type: "Link";
  content: Inline[];
  target: string;
};

type Emph = {
  type: "Emph";
  content: Inline[];
};

type Str = {
  type: "Str";
  text: string;
};

type Space = {
  type: "Space";
};

type Span = WithAttr & {
  type: "Span";
  content: Inline[];
};

type Inline = Code | Emph | Str | Space | Span | Shortcode | Link;
const isCode = (inline: Inline): inline is Code => inline.type === "Code";
const isEmph = (inline: Inline): inline is Emph => inline.type === "Emph";
const isStr = (inline: Inline): inline is Str => inline.type === "Str";
const isSpace = (inline: Inline): inline is Space => inline.type === "Space";
const isSpan = (inline: Inline): inline is Span => inline.type === "Span";
const isShortcode = (inline: Inline): inline is Shortcode =>
  inline.type === "Shortcode";
const isLink = (inline: Inline): inline is Link => inline.type === "Link";

type Para = {
  type: "Para";
  content: Inline[];
};

type Block = Para;
const isPara = (block: Block): block is Para => block.type === "Para";

type Document = {
  type: "Document";
  blocks: Block[];
  meta: Record<string, unknown>;
};

type Shortcode = {
  type: "Shortcode";
  content: string;
  escaped?: boolean;
};

class RenderContext {
  indent: number;
  content: string[];

  renderLink(link: Link) {
    this.content.push("[");
    for (const inline of link.content) {
      this.renderInline(inline);
    }
    this.content.push("]");
    this.content.push("(" + link.target + ")");
    this.renderAttr(link.attr);
  }

  renderAttr(attr?: Attr) {
    if (attr === undefined) {
      return;
    }
    this.content.push("{");
    this.content.push("#" + attr.id);
    for (const className of attr.classes) {
      this.content.push(" ." + className);
    }
    for (const [key, value] of Object.entries(attr.attributes)) {
      this.content.push(" " + key + '="' + value + '"');
    }
    this.content.push("}");
  }

  renderSpan(span: Span) {
    this.content.push("[");
    for (const inline of span.content) {
      this.renderInline(inline);
    }
    this.content.push("]");
    if (span.attr) {
      this.renderAttr(span.attr);
    } else {
      this.content.push("{}");
    }
  }

  renderShortcode(shortcode: Shortcode) {
    const open = shortcode.escaped ? "{{{<" : "{{<";
    const close = shortcode.escaped ? ">}}}" : ">}}";
    this.content.push(`${open} ${shortcode.content} ${close}`);
  }

  renderInline(inline: Inline) {
    if (isCode(inline)) {
      this.content.push("`" + inline.text + "`");
      this.renderAttr(inline.attr);
      return;
    }
    if (isEmph(inline)) {
      this.content.push("*");
      for (const inner of inline.content) {
        this.renderInline(inner);
      }
      this.content.push("*");
      return;
    }
    if (isStr(inline)) {
      this.content.push(inline.text);
      return;
    }
    if (isSpace(inline)) {
      this.content.push(" ");
      return;
    }
    if (isSpan(inline)) {
      this.renderSpan(inline);
    }
    if (isShortcode(inline)) {
      this.renderShortcode(inline);
    }
    if (isLink(inline)) {
      this.renderLink(inline);
    }
  }

  renderPara(para: Para) {
    this.content.push("\n\n");
    this.content.push("  ".repeat(this.indent));
    // this.indent++;
    for (const inline of para.content) {
      this.renderInline(inline);
    }
    // this.indent--;
  }

  renderBlock(block: Block) {
    if (isPara(block)) {
      this.renderPara(block);
      return;
    }
  }

  renderDocument(document: Document) {
    if (Object.entries(document.meta).length > 0) {
      this.content.push("---\n");
      this.content.push(mod.stringify(document.meta));
      this.content.push("---\n\n");
    }
    for (const block of document.blocks) {
      this.renderBlock(block);
    }
  }

  result() {
    return this.content.join("");
  }

  constructor() {
    this.indent = 0;
    this.content = [];
  }
}

class GeneratorContext {
  probabilities: {
    attr: number;
    reuseClass: number;

    str: number;
    emph: number;
    code: number;
    span: number;
    link: number;
    shortcode: number;
    targetShortcode: number;
  };

  sizes: {
    inline: number;
    block: number;
    sentence: number;
  };

  classes: string[];
  ids: string[];

  meta: Record<string, unknown>;

  ////////////////////////////////////////////////////////////////////////////////
  // helpers

  freshId() {
    const result = Math.random().toString(36).substr(
      2,
      3 + (Math.random() * 6),
    );
    if (result.charCodeAt(0) >= 48 && result.charCodeAt(0) <= 57) {
      return "a" + result;
    }
    return result;
  }

  assign(other: GeneratorContext) {
    this.probabilities = other.probabilities;
    this.sizes = other.sizes;
    this.classes = other.classes;
    this.ids = other.ids;
    this.meta = other.meta;
  }

  smaller(): GeneratorContext {
    const newContext = new GeneratorContext();
    newContext.assign(this);
    newContext.sizes = {
      ...this.sizes,
      inline: ~~(this.sizes.inline * 0.5),
      block: ~~(this.sizes.block * 0.5),
    };

    return newContext;
  }

  generatePunctuation() {
    const punctuations = [".", "!", "?", ",", ";", ":"];
    return punctuations[~~(Math.random() * punctuations.length)];
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Attr-related functions

  randomId() {
    const id = this.freshId();
    this.ids.push(id);
    return id;
  }

  randomClass() {
    if (
      Math.random() < this.probabilities.reuseClass || this.classes.length === 0
    ) {
      const id = this.freshId();
      this.classes.push(id);
      return id;
    } else {
      return this.classes[~~(Math.random() * this.classes.length)];
    }
  }

  randomClasses() {
    const classCount = ~~(Math.random() * 3) + 1;
    const classes: string[] = [];
    for (let i = 0; i < classCount; i++) {
      const id = this.randomClass();
      // repeat classes across elements but not within the same element
      if (classes.indexOf(id) === -1) {
        classes.push(id);
      }
    }
    return classes;
  }

  randomAttributes() {
    const attrCount = ~~(Math.random() * 3) + 1;
    const attributes: Record<string, string> = {};
    for (let i = 0; i < attrCount; i++) {
      attributes[this.freshId()] = this.freshId();
    }
    return attributes;
  }

  randomAttr() {
    if (Math.random() >= this.probabilities.attr) {
      return undefined;
    }
    return {
      id: this.randomId(),
      classes: this.randomClasses(),
      attributes: this.randomAttributes(),
    };
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Inline-related functions

  chooseInlineType() {
    if (Math.random() < this.probabilities.str) {
      return "Str";
    }
    if (Math.random() < this.probabilities.code) {
      return "Code";
    }
    if (Math.random() < this.probabilities.span) {
      return "Span";
    }
    if (Math.random() < this.probabilities.emph) {
      return "Emph";
    }
    if (Math.random() < this.probabilities.link) {
      return "Link";
    }
    if (Math.random() < this.probabilities.shortcode) {
      return "InlineShortcode";
    }

    return "Null";
  }

  generateInlineShortcode(): Shortcode {
    const metaKey = this.freshId();
    const metaValue = this.freshId();
    this.meta[metaKey] = metaValue;
    return {
      type: "Shortcode",
      content: `meta ${metaKey}`,
    };
  }

  generateStr(): Str {
    return {
      type: "Str",
      text: this.freshId(),
    };
  }

  generateCode(): Code {
    return {
      attr: this.randomAttr(),
      type: "Code",
      text: this.freshId(),
    };
  }

  generateEmph(): Emph {
    const small = this.smaller();
    const contentSize = ~~(Math.random() * small.sizes.inline) + 1;
    const content: Inline[] = [];

    for (let i = 0; i < contentSize; i++) {
      const inline = small.generateInline();
      if (inline) {
        content.push(inline);
      }
    }

    return {
      type: "Emph",
      content,
    };
  }

  generateSpan(): Span {
    const small = this.smaller();
    const contentSize = ~~(Math.random() * small.sizes.inline) + 1;
    const content: Inline[] = [];

    for (let i = 0; i < contentSize; i++) {
      const inline = small.generateInline();
      if (inline) {
        content.push(inline);
      }
    }

    return {
      attr: this.randomAttr(),
      type: "Span",
      content,
    };
  }

  generateTarget(): string {
    let target = this.freshId();
    if (Math.random() < this.probabilities.targetShortcode) {
      const shortcode = this.generateInlineShortcode();
      target = `${target}-{{< ${shortcode.content} >}}`;
    }
    return target;
  }

  generateLink(): Link {
    const small = this.smaller();
    const contentSize = ~~(Math.random() * small.sizes.inline) + 1;
    const content: Inline[] = [];

    for (let i = 0; i < contentSize; i++) {
      const inline = small.generateInline();
      if (inline) {
        content.push(inline);
      }
    }

    return {
      attr: this.randomAttr(),
      type: "Link",
      content,
      target: this.generateTarget(),
    };
  }

  generateInline() {
    const dispatch = {
      Str: () => this.generateStr(),
      Code: () => this.generateCode(),
      Emph: () => this.generateEmph(),
      Span: () => this.generateSpan(),
      Link: () => this.generateLink(),
      InlineShortcode: () => this.generateInlineShortcode(),
      Null: () => {},
    };
    return dispatch[this.chooseInlineType()]();
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Block-related functions

  generatePara(): Para {
    const small = this.smaller();
    const contentSize = ~~(Math.random() * small.sizes.inline) + 1;
    const content: Inline[] = [];

    const generateSentence = () => {
      const sentenceSize = ~~(Math.random() * small.sizes.sentence) + 1;

      for (let i = 0; i < sentenceSize; i++) {
        const inline = small.generateInline();
        if (inline) {
          content.push(inline);
          if (i !== sentenceSize - 1) {
            content.push({
              type: "Space",
            });
          } else {
            content.push({
              type: "Str",
              text: small.generatePunctuation(),
            });
          }
        } else {
          content.push({
            type: "Str",
            text: small.generatePunctuation(),
          });
        }
      }
    };

    for (let i = 0; i < contentSize; i++) {
      generateSentence();
      if (i !== contentSize - 1) {
        content.push({
          type: "Space",
        });
      }
    }

    return {
      type: "Para",
      content,
    };
  }

  generateBlock(): Block {
    return this.generatePara();
  }

  ////////////////////////////////////////////////////////////////////////////////
  // Document-related functions

  generateDocument(): Document {
    const small = this.smaller();
    const blockSize = ~~(Math.random() * small.sizes.block) + 1;
    const blocks: Block[] = [];

    for (let i = 0; i < blockSize; i++) {
      blocks.push(small.generateBlock());
    }

    const result: Document = {
      type: "Document",
      blocks,
      meta: this.meta,
    };
    return result;
  }

  ////////////////////////////////////////////////////////////////////////////////

  constructor() {
    this.classes = [];
    this.ids = [];
    this.probabilities = {
      attr: 0.95,
      reuseClass: 0.5,

      str: 0.9,
      code: 0.5,
      span: 0.5,
      emph: 0.5,
      link: 0.5,
      shortcode: 0.5,
      targetShortcode: 0.25,
    };
    this.sizes = {
      inline: 10,
      block: 10,
      sentence: 10,
    };
    this.meta = {};
  }
}

const doc = new GeneratorContext().generateDocument();
const renderer = new RenderContext();
renderer.renderDocument(doc);

// console.log(JSON.stringify(doc, null, 2));
console.log(renderer.result());
