#let classes = (main: "Main")
#let index_string = "my_index"

#let index(content) = place(hide(
figure(
    classes.main,
    caption: content,
    numbering: none,
    kind: index_string
)))

#let make-index-int(title: none, main-color-state:none) = {

    let content-text(content) = {
        let ct = ""
        if content.has("text") {
            ct = content.text
        }
        else {
            for cc in content.children {
                if cc.has("text") {
                    ct += cc.text
                }
            }
        }
        return ct
    }
    
    set par(first-line-indent: 0em)
    context{
        let main-color = main-color-state.at(here())
            let elements = query(selector(figure.where(kind: index_string)).before(here()))
        let words = (:)
        for el in elements {
            let ct = ""
            if el.caption.has("body"){
                ct = content-text(el.caption.body)
            }
            else{
                ct = content-text(el.caption)
            }

            // Have we already know that entry text? If not,
            // add it to our list of entry words
            if words.keys().contains(ct) != true {
                words.insert(ct, ())
            }

            // Add the new page entry to the list.
            let ent = (class: el.body.text, page: el.location().page())
            if not words.at(ct).contains(ent){
                words.at(ct).push(ent)
            }
        }


        let sortedkeys = words.keys().sorted()

        let register = ""
        if title != none {
            heading(level: 1, numbering: none, title)
        }
        block(columns(2,gutter: 1cm, [
            #for sk in sortedkeys [
                #let formattedPageNumbers = words.at(sk).map(en => {
                    link((page: en.page, x:0pt, y:0pt), text(fill: black, str(en.page)))
                })
                    #let firstCharacter = sk.first()
                    #if firstCharacter != register {
                        v(1em, weak:true)
                        box(width: 100%, fill: main-color.lighten(60%), inset: 5pt, align(center, text(size: 1.1em, weight: "bold", firstCharacter)))
                        register = firstCharacter
                        v(1em, weak:true)
                    }
                    #set text(size: 0.9em)
                    #if(sk.contains("!")){
                        h(2em)
                        sk.slice(sk.position("!")+1)
                    }else{
                     sk
                    }
                    #box(width: 1fr, repeat(text(weight: "regular")[. #h(4pt)])) 
                    #formattedPageNumbers.join(",")
                    #v(0.65em, weak:true)
        ]
        ]))
    }
}
