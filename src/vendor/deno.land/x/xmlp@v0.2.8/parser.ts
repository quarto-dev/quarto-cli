// Copyright 2020 Masataka Kurihara. All rights reserved. MIT license.

import {
    XMLParseHandler,
    XMLParseContext,
    XMLParseEvent,
    XMLParseError,
    XMLLocator,
    XMLPosition,
    ElementInfo,
} from './context.ts';

import {
    handleBeforeDocument,
    handleGeneralStuff,
    handleFoundLT,
    handleProcInst,
    handleProcInstEnding,
    handleSgmlDecl,
    handleCdata,
    handleCdataEnding,
    handleCdataEnding2,
    handleComment,
    handleCommentEnding,
    handleCommentEnding2,
    handleDoctype,
    handleStartTag,
    handleStartTagStuff,
    handleEmptyElementTag,
    handleAttributeName,
    handleAttributeNameSawWhite,
    handleAttributeEqual,
    handleAttributeValueStart,
    handleAttributeValueEnd,
    handleEndTag,
    handleEndTagSawWhite,
    handleAfterDocument,
} from './handler.ts';

export abstract class ParserBase implements XMLLocator {
    private _cx = new XMLParseContext(this);
    private _handlers: { [state: string]: XMLParseHandler } = {};
    private _chunk = '';
    private _index = -1;
    private _position: XMLPosition = { line: 1, column: 0 };

    /*
        The basic logic of this XML parser was obtained by reading the source code of sax-js.
        Thanks & see: https://github.com/isaacs/sax-js

        STATE                     XML
        ------------------------  ------------------
        BEFORE_DOCUMENT
        GENERAL_STUFF
        FOUND_LT                  <
        PROC_INST                 <?
        PROC_INST_ENDING          <? proc ?
        SGML_DECL                 <!
        CDATA                     <![CDATA[
        CDATA_ENDING              <![CDATA[ cdata ]
        CDATA_ENDING_2            <![CDATA[ cdata ]]
        COMMENT                   <!--
        COMMENT_ENDING            <!-- comment -
        COMMENT_ENDING_2          <!-- comment --
        DOCTYPE                   <!DOCTYPE
        START_TAG                 <element
        START_TAG_STUFF           <element%20
        EMPTY_ELEMENT_TAG         <element/
        ATTRIBUTE_NAME            <element a
        ATTRIBUTE_NAME_SAW_WHITE  <element a%20
        ATTRIBUTE_EQUAL           <element a=
        ATTRIBUTE_VALUE_START     <element a="
        ATTRIBUTE_VALUE_END       <element a="value"
        END_TAG                   </element
        END_TAG_SAW_WHITE         </element%20
        AFTER_DOCUMENT
    */
    constructor() {
        this.appendHandler('BEFORE_DOCUMENT', handleBeforeDocument);
        this.appendHandler('GENERAL_STUFF', handleGeneralStuff);
        this.appendHandler('FOUND_LT', handleFoundLT);
        this.appendHandler('PROC_INST', handleProcInst);
        this.appendHandler('PROC_INST_ENDING', handleProcInstEnding);
        this.appendHandler('SGML_DECL', handleSgmlDecl);
        this.appendHandler('CDATA', handleCdata);
        this.appendHandler('CDATA_ENDING', handleCdataEnding);
        this.appendHandler('CDATA_ENDING_2', handleCdataEnding2);
        this.appendHandler('COMMENT', handleComment);
        this.appendHandler('COMMENT_ENDING', handleCommentEnding);
        this.appendHandler('COMMENT_ENDING_2', handleCommentEnding2);
        this.appendHandler('DOCTYPE', handleDoctype);
        this.appendHandler('START_TAG', handleStartTag);
        this.appendHandler('START_TAG_STUFF', handleStartTagStuff);
        this.appendHandler('EMPTY_ELEMENT_TAG', handleEmptyElementTag);
        this.appendHandler('ATTRIBUTE_NAME', handleAttributeName);
        this.appendHandler('ATTRIBUTE_NAME_SAW_WHITE', handleAttributeNameSawWhite);
        this.appendHandler('ATTRIBUTE_EQUAL', handleAttributeEqual);
        this.appendHandler('ATTRIBUTE_VALUE_START', handleAttributeValueStart);
        this.appendHandler('ATTRIBUTE_VALUE_END', handleAttributeValueEnd);
        this.appendHandler('END_TAG', handleEndTag);
        this.appendHandler('END_TAG_SAW_WHITE', handleEndTagSawWhite);
        this.appendHandler('AFTER_DOCUMENT', handleAfterDocument);
    }

    protected get cx(): XMLParseContext {
        return this._cx;
    }

    protected appendHandler(state: string, handler: XMLParseHandler): this {
        this._handlers[state] = handler;
        return this;
    }

    protected get handlers(): { [state: string]: XMLParseHandler } {
        return this._handlers;
    }

    protected set chunk(chunk: string) {
        this._chunk = chunk;
        this._index = -1;
    }

    protected hasNext(): boolean {
        return this._index < this._chunk.length - 1;
    }

    protected readNext(): string {
        this._index += 1;
        const c = this._chunk[this._index];
        if (c === '\n') {
            this._position.line += 1;
            this._position.column = 0;
        } else {
            this._position.column += 1;
        }
        return c;
    }

    get position(): XMLPosition {
        return this._position;
    }
}

/**
 * A catalog of events.
 */
export interface SAXEvent {
    start_document: () => void;
    processing_instruction: (procInst: string) => void;
    sgml_declaration: (sgmlDecl: string) => void;
    text: (text: string, element: ElementInfo, cdata: boolean) => void;
    doctype: (doctype: string) => void;
    start_prefix_mapping: (ns: string, uri: string) => void;
    start_element: (element: ElementInfo) => void;
    comment: (comment: string) => void;
    end_element: (element: ElementInfo) => void;
    end_prefix_mapping: (ns: string, uri: string) => void;
    end_document: () => void;
    error: (error: XMLParseError) => void;
}

/**
 * SAX-style XML parser.
 */
export class SAXParser extends ParserBase implements UnderlyingSink<Uint8Array> {
    // deno-lint-ignore no-explicit-any
    private _listeners: { [name: string]: ((...arg: any[]) => void)[] } = {};
    private _controller?: WritableStreamDefaultController;

    protected fireListeners(event: XMLParseEvent) {
        const [name, ...args] = event;
        const list = this._listeners[name] || [];
        for (const listener of list) {
            listener.call(this, ...args);
        }
    }

    protected run() {
        try {
            while(this.hasNext()) {
                const state = this.cx.state;
                const handler = this.handlers[state];
                if (!handler) {
                    throw new Error(`Handler for ${state} not found`);
                }
                const events = handler(this.cx, this.readNext());
                for (const event of events) {
                    this.fireListeners(event);
                }
            }
        } catch(e) {
            if (e instanceof XMLParseError) {
                this.fireListeners(['error', e]);
                this._controller?.error(e);
            } else {
                throw e;
            }
        }
    }

    /**
     * implements UnderlyingSink<Uint8Array>
     * @param chunk XML data chunk
     * @param controller error reporter, Deno writable stream uses internal.
     */
    write(chunk: Uint8Array, controller?: WritableStreamDefaultController) {
        try {
            this._controller = controller;
            // TextDecoder can resolve BOM.
            this.chunk = new TextDecoder().decode(chunk);
            this.run();
        } finally {
            this._controller = undefined;
        }
    }

    /**
     * Convenient function.
     */
    getStream(): WritableStream<Uint8Array> {
        return new WritableStream<Uint8Array>(this);
    }

    /**
     * Convenient function. {@code SAXParser#getStream} is used internally.
     */
    getWriter(): Deno.Writer {
        const streamWriter = this.getStream().getWriter();
        return {
            async write(p: Uint8Array): Promise<number> {
                await streamWriter.ready;
                await streamWriter.write(p);
                return p.length;
            }
        };
    }

    /**
     * Execute XML pull parsing.
     * @param source Target XML.
     */
    async parse(source: Deno.Reader | Uint8Array | string) {
        if (typeof source === 'string') {
            this.chunk = source;
            this.run();
        } else if (source instanceof Uint8Array) {
            this.write(source);
        } else {
            await Deno.copy(source, this.getWriter());
        }
    }

    on<K extends keyof SAXEvent>(event: K, listener: SAXEvent[K]): this {
        const list = this._listeners[event] || [];
        list.push(listener);
        this._listeners[event] = list;
        return this;
    }
}

/**
 * PullParser returns a iterator of this.
 */
export interface PullResult {
    /** event name */
    name: string;

    // known properties
    procInst?: string;
    sgmlDecl?: string;
    text?: string;
    element?: ElementInfo;
    cdata?: boolean;
    doctype?: string;
    ns?: string;
    uri?: string;
    comment?: string;
    error?: XMLParseError;
}

/**
 * Pull-style XML parser. This Pull parser is implemented using the ES6 Generator / Iterator mechanism.
 */
export class PullParser extends ParserBase {
    protected marshallEvent(event: XMLParseEvent): PullResult {
        const name = event[0];
        const result: PullResult = { name };
        if (name === 'processing_instruction') {
            result['procInst'] = event[1];
        } else if (name === 'sgml_declaration') {
            result['sgmlDecl'] = event[1];
        } else if (name === 'text') {
            result['text'] = event[1];
            result['element'] = event[2];
            result['cdata'] = event[3];
        } else if (name === 'doctype') {
            result['doctype'] = event[1];
        } else if (name === 'start_prefix_mapping' || name === 'end_prefix_mapping') {
            result['ns'] = event[1];
            result['uri'] = event[2];
        } else if (name === 'start_element' || name === 'end_element') {
            result['element'] = event[1];
        } else if (name === 'comment') {
            result['comment'] = event[1];
        }
        return result;
    }

    /**
     * Execute XML pull parsing. this is the ES6 Generator.
     * @param source Target XML.
     * @return ES6 Iterator, "value" property is a XML event object typed {@code PullResult} .
     */
    * parse(source: Uint8Array | string) {
        this.chunk = typeof source === 'string' ? source : new TextDecoder().decode(source);
        try {
            while(this.hasNext()) {
                const state = this.cx.state;
                const handler = this.handlers[state];
                if (!handler) {
                    throw new Error(`Handler for ${state} not found`);
                }
                const events = handler(this.cx, this.readNext());
                for (const event of events) {
                    yield this.marshallEvent(event);
                }
            }
        } catch(e) {
            if (e instanceof XMLParseError) {
                yield { name: 'error', error: e };
            } else {
                throw e;
            }
        }
    }
}
