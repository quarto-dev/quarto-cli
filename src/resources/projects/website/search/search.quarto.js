
window.document.addEventListener("DOMContentLoaded", function (event) {

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
    
  // create index then initialize autocomplete
  createFuseIndex()
    .then(function(fuse) {

      // initialize autocomplete
      var options = {
        autoselect: true,
        autoWidth: false,
        hint: false,
        minLength: 2,
        appendTo: "#quarto-search-results",
        debug: true,
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
              return result.item;
            })
          );          
        },
        templates: {
          suggestion: function(item) {
            const escape = window.autocomplete.escapeHighlightedString;
            const lines = ['<div class="card">','<p class="search-result-title">'];
            lines.push(escape(item.title));
            if (item.section) {
              lines.push(...[
                '<span class="text-muted">',
                ' — ' + escape(item.section),
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
      .on('autocomplete:redrawn', function(event) {
        // fixup popup position
        var input = this;
        var inputRect = input.getBoundingClientRect();
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
