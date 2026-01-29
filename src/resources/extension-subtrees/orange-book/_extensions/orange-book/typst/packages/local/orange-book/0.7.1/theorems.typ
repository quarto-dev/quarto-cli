// Store theorem environment numbering

#let translations = (
  "theorem": (
    "en": "Theorem",
    "ru": "Теорема",
    "ca": "Teorema",
    "de": "Satz",
    "fr": "Théorème",
    "es": "Teorema",
  ),
  "proposition": (
    "en": "Proposition",
    "ru": "Пропозиция",
    "ca": "Proposició",
    "de": "Proposition",
    "fr": "Proposition",
    "es": "Proposición",
  ),
  "lemma": (
    "en": "Lemma",
    "ru": "Лемма",
    "ca": "Lema",
    "de": "Lemma",
    "fr": "Lemme",
    "es": "Lema",
  ),
  "corollary": (
    "en": "Corollary",
    "ru": "Следствие",
    "ca": "Coroŀlari",
    "de": "Korollar",
    "fr": "Corollaire",
    "es": "Corolario",
  ),
  "definition": (
    "en": "Definition",
    "ru": "Определение",
    "ca": "Definició",
    "de": "Definition",
    "fr": "Définition",
    "es": "Definición",
  ),
  "example": (
    "en": "Example",
    "ru": "Пример",
    "ca": "Exemple",
    "de": "Beispiel",
    "fr": "Exemple",
    "es": "Ejemplo",
    "it": "Esempio",
  ),
  "remark": (
    "en": "Remark",
    "ru": "Примечание",
    "ca": "Observació",
    "de": "Bemerkung",
    "fr": "Remarque",
    "es": "Observación",
    "it": "Osservazione",
  ),
  "note": (
    "en": "Note",
    "ru": "Замечание",
    "ca": "Nota",
    "de": "Notiz",
    "fr": "Note",
    "es": "Nota",
    "it": "Nota",
  ),
  "exercise": (
    "en": "Exercise",
    "ru": "Упражнение",
    "ca": "Exercici",
    "de": "Übung",
    "fr": "Exercice",
    "es": "Ejercicio",
    "it": "Esercizio",
  ),
  "algorithm": (
    "en": "Algorithm",
    "ru": "Алгоритм",
    "ca": "Algorisme",
    "de": "Algorithmus",
    "fr": "Algorithme",
    "es": "Algoritmo",
  ),
  "claim": (
    "en": "Claim", 
    "ru": "Утверждение",
    "ca": "Afirmació",
    "de": "Behauptung",
    "fr": "Assertion",
    "es": "Afirmación",
  ),
  "axiom": (
    "en": "Axiom", 
    "ru": "Аксиома",
    "ca": "Axioma",
    "de": "Axiom",
    "fr": "Axiome",
    "es": "Axioma",
  ),
  "proof": (
    "en": "Proof", 
    "ru": "Доказательство",
    "ca": "Demostració",
    "de": "Beweis", 
    "fr": "Démonstration", 
    "es": "Demostración",
  ),
  "proof-of": (
    "en": "Proof of", 
    "ru": "Доказательство",
    "ca": "Demostració del",
    "de": "Beweis von", 
    "fr": "Démonstration du", 
    "es": "Demostración del",
  ),
  "notation": (
    "en": "Notation",
    "ru": "Обозначение",
    "ca": "Notació",
    "de": "Notation",
    "fr": "Notation",
    "es": "Notación",
  ),
  "problem": (
    "en": "Problem",
    "ru": "Проблема",
    "ca": "Problema",
    "de": "Problem",
    "fr": "Problème",
    "es": "Problema",
  ),
  "vocabulary": (
    "en": "Vocabulary",
    "ru": "Словарь",
    "ca": "Vocabulari",
    "de": "Wortschatz",
    "fr": "Vocabulaire",
    "es": "Vocabulario",
  ),
)

#let translation(key) = {
  let lang-dict = translations.at(key, default: key)
  // If default value was returned
  return if type(lang-dict) == str {
    lang-dict
  } else {
    context lang-dict.at(text.lang, default: lang-dict.at("en", default: key))
  }
}

#let thmcounters = state(
  "thm",
  (
    "counters": ("heading": ()),
    "latest": (),
  ),
) 

#let thmenv(identifier, base, base_level, fmt) = {

  let global_numbering = numbering

  return (
    body,
    name: none,
    numbering: "1.1",
    base: base,
    base_level: base_level,
  ) => {
    set par(first-line-indent: 0em)
    let number = none
    if not numbering == none {
      context {
        let her = here()
        thmcounters.update(thmpair => {
          let counters = thmpair.at("counters")
          // Manually update heading counter
          counters.at("heading") = counter(heading).at(her)
          if not identifier in counters.keys() {
            counters.insert(identifier, (0,))
          }

          let tc = counters.at(identifier)
          if base != none {
            let bc = counters.at(base)

            // Pad or chop the base count
            if base_level != none {
              if bc.len() < base_level {
                bc = bc + (0,) * (base_level - bc.len())
              } else if bc.len() > base_level {
                bc = bc.slice(0, base_level)
              }
            }

            // Reset counter if the base counter has updated
            if tc.slice(0, -1) == bc {
              counters.at(identifier) = (..bc, tc.last() + 1)
            } else {
              counters.at(identifier) = (..bc, 1)
            }
          } else {
            // If we have no base counter, just count one level
            counters.at(identifier) = (tc.last() + 1,)
            let latest = counters.at(identifier)
          }

          let latest = counters.at(identifier)
          return (
            "counters": counters,
            "latest": latest,
          )
        })
      }

      number = context {
        global_numbering(numbering, ..thmcounters.get().at("latest"))
      }
    }

    fmt(name, number, body)
  }
}


#let thmref(
  label,
  fmt: auto,
  makelink: true,
  ..body,
) = {
  if fmt == auto {
    fmt = (nums, body) => {
      if body.pos().len() > 0 {
        body = body.pos().join(" ")
        return [#body #numbering("1.1", ..nums)]
      }
      return numbering("1.1", ..nums)
    }
  }

  context {
    let elements = query(label)
    let locationreps = elements.map(x => repr(x.location().position())).join(", ")
    assert(
      elements.len() > 0,
      message: "label <" + str(label) + "> does not exist in the document: referenced at " + repr(here().position()),
    )
    assert(
      elements.len() == 1,
      message: "label <" + str(label) + "> occurs multiple times in the document: found at " + locationreps,
    )
    let target = elements.first().location()
    let number = thmcounters.at(target).at("latest")
    if makelink {
      return link(target, fmt(number, body))
    }
    return fmt(number, body)
  }
}


#let thmbox(
  identifier,
  fill: none,
  stroke: none,
  inset: 1.2em,
  radius: 0.3em,
  breakable: false,
  padding: (top: 0.5em, bottom: 0.5em),
  namefmt: x => [(#x)],
  titlefmt: strong,
  bodyfmt: x => x,
  separator: [#h(0.1em):#h(0.2em)],
  base: "heading",
  base_level: none,
) = {
  let boxfmt(name, number, body) = {
    if not name == none {
      name = [ #namefmt(name)]
    } else {
      name = []
    }
    let title = translation(identifier)
    if not number == none {
      title += " " + number
    }
    title = titlefmt(title)
    body = bodyfmt(body)
    block(
      fill: fill,
      stroke: stroke,
      spacing: 1.2em,
      inset: inset,
      width: 100%,
      radius: radius,
      breakable: breakable,
      [#title#name#separator#body],
    )
  }
  return thmenv(identifier, base, base_level, boxfmt)
}


#let thmplain = thmbox.with(
  padding: (top: 0em, bottom: 0em),
  breakable: true,
  inset: (top: 0em, left: 1.2em, right: 1.2em),
  namefmt: name => emph([(#name)]),
  titlefmt: emph,
)
