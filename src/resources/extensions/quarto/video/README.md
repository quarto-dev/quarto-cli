# Video Extension for Quarto

This extension provides [shortcode](https://quarto.org/docs/extensions/shortcodes.html) support for including video players into Quarto documents.

## Installing

```sh
quarto install extension quarto-ext/video
```

This will install the extension under the `_extensions` subdirectory.
If you're using version control, you will want to check in this directory.

## Using

To embed a video, use the `{{< video >}}` shortcode passing in the URL 
of the video or other params.

```default
{{< video src="./local-video.mp4" >}}

{{< video https://www.youtube.com/embed/wo9vZccmqwc >}}

{{< video src=https://www.youtube.com/embed/wo9vZccmqwc 
    title='What is the CERN?' 
    start="116"
    aspect-ratio="21x9" >}}

{{< video https://youtu.be/wo9vZccmqwc width="400" height="300" >}}

{{< video https://www.youtube.com/watch?v=wo9vZccmqwc&ab_channel=CERN >}}

{{< video src="https://players.brightcove.net/1460825906/default_default/index.html?videoId=5988531335001" >}}

{{< video src="https://vimeo.com/548291297" >}}
 
```
## Limitations
- Non-html formats have limited support in rendering a simple Link
- Reveal JS Presentations have no background iframe support

### Attributes
#### Title
```default
{{< video src=https://www.youtube.com/embed/wo9vZccmqwc title='What is the CERN?'>}}
```

This will produce the following HTML:

```html
<iframe src="..." title="What is the CERN?" ... ></iframe>
```

#### Start[^1]
```default
{{< video src=https://youtu.be/wo9vZccmqwc start='10'>}}
```

This will produce the following HTML:

```html
<iframe src="https://www.youtube.com/embed/wo9vZccmqwc?start=10"></iframe>
```
#### Aspect Ratio (default: `16x9`)
```default
{{< video src=https://youtu.be/wo9vZccmqwc aspect-ratio="4x3">}}
```

For the HTML format, resizing of the videos can be based the specified Aspect Ratio of the video based [on these styles](https://getbootstrap.com/docs/5.0/helpers/ratio/#aspect-ratios).  This can be modified to: `1x1`, `4x3`, `16x9` (the default), and `21x9`.

#### Height & Width
```default
{{< video src=https://youtu.be/wo9vZccmqwc width="250" height="175">}}
```
This will produce the following HTML and will _not_ be responsive.  When no `height` or `width` are specified, videos will size responsively given the space available to them.


```html
<iframe src="https://www.youtube.com/embed/wo9vZccmqwc" width="250" height="175"></iframe>
```

## Example

Here is the source code for more examples:
- [source example.qmd](example.qmd) | [output example.html](https://quarto-ext.github.io/video/example.html) 
- [source example-revealjs.qmd](example-revealjs.qmd) | [output example-revealjs.html](https://quarto-ext.github.io/video/example-revealjs.html) 


## Developing

### Unit Tests
To run the [luaunit](https://github.com/bluebird75/luaunit) test suite, install [Lua](https://www.lua.org/download.html) and.

```bash
cd _tests
lua video-test-suite.lua
```

[^1]: YouTube only.