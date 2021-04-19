
window.document.addEventListener("DOMContentLoaded", function (_event) {

  // get search element (bail if we don't have one)
  var searchEl = window.document.getElementById('quarto-search');
  if (!searchEl)
    return;

  // read a meta tag value
  function getMeta(metaName) {
    var metas = window.document.getElementsByTagName('meta');
    for (let i = 0; i < metas.length; i++) {
      if (metas[i].getAttribute('name') === metaName) {
        return metas[i].getAttribute('content');
      }
    }
    return '';
  }
  
  // get the offset from this page for a given site root relative url
  function offsetURL(url) {
    var offset = getMeta('quarto:offset');
    return offset ? offset + '/' + url : url;
  }
  
  // create the index
  function createFuseIndex() {
    // create fuse index
    var options = {
      keys: [
        { name: 'title', weight: 20 },
        { name: 'section', weight: 20 },
        { name: 'text', weight: 10 },
      ],
      ignoreLocation: true,
      threshold: 0.1
    };
    var fuse = new window.Fuse([], options);
  
    // fetch the main search.json
    return fetch(offsetURL('search.json'))
      .then(function(response) {
        if (response.status == 200) {
          return response.json().then(function(articles) {
            articles.forEach(function(article) {
              fuse.add(article);
            });
            return fuse;
          });
  
        } else {
          return Promise.reject(
            new Error('Unexpected status from search index request: ' +
                        response.status)
          );
        }
      });
  }

  function highlightMatch(query, text) {
    const start = text.toLowerCase().indexOf(query.toLowerCase());
    if (start !== -1) {
      const end = start + query.length;
      text = text.slice(0, start) + 
             "<em>" + text.slice(start, end) + "</em>" +
             text.slice(end);
      const clipStart = Math.max(start - 50, 0);
      const clipEnd = clipStart + 200;
      text = text.slice(clipStart, clipEnd);
      return text.slice(text.indexOf(' ') + 1);
    } else {
      return text;
    }
    
  }
    
  // create index then initialize autocomplete
  createFuseIndex()
    .then(function(fuse) {

      // initialize autocomplete
      var options = {
        autoselect: true,
        autoWidth: false,
        cache: false,
        hint: false,
        minLength: 2,
        appendTo: "#quarto-search-results",
        debug: false,
      };
      window.autocomplete(searchEl, options, [{
        source: function(query, callback) {
          const searchOptions = {
            isCaseSensitive: false,
            shouldSort: true,
            minMatchCharLength: 2,
            limit: 20,
          };
          
          callback(fuse.search(query, searchOptions)
            .map(result => {
              return {
                title: result.item.title,
                section: result.item.section,
                href: result.item.href,
                text: highlightMatch(query, result.item.text)
              }
            })
          );          
        },
        templates: {
          suggestion: function(item) {
            const escape = window.autocomplete.escapeHighlightedString;
            const lines = ['<div class="card">','<p class="search-result-title">'];
            if (!item.section) {
              lines.push(escape(item.title));
            } else {
              lines.push(escape(item.section));
              lines.push(...[
                '<span class="text-muted">',
                ' — ' + escape(item.title),
                '</span>'
              ]);
            }
            lines.push('</p>');
            lines.push('<p class="search-result-text fw-light small">');
            lines.push(escape(item.text));
            lines.push('</p>');
            lines.push('</div>');
            return lines.join("\n");
          }
        }
      }])
      .on('autocomplete:redrawn', function(_event) {
        // fixup popup position
        var inputRect = this.getBoundingClientRect();
        var results = window.document.querySelector("#quarto-search-results .algolia-autocomplete");
        var width = results.clientWidth;
        if ((inputRect.left + width) > window.innerWidth) {  
          results.style.right = inputRect.right + "px";
          results.style.left = (inputRect.right - width) + "px";
        }
        // add .card class to menu
        var menu = results.querySelector(".aa-dropdown-menu");
        menu.classList.add("card");
      })
      .on('autocomplete:selected', function(_event, item) {
        window.location.href = offsetURL(item.href);
      });
      // remove inline display style on autocompleter (we want to manage responsive display via css)
      const algolia = window.document.querySelector('.algolia-autocomplete');
      if (algolia) {
        algolia.style.removeProperty("display");
      }
    })
    .catch(function(error) {
      console.log(error);
    });

});
