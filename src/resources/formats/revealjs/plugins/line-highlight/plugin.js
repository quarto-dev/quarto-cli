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

const kCodeLineNumbersAttr = 'data-code-line-numbers';
const kFragmentIndex = 'data-fragment-index';

function initQuartoLineHighlight(Reveal) {

    const divSourceCode = Reveal.getRevealElement().querySelectorAll('div.sourceCode');

    divSourceCode.forEach(el => {
        if (el.hasAttribute(kCodeLineNumbersAttr)) {
            const codeLineAttr = el.getAttribute(kCodeLineNumbersAttr);
            el.removeAttribute('data-code-line-numbers');
            if (isLinesSelector(codeLineAttr)) {
                // Only process if attr is a string to select lines to highlights
                // e.g "1|3,6|8-11"
                const codeBlock = el.querySelectorAll("pre code");
                codeBlock.forEach(
                    code => {
                        // move attributes on code block
                        code.setAttribute(kCodeLineNumbersAttr, codeLineAttr)

                        // Check if there is steps and duplicate code block accordingly
                        const highlightSteps = splitLineNumbers(codeLineAttr);
                        if (highlightSteps.length > 1) {
                            // If the original code block has a fragment-index,
                            // each clone should follow in an incremental sequence
                            let fragmentIndex = parseInt(code.getAttribute(kFragmentIndex), 10);
                            fragmentIndex = typeof fragmentIndex !== 'number' || isNaN(fragmentIndex) ? null : fragmentIndex;

                            highlightSteps.slice(1).forEach(
                                // Generate fragments for all steps except the original block
                                step => {
                                    var fragmentBlock = code.cloneNode(true);
                                    fragmentBlock.setAttribute('data-code-line-numbers', joinLineNumbers([step]));
                                    fragmentBlock.classList.add("fragment");
                                    code.parentNode.appendChild(fragmentBlock);
                                    highlightCodeBlock(fragmentBlock);

                                    if (typeof fragmentIndex === 'number') {
                                        fragmentBlock.setAttribute(kFragmentIndex, fragmentIndex);
                                        fragmentIndex += 1;
                                    } else {
                                        fragmentBlock.removeAttribute(kFragmentIndex);
                                    }

                                    // TODO add scrolling animation
                                }
                            )
                            code.removeAttribute(kFragmentIndex);
                            code.setAttribute(kCodeLineNumbersAttr, joinLineNumbers([highlightSteps[0]]));
                        }
                        // TODO add scrolling animation: scroll the first highlight into view when the slide

                        highlightCodeBlock(code);

                    });
            }
        }
    });
}

function highlightCodeBlock(codeBlock) {

    const highlightSteps = splitLineNumbers(codeBlock.getAttribute(kCodeLineNumbersAttr));

    if (highlightSteps.length) {
        // If we have at least one step, we generate fragments
        highlightSteps[0].forEach(
            highlight => {
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
    }
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