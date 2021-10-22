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
    const delimiters = {
        step: '|',
        line: ',',
        lineRange: '-',
    };

    const divSourceCode = Reveal.getRevealElement().querySelectorAll('div.sourceCode');

    divSourceCode.forEach(el => {
        if (el.hasAttribute('data-code-line-numbers')) {
            // highlightLines;
            const highlightSteps = splitLineNumbers(el.getAttribute('data-code-line-numbers'), delimiters);
            if (highlightSteps.length) {
                // If we have at least one step, we generate fragments
                if (highlightSteps > 1) {
                    let fragmentIndex = null
                    const codeBlock = el.querySelectorAll("pre code");

                    // Generate fragments for all steps except the original block
                    highlightSteps.slice(1).forEach(
                        highlight => {
                            var fragmentBlock = codeBlock.cloneNode(true);
                            fragmentBlock.setAttribute('data-code-line-numbers', )
                            fragmentBlock.classList.add("fragment");


                        }
                    )
                }
                highlightSteps[0].forEach(
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

function splitLineNumbers(lineNumbersAttr, delimiters) {
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

function joinLineNumbers(splittedLineNumbers, delimiters) {
    return splittedLineNumbers.map(function(highlights) {

        return highlights.map(function(highlight) {

            // Line range
            if (typeof highlight.last === 'number') {
                return highlight.first + delimiters.lineRange + highlight.last;
            }
            // Single line
            else if (typeof highlight.first === 'number') {
                return highlight.first;
            }
            // All lines
            else {
                return '';
            }

        }).join(delimiters.line);

    }).join(delimiters.step);
}