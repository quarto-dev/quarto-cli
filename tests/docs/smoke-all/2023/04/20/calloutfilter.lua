function Callout(callout)
    callout.title = "Hello"
    return {
        pandoc.Header(2, "A prepended header"),
        quarto.Callout(callout)
    }
end