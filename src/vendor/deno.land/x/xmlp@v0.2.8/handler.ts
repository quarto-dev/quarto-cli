// Copyright 2020 Masataka Kurihara. All rights reserved. MIT license.

import {
    XMLParseContext,
    XMLParseEvent,
    XMLParseError,
    ElementInfo,
} from './context.ts';

const NAME_HEAD = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/
const NAME_BODY = /[:_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u00B7\u0300-\u036F\u203F-\u2040.\d-]/

function isWhitespace(c: string): c is (' ' | '\n' | '\r' | '\t') {
    return c === ' ' || c === '\n' || c === '\r' || c === '\t';
}

function isQuote(c: string): c is ('"' | '\'') {
    return c === '"' || c === '\'';
}

export function resolveEntity(text: string): string {
    let result = text;
    [
        { reg: /&amp;/g, ch: '&' },
        { reg: /&gt;/g, ch: '>' },
        { reg: /&lt;/g, ch: '<' },
        { reg: /&quot;/g, ch: '"' },
        { reg: /&apos;/g, ch: '\'' },
    ].forEach(({ reg, ch }) => {
        result = result.replace(reg, ch);
    });
    return result;
}

// BEFORE_DOCUMENT; FOUND_LT, Error
export function handleBeforeDocument(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '<') {
        cx.state = 'FOUND_LT';
    } else {
        if (!isWhitespace(c)) {
            throw new XMLParseError('Non-whitespace before document.', cx);
        }
    }
    return [];
}

// GENERAL_STUFF; FOUND_LT
export function handleGeneralStuff(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '<') {
        cx.state = 'FOUND_LT';
    } else {
        cx.appendMemento(c);
    }
    return [];
}

// FOUND_LT; SGML_DECL, START_TAG, END_TAG, PROC_INST, Error
export function handleFoundLT(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    const text = resolveEntity(cx.memento).trim();
    cx.clearMemento();
    if (text) {
        events = [['text', text, new ElementInfo(cx.peekElement()!), false]];
    }
    if (!isWhitespace(c)) {
        if (c === '?') {
            cx.state = 'PROC_INST';
        } else if (c === '!') {
            cx.state = 'SGML_DECL';
        } else if (NAME_HEAD.test(c)) {
            cx.appendMemento(c);
            cx.state = 'START_TAG';
        } else if (c === '/') {
            cx.state = 'END_TAG';
        } else {
            throw new XMLParseError('Unencoded <', cx);
        }
    }
    return events;
}

// PROC_INST; PROC_INST_ENDING
export function handleProcInst(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '?') {
        cx.state = 'PROC_INST_ENDING';
    } else {
        cx.appendMemento(c);
    }
    return [];
}

// PROC_INST_ENDING; processing_instruction & GENERAL_STUFF, PROC_INST
export function handleProcInstEnding(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c === '>') {
        events = [['processing_instruction', cx.memento]];
        cx.clearMemento();
        cx.state = cx.elementLength > 0 ? 'GENERAL_STUFF' : 'BEFORE_DOCUMENT';
    } else {
        cx.appendMemento(`?${c}`);
        cx.state = 'PROC_INST';
    }
    return events;
}

// SGML_DECL; CDATA, COMMENT, DOCTYPE, GENERAL_STUFF, Error
export function handleSgmlDecl(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    const sgmlCmd = `${cx.memento}${c}`.toUpperCase();
    if (sgmlCmd === '[CDATA[') {
        cx.clearMemento();
        cx.state = 'CDATA';
    } else if (sgmlCmd === '--') {
        cx.clearMemento();
        cx.state = 'COMMENT';
    } else if (sgmlCmd === 'DOCTYPE') {
        if (cx.elementLength > 0) {
            throw new XMLParseError('Inappropriately located doctype declaration', cx);
        }
        cx.clearMemento();
        cx.state = 'DOCTYPE';
    } else if (c === '>') {
        events = [['sgml_declaration', cx.memento]];
        cx.clearMemento();
        cx.state = cx.elementLength > 0 ? 'GENERAL_STUFF' : 'BEFORE_DOCUMENT';
    } else {
        cx.appendMemento(c);
    }
    return events;
}

// CDATA; CDATA_ENDING
export function handleCdata(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === ']') {
        cx.state = 'CDATA_ENDING';
    } else {
        cx.appendMemento(c);
    }
    return [];
}

// CDATA_ENDING; CDATA_ENDING_2, CDATA
export function handleCdataEnding(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === ']') {
        cx.state = 'CDATA_ENDING_2';
    } else {
        cx.appendMemento(`]${c}`);
        cx.state = 'CDATA';
    }
    return [];
}

// CDATA_ENDING_2; text & GENERAL_STUFF, CDATA
export function handleCdataEnding2(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c === '>') {
        if (cx.memento) {
            events = [['text', cx.memento, new ElementInfo(cx.peekElement()!), true]];
            cx.clearMemento();
        }
        cx.state = 'GENERAL_STUFF';
    } else if (c === ']') {
        cx.appendMemento(']');
    } else {
        cx.appendMemento(`]]${c}`);
        cx.state = 'CDATA';
    }
    return events;
}

// COMMENT; COMMENT_ENDING
export function handleComment(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '-') {
        cx.state = 'COMMENT_ENDING';
    } else {
        cx.appendMemento(c);
    }
    return [];
}

// COMMENT_ENDING; COMMENT_ENDING2, COMMENT
export function handleCommentEnding(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '-') {
        cx.state = 'COMMENT_ENDING_2';
    } else {
        cx.appendMemento(`-${c}`);
        cx.state = 'COMMENT';
    }
    return [];
}

// COMMENT_ENDING_2; comment & GENERAL_STUFF, COMMENT
export function handleCommentEnding2(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c === '>') {
        const comment = cx.memento;
        if (comment) {
            events = [['comment', comment]];
        }
        cx.clearMemento();
        cx.state = 'GENERAL_STUFF';
    } else {
        cx.appendMemento(`--${c}`);
        cx.state = 'COMMENT';
    }
    return events;
}

// DOCTYPE; doctype & BEFORE_DOCUMENT
export function handleDoctype(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c === '>') {
        events = [['doctype', cx.memento]];
        cx.clearMemento();
        cx.state = 'BEFORE_DOCUMENT';
    } else {
        cx.appendMemento(c);
    }
    return events;
}

function emitStartElement(cx: XMLParseContext): XMLParseEvent[] {
    const events: XMLParseEvent[] = [];
    if (cx.elementLength === 1) {
        events.push(['start_document']);
    }
    const element = cx.peekElement()!;
    for (const { ns, uri } of element.prefixMappings) {
        cx.registerNamespace(ns, uri);
        events.push(['start_prefix_mapping', ns, uri]);
    }
    // Setting Namespace URI to this element and all attributes.
    element.uri = cx.getNamespaceURI(element.prefix);
    for (const attribute of element.attributes) {
        attribute.uri = cx.getNamespaceURI(attribute.prefix);
    }
    events.push(['start_element', new ElementInfo(element)]);
    return events;
}

// START_TAG; start_element & GENERAL_STUFF, EMPTY_ELEMENT_TAG, START_TAG_STUFF, Error
export function handleStartTag(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else {
        cx.newElement(cx.memento);
        cx.clearMemento();
        if (c === '>') {
            events = emitStartElement(cx);
            cx.state = 'GENERAL_STUFF';
        } else if (c === '/') {
            cx.state = 'EMPTY_ELEMENT_TAG';
        } else {
            if (!isWhitespace(c)) {
                throw new XMLParseError('Invalid character in element name', cx);
            }
            cx.state = 'START_TAG_STUFF';
        }
    }
    return events;
}

// ELEMENT_STUFF; start_element & GENERAL_STUFF, EMPTY_ELEMENT_TAG, ATTRIBUTE_NAME, Error
export function handleStartTagStuff(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (!isWhitespace(c)) {
        if (c === '>') {
            events = emitStartElement(cx);
            cx.state = 'GENERAL_STUFF';
        } else if (c === '/') {
            cx.state = 'EMPTY_ELEMENT_TAG';
        } else if (NAME_HEAD.test(c)) {
            cx.appendMemento(c);
            cx.state = 'ATTRIBUTE_NAME';
        } else {
            throw new XMLParseError('Invalid attribute name', cx);
        }
    }
    return events;
}

function emitEndElement(cx: XMLParseContext, qName: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    const element = cx.popElement()!;
    if (element.qName !== qName) {
        throw new XMLParseError(`Illegal element structure, ${element.qName} & ${qName}`, cx);
    }
    events = [['end_element', new ElementInfo(element)]];
    for(const { ns, uri } of element.prefixMappings) {
        events.push(['end_prefix_mapping', ns, uri]);
    }
    return events;
}

// EMPTY_ELEMENT_TAG; start_element & end_element & GENERAL_STUFF, Error
export function handleEmptyElementTag(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c !== '>') {
        throw new XMLParseError('Forward-slash in start-tag not followed by &gt', cx);
    }
    const element = cx.peekElement()!;
    element.emptyElement = true;
    events = emitStartElement(cx).concat(emitEndElement(cx, element.qName));
    cx.state = 'GENERAL_STUFF';
    return events;
}

function newAttribute(cx: XMLParseContext) {
    const qName = cx.memento;
    cx.clearMemento();
    cx.peekElement()!.newAttribute(qName);
    cx.state = 'ATTRIBUTE_EQUAL';
}

// ATTRIBUTE_NAME; ATTRIBUTE_EQUAL, ATTRIBUTE_NAME_SAW_WHITE, Error
export function handleAttributeName(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else if (isWhitespace(c)) {
        cx.state = 'ATTRIBUTE_NAME_SAW_WHITE';
    } else if (c === '=') {
        newAttribute(cx);
    } else {
        throw new XMLParseError(c === '>' ? 'Attribute without value' : 'Invalid attribute name', cx);
    }
    return [];
}

// ATTRIBUTE_NAME_SAW_WHITE; ATTRIBUTE_EQUAL, Error
export function handleAttributeNameSawWhite(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === '=') {
        newAttribute(cx);
    } else if (!isWhitespace(c)) {
        throw new XMLParseError('Attribute without value', cx);
    }
    return [];
}

// ATTRIBUTE_EQUAL; ATTRIBUTE_VALUE_START, Error
export function handleAttributeEqual(cx: XMLParseContext, c: string): XMLParseEvent[] {
    // skip whitespace
    if (!isWhitespace(c)) {
        if (isQuote(c)) {
            cx.quote = c;
            cx.state = 'ATTRIBUTE_VALUE_START';
        } else {
            throw new XMLParseError('Unquoted attribute value', cx);
        }
    }
    return [];
}

// ATTRIBUTE_VALUE_START; ATTRIBUTE_VALUE_END
export function handleAttributeValueStart(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (c === cx.quote) {
        const value = cx.memento;
        cx.clearMemento();
        cx.peekElement()!.peekAttribute()!.value = resolveEntity(value);
        cx.quote = '';
        cx.state = 'ATTRIBUTE_VALUE_END';
    } else {
        cx.appendMemento(c);
    }
    return [];
}

// ATTRIBUTE_VALUE_END; START_TAG_STUFF, EMPTY_ELEMENT_TAG, start_element & GENERAL_STUFF, Error
export function handleAttributeValueEnd(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (isWhitespace(c)) {
        cx.state = 'START_TAG_STUFF';
    } else if (c === '/') {
        cx.state = 'EMPTY_ELEMENT_TAG';
    } else if (c === '>') {
        events = emitStartElement(cx);
        cx.state = 'GENERAL_STUFF';
    } else {
        throw new XMLParseError('Invalid attribute name', cx);
    }
    return events;
}

function closeElement(cx: XMLParseContext): XMLParseEvent[] {
    const events = emitEndElement(cx, cx.memento);
    cx.clearMemento();
    if (cx.elementLength === 0) {
        events.push(['end_document']);
        cx.state = 'AFTER_DOCUMENT';
    } else {
        cx.state = 'GENERAL_STUFF';
    }
    return events;
}

// END_TAG; END_TAG_SAW_WHITE, AFTER_DOCUMENT, GENERAL_STUFF, Error
export function handleEndTag(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (NAME_BODY.test(c)) {
        cx.appendMemento(c);
    } else if (c === '>') {
        events = closeElement(cx);
    } else if (isWhitespace(c)) {
        cx.state = 'END_TAG_SAW_WHITE';
    } else {
        throw new XMLParseError('Invalid element name', cx);
    }
    return events;
}

// END_TAG_SAW_WHITE; GENERAL_STUFF, AFTER_DOCUMENT, Error
export function handleEndTagSawWhite(cx: XMLParseContext, c: string): XMLParseEvent[] {
    let events: XMLParseEvent[] = [];
    if (c === '>') {
        events = closeElement(cx);
    } else if (!isWhitespace(c)) {
        throw new XMLParseError('Invalid characters in end-tag', cx);
    }
    return events;
}

// AFTER_DOCUMENT; Error
export function handleAfterDocument(cx: XMLParseContext, c: string): XMLParseEvent[] {
    if (!isWhitespace(c)) {
        throw new XMLParseError('Non-whitespace after document.', cx);
    }
    return [];
}
