window.QuartoLineHighlight = function() {
    return {
        id: 'quarto-line-highlight',
        init: function(deck) {
            console.log("hello from quarto-line-highlight!");
            initQuartoLineHighlight(deck)
        }
    }
};

function initQuartoLineHighlight(Reveal) {
    const divSourceCode = Reveal.getRevealElement().querySelectorAll('div.sourceCode');

    divSourceCode.forEach(el => {
        if (el.hasAttribute('data-line-numbers')) {
            // highlightLines;
            const highlightedLines = splitLineNumbers(el.getAttribute('data-line-numbers'));
            if (highlightedLines.length) {
                highlightedLines[0].forEach(
                    highlight => {
                        spanToHighlight = [];
                        // if a range
                        if (typeof highlight.last === 'number') {
                            spanToHighlight = [].slice.call(el.querySelectorAll('pre code > span:nth-child(n+' + highlight.first + '):nth-child(-n+' + highlight.last + ')'));
                        } else if (typeof highlight.first === 'number') {
                            spanToHighlight = [].slice.call(el.querySelectorAll('pre code > span:nth-child(' + highlight.first + ')'));
                        }
                        if (spanToHighlight.length) {
                            spanToHighlight.forEach(
                                span => span.classList.add('highlight-line')
                            );
                            el.classList.add('has-line-highlights');
                        }
                    });
            }
        }
    })
}

function splitLineNumbers(lineNumbersAttr) {
    const delimiters = {
        step: '|',
        line: ',',
        lineRange: '-',
    };
    // remove space
    lineNumbersAttr = lineNumbersAttr.replace("/\s/g", '');
    // seperate steps (for fragment)
    lineNumbersAttr = lineNumbersAttr.split(delimiters.step)

    // for each step, calculate first and last line, if any
    return lineNumbersAttr.map(
        highlights => {
            // detect lines
            const lines = highlights.split(delimiters.line)
            return lines.map(
                range => {
                    if (/^[\d-]+$/.test(range)) {
                        range = range.split(delimiters.lineRange)
                        const firstLine = parseInt(range[0], 10);
                        const lastLine = range[1] ? parseInt(range[1], 10) : undefined
                        return {
                            first: firstLine,
                            last: lastLine,
                        };
                    } else {
                        return {};
                    }
                });
        });
}