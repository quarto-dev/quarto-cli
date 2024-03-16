function Header(el)
	quarto.doc.add_html_dependency({
	  name = "test",
	  version = "1.0.0",
	  scripts = {
	    { path = "test.js", attribs = {} }
	  },
	})
end
