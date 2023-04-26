//Imports
import { Stream } from "./stream.ts"
import { $XML, entities, schema, tokens } from "./types.ts"
import type { node, ParserOptions } from "./types.ts"

/**
 * XML parser helper
 */
export class Parser {
  /** Constructor */
  constructor(stream: Stream, options: ParserOptions = {}) {
    this.#stream = stream
    this.#options = options
    this.#options.reviver ??= function ({ value }) {
      return value
    }
  }

  /** Parse document */
  parse() {
    return this.#document()
  }

  /** Options */
  readonly #options: ParserOptions

  /** Debugger */
  #debug(path: node[], string: string) {
    if (this.#options.debug) {
      console.debug(`${path.map((node) => node[$XML].name).join(" > ")} | ${string}`.trim())
    }
  }

  /** Document parser */
  #document() {
    const document = Object.defineProperty({} as node, $XML, {
      enumerable: false,
      writable: true,
      value: { cdata: [] as Array<string[]> },
    })
    const path = [] as node[]
    const comments = []
    let root = false
    let clean
    this.#trim()

    //Parse document
    try {
      while (true) {
        clean = true

        //Comments
        if (this.#peek(tokens.comment.start)) {
          clean = false
          comments.push(this.#comment({ path }))
          continue
        }

        //Extract prolog, stylesheets and doctype
        if ((this.#peek(tokens.prolog.start)) && (!this.#peek(tokens.stylesheet.start))) {
          if (document.xml) {
            throw Object.assign(new SyntaxError("Multiple prolog declaration found"), { stack: false })
          }
          clean = false
          Object.assign(document, this.#prolog({ path }))
          continue
        }
        if (this.#peek(tokens.stylesheet.start)) {
          clean = false
          const stylesheets = (document[schema.stylesheets] ??= []) as unknown[]
          stylesheets.push(this.#stylesheet({ path }).stylesheet)
          continue
        }
        if (this.#peek(tokens.doctype.start)) {
          if (document.doctype) {
            throw Object.assign(new SyntaxError("Multiple doctype declaration found"), { stack: false })
          }
          clean = false
          Object.assign(document, this.#doctype({ path }))
          continue
        }

        //Extract root node
        if (this.#peek(tokens.tag.start)) {
          if (root) {
            throw Object.assign(new SyntaxError("Multiple root elements found"), { stack: false })
          }
          clean = false
          Object.assign(document, this.#node({ document, path }))
          this.#trim()
          root = true
          continue
        }
      }
    } catch (error) {
      if ((error instanceof Deno.errors.UnexpectedEof) && (clean)) {
        if (comments.length) {
          document[schema.comment] = comments
        }
        return document
      }
      throw error
    }
  }

  /** Node parser */
  #node({ document, path }: { document: node; path: node[] }) {
    if (this.#options.progress) {
      this.#options.progress(this.#stream.cursor)
    }
    if (this.#peek(tokens.comment.start)) {
      return { [schema.comment]: this.#comment({ path }) }
    }
    return this.#tag({ document, path })
  }

  /** Prolog parser */
  #prolog({ path }: { path: node[] }) {
    this.#debug(path, "parsing prolog")
    const prolog = this.#make.node({ name: "xml", path })
    this.#consume(tokens.prolog.start)

    //Tag attributes
    while (!this.#peek(tokens.prolog.end)) {
      Object.assign(prolog, this.#attribute({ path: [...path, prolog] }))
    }

    //Result
    this.#consume(tokens.prolog.end)
    return { xml: prolog }
  }

  /** Stylesheet parser */
  #stylesheet({ path }: { path: node[] }) {
    this.#debug(path, "parsing stylesheet")
    const stylesheet = this.#make.node({ name: "xml-stylesheet", path })
    this.#consume(tokens.stylesheet.start)

    //Tag attributes
    while (!this.#peek(tokens.stylesheet.end)) {
      Object.assign(stylesheet, this.#attribute({ path: [...path, stylesheet] }))
    }

    //Result
    this.#consume(tokens.stylesheet.end)
    return { stylesheet }
  }

  /** Doctype parser */
  #doctype({ path }: { path: node[] }) {
    this.#debug(path, "parsing doctype")
    const doctype = this.#make.node({ name: "doctype", path })
    Object.defineProperty(doctype, $XML, { enumerable: false, writable: true })
    this.#consume(tokens.doctype.start)

    //Tag attributes
    while (!this.#peek(tokens.doctype.end)) {
      if (this.#peek(tokens.doctype.elements.start)) {
        this.#consume(tokens.doctype.elements.start)
        while (!this.#peek(tokens.doctype.elements.end)) {
          Object.assign(doctype, this.#doctypeElement({ path }))
        }
        this.#consume(tokens.doctype.elements.end)
      } else {
        Object.assign(doctype, this.#property({ path }))
      }
    }

    //Result
    this.#stream.consume({ content: tokens.doctype.end })
    return { doctype }
  }

  /** Doctype element parser */
  #doctypeElement({ path }: { path: node[] }) {
    this.#debug(path, "parsing doctype element")

    //Element name
    this.#consume(tokens.doctype.element.start)
    const element = Object.keys(this.#property({ path })).shift()!.substring(schema.property.prefix.length)
    this.#debug(path, `found doctype element "${element}"`)

    //Element value
    this.#consume(tokens.doctype.element.value.start)
    const value = this.#capture(tokens.doctype.element.value.regex.end)
    this.#consume(tokens.doctype.element.value.end)
    this.#debug(path, `found doctype element value "${value}"`)

    //Result
    this.#consume(tokens.doctype.element.end)
    return { [element]: value }
  }

  /** Tag parser */
  #tag({ document, path }: { document: node; path: node[] }) {
    this.#debug(path, "parsing tag")
    const tag = this.#make.node({ path })

    //Tag name
    this.#consume(tokens.tag.start)
    const name = this.#capture(tokens.tag.regex.name)
    Object.assign(tag[$XML], { name })
    this.#debug(path, `found tag "${name}"`)

    //Tag attributes
    while (!tokens.tag.close.regex.end.test(this.#stream.peek(2))) {
      Object.assign(tag, this.#attribute({ path: [...path, tag] }))
    }

    //Honor xml:space directive
    let trim = true
    if (tag[`${schema.attribute.prefix}${schema.space.name}`] === schema.space.preserve) {
      this.#debug([...path, tag], `${schema.space.name} is set to ${schema.space.preserve}`)
      trim = false
    }

    //Self-closed tag
    const selfclosed = this.#peek(tokens.tag.close.self)
    if (selfclosed) {
      this.#debug(path, `tag "${name}" is self-closed`)
      this.#consume(tokens.tag.close.self)
    }
    this.#consume(tokens.tag.end, { trim })

    //Pair-closed tag
    if (!selfclosed) {
      //Text node
      if ((this.#peek(tokens.cdata.start)) || (!this.#peek(tokens.tag.start))) {
        Object.assign(tag, this.#text({ document, close: name, path: [...path, tag], trim }))
      } //Child nodes
      else {
        while (!tokens.tag.close.regex.start.test(this.#stream.peek(2))) {
          const child = this.#node({ document, path: [...path, tag] })
          const [key, value] = Object.entries(child).shift()!
          if (Array.isArray(tag[key])) {
            ;(tag[key] as unknown[]).push(value)
            this.#debug([...path, tag], `add new child "${key}" to array`)
          } else if (key in tag) {
            const array = [tag[key], value]
            Object.defineProperty(array, $XML, { enumerable: false, writable: true })
            if ((tag[key] as node)?.[$XML]) {
              Object.assign(array, { [$XML]: (tag[key] as node)[$XML] })
            }
            tag[key] = array
            this.#debug([...path, tag], `multiple children named "${key}", using array notation`)
          } else {
            Object.assign(tag, child)
            this.#debug([...path, tag], `add new child "${key}"`)
          }
        }
      }

      //Closing tag
      this.#consume(tokens.tag.close.start)
      this.#consume(name)
      this.#consume(tokens.tag.close.end)
      this.#debug(path, `found closing tag for "${name}"`)
    }

    //Result
    for (const [key] of Object.entries(tag).filter(([_, value]) => typeof value === "undefined")) {
      delete tag[key]
    }
    if (!Object.keys(tag).includes(schema.text)) {
      const children = Object.keys(tag).filter((key) =>
        (!key.startsWith(schema.attribute.prefix)) &&
        (key !== schema.text)
      )
      if (!children.length) {
        this.#debug(path, `tag "${name}" has implictely obtained a text node as it has no children but has attributes`)
        tag[schema.text] = this.#revive({ key: schema.text, value: "", tag })
      }
    }
    if (
      (this.#options.flatten ?? true) &&
      (Object.keys(tag).includes(schema.text)) &&
      (Object.keys(tag).length === 1)
    ) {
      this.#debug(path, `tag "${name}" has been implicitely flattened as it only has a text node`)
      return { [name]: tag[schema.text] }
    }
    return { [name]: tag }
  }

  /** Attribute parser */
  #attribute({ path }: { path: node[] }) {
    this.#debug(path, "parsing attribute")

    //Attribute name
    const attribute = this.#capture(tokens.tag.attribute.regex.name)
    this.#debug(path, `found attribute "${attribute}"`)

    //Attribute value
    this.#consume("=")
    const quote = this.#stream.peek()
    this.#consume(quote)
    const value = this.#capture({ until: new RegExp(quote), bytes: quote.length })
    this.#consume(quote)
    this.#debug(path, `found attribute value "${value}"`)

    //Result
    return {
      [`${schema.attribute.prefix}${attribute}`]: this.#revive({
        key: `${schema.attribute.prefix}${attribute}`,
        value,
        tag: path.at(-1)!,
      }),
    }
  }

  /** Property parser */
  #property({ path }: { path: node[] }) {
    this.#debug(path, "parsing property")

    //Property name
    const quote = this.#stream.peek()
    const delimiter = /["']/.test(quote) ? quote : " "
    if (delimiter.trim().length) {
      this.#consume(delimiter)
    }
    const property = this.#capture({ until: new RegExp(delimiter), bytes: delimiter.length })
    this.#debug(path, `found property ${property}`)
    if (delimiter.trim().length) {
      this.#consume(delimiter)
    }

    //Result
    return { [`${schema.property.prefix}${property}`]: true }
  }

  /** Text parser */
  #text({ document, close, path, trim }: { document: node; close: string; path: node[]; trim: boolean }) {
    this.#debug(path, "parsing text")
    const tag = this.#make.node({ name: schema.text, path })
    let text = ""
    const comments = []

    //Content
    while (
      (this.#peek(tokens.cdata.start)) ||
      (!this.#peeks([tokens.tag.close.start, close, tokens.tag.close.end]))
    ) {
      //CDATA
      if (this.#peek(tokens.cdata.start)) {
        const cpath = path.map((node) => node[$XML].name)
        document[$XML].cdata?.push(cpath)
        this.#debug(path, `text is specified as cdata, storing path >${cpath.join(">")} in document metadata`)
        text += this.#cdata({ path: [...path, tag] })
      } //Comments
      else if (this.#peek(tokens.comment.start)) {
        comments.push(this.#comment({ path: [...path, tag] }))
      } //Raw text
      else {
        text += this.#capture({ ...tokens.text.regex.end }, { trim })
        if (
          (this.#peek(tokens.cdata.start)) ||
          (this.#peek(tokens.comment.start))
        ) {
          continue
        }
        if (!this.#peeks([tokens.tag.close.start, close, tokens.tag.close.end])) {
          text += tokens.tag.close.start
          this.#consume(tokens.tag.close.start)
        }
      }
    }
    this.#debug(path, `parsed text "${text}"`)
    if (comments.length) {
      this.#debug(path, `parsed comments ${JSON.stringify(comments)}`)
    }

    //Result
    Object.assign(tag, {
      [schema.text]: this.#revive({ key: schema.text, value: trim ? text.trim() : text, tag: path.at(-1)! }),
      ...(comments.length ? { [schema.comment]: comments } : {}),
    })
    return tag
  }

  /** CDATA parser */
  #cdata({ path }: { path: node[] }) {
    this.#debug(path, "parsing cdata")
    this.#consume(tokens.cdata.start)
    const data = this.#capture(tokens.cdata.regex.end)
    this.#consume(tokens.cdata.end)
    return data
  }

  /** Comment parser */
  #comment({ path }: { path: node[] }) {
    this.#debug(path, "parsing comment")
    this.#consume(tokens.comment.start)
    const comment = this.#capture(tokens.comment.regex.end).trim()
    this.#consume(tokens.comment.end)
    return comment
  }

  //================================================================================

  /** Reviver */
  #revive({ key, value, tag }: { key: string; value: string; tag: node }) {
    return this.#options.reviver!.call(tag, {
      key,
      tag: tag[$XML].name,
      properties: !(key.startsWith(schema.attribute.prefix) ||
          key.startsWith(schema.property.prefix))
        ? { ...tag }
        : null,
      value: (() => {
        switch (true) {
          //Convert empty values to null
          case (this.#options.emptyToNull ?? true) && /^\s*$/.test(value):
            return null
          //Revive booleans
          case (this.#options.reviveBooleans ?? true) && /^(?:true|false)$/i.test(value):
            return /^true$/i.test(value)
          //Revive numbers
          case this.#options.reviveNumbers ?? true: {
            const num = Number(value)
            if (Number.isFinite(num)) {
              return num
            }
          }
          /* falls through */
          //Strings
          default:
            //Unescape XML entities
            value = value.replace(
              tokens.entity.regex.entities,
              (_, hex, code) => String.fromCharCode(parseInt(code, hex ? 16 : 10)),
            )
            for (const [entity, character] of Object.entries(entities.xml)) {
              value = value.replaceAll(entity, character)
            }
            return value
        }
      })(),
    })
  }

  //================================================================================

  /** Makers */
  #make = {
    /** Node maker */
    node({ name = "", path = [] as node[] }) {
      const node = { [$XML]: { name, parent: path[path.length - 1] ?? null } }
      Object.defineProperty(node, $XML, { enumerable: false, writable: true })
      return node as node
    },
  }

  //================================================================================

  /** Text stream */
  readonly #stream: Stream

  /** Peek and validate against token */
  #peek(token: string) {
    return this.#stream.peek(token.length) === token
  }

  /** Peek and validate against tokens */
  #peeks(tokens: string[]) {
    let offset = 0
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      while (true) {
        //Ignore whitespaces
        if (/\s/.test(this.#stream.peek(1, offset))) {
          offset++
          continue
        }
        //Validate token
        if (this.#stream.peek(token.length, offset) === token) {
          offset += token.length
          break
        }
        return false
      }
    }
    return true
  }

  /** Consume token */
  #consume(token: string, { trim }: { trim?: boolean } = {}) {
    return this.#stream.consume({ content: token, trim })
  }

  /** Capture until next token */
  #capture(token: { until: RegExp; bytes: number; length?: number }, { trim }: { trim?: boolean } = {}) {
    return this.#stream.capture({ ...token, trim })
  }

  /** Trim stream */
  #trim() {
    return this.#stream.trim()
  }
}
