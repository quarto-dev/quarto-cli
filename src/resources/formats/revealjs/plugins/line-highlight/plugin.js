window.QuartoLineHighlight = function() {
    return {
        id: 'quarto-line-highlight',
        init: function(deck) {
            console.log("hello from quarto-line-highlight!");
            initQuartoLineHighlight(deck)
        }
    }
};

const delimiters = {
    step: '|',
    line: ',',
    lineRange: '-',
};

function initQuartoLineHighlight(Reveal) {

    const divSourceCode = Reveal.getRevealElement().querySelectorAll('div.sourceCode');

    divSourceCode.forEach(el => {
        if (el.hasAttribute('data-code-line-numbers')) {
            const codeLineAttr = el.getAttribute('data-code-line-numbers')
            if (!isLinesSelector(codeLineAttr)) {
                el.removeAttribute('data-code-line-numbers')
            } else {
                // highlightLines;
                const highlightSteps = splitLineNumbers(codeLineAttr);
                if (highlightSteps.length) {
                    // If we have at least one step, we generate fragments
                    /*                 if (highlightSteps > 1) {
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
                                    } */
                    highlightSteps[0].forEach(
                        highlight => {
                            const preCodeBlock = el.querySelectorAll("pre code");
                            preCodeBlock.forEach(
                                codeBlock => {
                                    // Add expected class on <pre> for reveal CSS
                                    codeBlock.parentNode.classList.add('code-wrapper');

                                    // Select lines to highlight
                                    spanToHighlight = [];
                                    if (typeof highlight.last === 'number') {
                                        spanToHighlight = [].slice.call(codeBlock.querySelectorAll(':scope > span:nth-child(n+' + highlight.first + '):nth-child(-n+' + highlight.last + ')'));
                                    } else if (typeof highlight.first === 'number') {
                                        spanToHighlight = [].slice.call(codeBlock.querySelectorAll(':scope > span:nth-child(' + highlight.first + ')'));
                                    }
                                    if (spanToHighlight.length) {
                                        // Add a class on <code> and <span> to select line to highlight
                                        spanToHighlight.forEach(
                                            span => span.classList.add('highlight-line')
                                        );
                                        codeBlock.classList.add('has-line-highlights');
                                    }

                                }
                            )

                        });
                }
            }
        }
    })
}

function splitLineNumbers(lineNumbersAttr) {
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

function joinLineNumbers(splittedLineNumbers) {
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

function isLinesSelector(attr) {
    const regex = new RegExp('^[\\d' + Object.values(delimiters).join('') + ']+$');
    return regex.test(attr)
}