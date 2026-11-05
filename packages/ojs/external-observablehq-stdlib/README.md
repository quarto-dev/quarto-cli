# @quarto/external-observablehq-stdlib, a fork of @observablehq/stdlib

We track here a number of small changes required to make the
observable stdlib work in the RStudio IDE. The important bits are:

- The build process (and as a result `dist/stdlib.js`) needs to use a [fork of
  `d3-require`](https://github.com/quarto-dev/external-d3-d3-require) to support a
  require() function that works from inside IPython's HTMLwidgets as
  well as the observable runtime.

- We can't call `Object.fromEntries` because the RStudio IDE uses an
  old version of the JS stdlib.

# @observablehq/stdlib

[![Node CI](https://github.com/observablehq/stdlib/workflows/Node%20CI/badge.svg)](https://github.com/observablehq/stdlib/actions?workflow=Node+CI)

The Observable standard library.

For examples, see https://observablehq.com/@observablehq/stdlib.

## API Reference

* [DOM](#dom) - create HTML and SVG elements.
* [Files](#files) - read local files into memory.
* [FileAttachments](#file-attachments) - read remote files.
* [Generators](#generators) - utilities for generators and iterators.
* [Promises](#promises) - utilities for promises.
* [require](#require) - load third-party libraries.
* [html](#html) - render HTML.
* [md](#markdown) - render Markdown.
* [svg](#svg) - render SVG.
* [tex](#tex) - render LaTeX.
* [now](#now) - the current value of Date.now.
* [width](#width) - the current page width.
* [invalidation](#invalidation) - dispose resources.
* [visibility](#visibility) - wait for visibility.

### DOM

<a href="#DOM_canvas" name="DOM_canvas">#</a> DOM.<b>canvas</b>(<i>width</i>, <i>height</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/canvas.js "Source")

Returns a new canvas element with the specified *width* and *height*. For example, to create a 960×500 canvas:

```js
DOM.canvas(960, 500)
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<canvas width=960 height=500>`
```

If you are using [2D Canvas](https://www.w3.org/TR/2dcontext/) (rather than [WebGL](https://webglfundamentals.org/)), you should use [DOM.context2d](#DOM_context2d) instead of DOM.canvas for automatic pixel density scaling.

<a href="#DOM_context2d" name="DOM_context2d">#</a> DOM.<b>context2d</b>(<i>width</i>, <i>height</i>[, <i>dpi</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/context2d.js "Source")

Returns a new canvas context with the specified *width* and *height* and the specified device pixel ratio *dpi*. If *dpi* is not specified, it defaults to [*window*.devicePixelRatio](https://developer.mozilla.org/docs/Web/API/Window/devicePixelRatio). To access the context’s canvas, use [*context*.canvas](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/canvas). For example, to create a 960×500 canvas:

```js
{
  const context = DOM.context2d(960, 500);
  return context.canvas;
}
```

If you are using [WebGL](https://webglfundamentals.org/) (rather than [2D Canvas](https://www.w3.org/TR/2dcontext/)), you should use [DOM.canvas](#DOM_canvas) or  the [html](#html) tagged template literal instead of DOM.context2d.

<a href="#DOM_download" name="DOM_download">#</a> DOM.<b>download</b>(<i>object</i>\[, <i>name</i>\]\[, <i>value</i>\]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/download.js "Source")

Returns an anchor element containing a button that when clicked will download a file representing the specified *object*. The *object* should be anything supported by [URL.createObjectURL](https://developer.mozilla.org/docs/Web/API/URL/createObjectURL) such as a [file](https://developer.mozilla.org/docs/Web/API/File) or a [blob](https://developer.mozilla.org/docs/Web/API/Blob). For example, to create a button to download a Canvas element as a PNG:

```js
DOM.download(await new Promise(resolve => canvas.toBlob(resolve)))
```

The *object* may also be specified as a function, in which case the function is called when the download button is clicked. For example:

```js
DOM.download(() => new Promise(resolve => canvas.toBlob(resolve)))
```

If the *object* is a promise, or if it is a function that returns a promise, the promise will be awaited before downloading. If necessary, an additional click may be required to download the asynchronous value.

<a href="#DOM_element" name="DOM_element">#</a> DOM.<b>element</b>(<i>name</i>[, <i>attributes</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/element.js "Source")

Returns a new element with the specified *name*. For example, to create an empty H1 element:

```js
DOM.element("h1")
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<h1>`
```

If *attributes* is specified, sets any attributes in the specified object before returning the new element. For example:

```js
DOM.element("a", {target: "_blank"})
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<a target=_blank>`
```

If the *name* has the prefix `svg:`, `math:` or `xhtml:`, uses [*document*.createElementNS](https://developer.mozilla.org/docs/Web/API/Document/createElementNS) instead of [*document*.createElement](https://developer.mozilla.org/docs/Web/API/Document/createElement). For example, to create an empty SVG element (see also [DOM.svg](#DOM_svg)):

```js
DOM.element("svg:svg")
```

This is equivalent to using the [svg](#svg) (or [html](#html)) tagged template literal:

```js
svg`<svg>`
```

In general, you probably want to use the [html](#html) or [svg](#svg) tagged template literal instead of DOM.element.

<a href="#DOM_input" name="DOM_input">#</a> DOM.<b>input</b>([<i>type</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/input.js "Source")

Returns a new input element with the specified *type*. If *type* is not specified or null, a text input is created. For example, to create a new file input:

```js
DOM.input("file")
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<input type=file>`
```

In general, you probably want to use the [html](#html) tagged template literal instead of DOM.input.

<a href="#DOM_range" name="DOM_range">#</a> DOM.<b>range</b>(\[<i>min</i>, \]\[<i>max</i>\]\[, <i>step</i>\]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/range.js "Source")

Returns a new range input element. (See also [DOM.input](#input).) If *max* is specified, sets the maximum value of the range to the specified number; if *max* is not specified or null, sets the maximum value of the range to 1. If *min* is specified, sets the minimum value of the range to the specified number; if *min* is not specified or null, sets the minimum value of the range to 0. If *step* is specified, sets the step value of the range to the specified number; if *step* is not specified or null, sets the step value of the range to `any`. For example, to create a slider that ranges the integers from -180 to +180, inclusive:

```js
DOM.range(-180, 180, 1)
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<input type=range min=-180 max=180 step=1>`
```

In general, you probably want to use the [html](#html) tagged template literal instead of DOM.input.

<a href="#DOM_select" name="DOM_select">#</a> DOM.<b>select</b>(<i>values</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/select.js "Source")

Returns a new select element with an option for each string in the specified *values* array. For example, to create a drop-down menu of three colors:

```js
DOM.select(["red", "green", "blue"])
```

This is equivalent to using the [html](#html) tagged template literal:

```js
html`<select>
  <option value="red">red</option>
  <option value="green">green</option>
  <option value="blue">blue</option>
</select>`
```

Or, from an array of data:

```js
html`<select>${colors.map(color => `
  <option value="${color}">${color}</option>`)}
</select>`
```

In general, you probably want to use the [html](#html) tagged template literal instead of DOM.select, particularly if you want greater control of the display, such as to customize the displayed option labels.

<a href="#DOM_svg" name="DOM_svg">#</a> DOM.<b>svg</b>(<i>width</i>, <i>height</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/svg.js "Source")

Returns a new SVG element with the specified *width* and *height*. For example, to create a 960×500 blank SVG:

```js
DOM.svg(960, 500)
```

This is equivalent to using the [svg](#svg) tagged template literal:

```js
svg`<svg width=960 height=500 viewBox="0,0,960,500">`
```

To create responsive SVG, set the max-width to 100% and the height to auto:

```js
svg`<svg
  width=960
  height=500
  viewBox="0,0,960,500"
  style="max-width:100%;height:auto;"
>`
```

In general, you probably want to use the [html](#html) or [svg](#svg) tagged template literal instead of DOM.svg.

<a href="#DOM_text" name="DOM_text">#</a> DOM.<b>text</b>(<i>string</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/text.js "Source")

Returns a new text node with the specified *string* value. For example, to say hello:

```js
DOM.text("Hello, world!")
```

This is equivalent to using the [html](#html) tagged template literal:


```js
html`Hello, world!`
```

In general, you probably want to use the [html](#html) tagged template literal instead of DOM.text.

<a href="#DOM_uid" name="DOM_uid">#</a> DOM.<b>uid</b>([<i>name</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/dom/uid.js "Source")

Returns a new unique *identifier*. If *name* is specified, the *identifier*.id will be derived from the specified *name*, which may be useful for debugging. If DOM.uid is called repeatedly with the same *name*, every returned *identifier* is still unique (that is, different). Identifiers are useful in SVG: use *identifier*.href for IRI references, such as the [xlink:href](https://www.w3.org/TR/SVG/animate.html#HrefAttribute) attribute; use *identifier*.toString for functional notation, such as the [clip-path](https://www.w3.org/TR/SVG/masking.html#ClipPathProperty) presentation attribute.

For example, to [clip the Mona Lisa](https://observablehq.com/@mbostock/svg-clipping-test) to a circle of radius 320px:

```js
{
  const clip = DOM.uid("clip");
  return svg`<svg width="640" height="640">
  <defs>
    <clipPath id="${clip.id}">
      <circle cx="320" cy="320" r="320"></circle>
    </clipPath>
  </defs>
  <image
    clip-path="${clip}"
    width="640" height="640"
    preserveAspectRatio="xMidYMin slice"
    xlink:href="https://gist.githubusercontent.com/mbostock/9511ae067889eefa5537eedcbbf87dab/raw/944b6e5fe8dd535d6381b93d88bf4a854dac53d4/mona-lisa.jpg"
  ></image>
</svg>`;
}
```

The use of DOM.uid is strongly recommended over hand-coding as it ensures that your identifiers are still unique if your code is imported into another notebook. Because *identifier*.href and *identifier*.toString return absolute rather than local IRIs, it also works well in conjunction with a notebook’s [base URL](https://developer.mozilla.org/docs/Web/HTML/Element/base).

### Files

See [Reading Local Files](https://observablehq.com/@mbostock/reading-local-files) for examples.

<a href="#Files_buffer" name="Files_buffer">#</a> Files.<b>buffer</b>(<i>file</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/files/buffer.js "Source")

Reads the specified *file*, returning a promise of the ArrayBuffer yielded by [*fileReader*.readAsArrayBuffer](https://developer.mozilla.org/docs/Web/API/FileReader/readAsArrayBuffer). This is useful for reading binary files, such as shapefiles and ZIP archives.

<a href="#Files_text" name="Files_text">#</a> Files.<b>text</b>(<i>file</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/files/text.js "Source")

Reads the specified *file*, returning a promise of the string yielded by [*fileReader*.readAsText](https://developer.mozilla.org/docs/Web/API/FileReader/readAsText). This is useful for reading text files, such as plain text, CSV, Markdown and HTML.

<a href="#Files_url" name="Files_url">#</a> Files.<b>url</b>(<i>file</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/files/url.js "Source")

Reads the specified *file*, returning a promise of the data URL yielded by [*fileReader*.readAsDataURL](https://developer.mozilla.org/docs/Web/API/FileReader/readAsDataURL). This is useful for reading a file into memory, represented as a data URL. For example, to display a local file as an image:

```js
Files.url(file).then(url => {
  var image = new Image;
  image.src = url;
  return image;
})
```

A data URL may be significantly less efficient than [URL.createObjectURL](https://developer.mozilla.org/docs/Web/API/URL/createObjectURL) method for large files. For example:

```js
{
  const image = new Image;
  image.src = URL.createObjectURL(file);
  invalidation.then(() => URL.revokeObjectURL(image.src));
  return image;
}
```

### File Attachments

See [File Attachments](https://observablehq.com/@observablehq/file-attachments) on Observable for examples.

<a href="#FileAttachment" name="FileAttachment">#</a> <b>FileAttachment</b>(<i>name</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns the file attachment with the given *name*, or throws an error if there is no file with the given name.

```js
photo = FileAttachment("sunset.jpg")
```

FileAttachments work similarly to the [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch), providing methods that return promises to the file’s contents in a handful of convenient forms.

<a href="#attachment_url" name="attachment_url">#</a> *attachment*.<b>url</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the URL at which the file may be retrieved.

```js
const url = await FileAttachment("file.txt").url();
```

<a href="#attachment_text" name="attachment_text">#</a> *attachment*.<b>text</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file’s contents as a JavaScript string.

```js
const hello = await FileAttachment("hello.txt").text();
```

<a href="#attachment_json" name="attachment_json">#</a> *attachment*.<b>json</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file’s contents, parsed as JSON into JavaScript values.

```js
const logs = await FileAttachment("weekend-logs.json").json();
```

<a href="#attachment_csv" name="attachment_csv">#</a> *attachment*.<b>csv</b>({<i>array</i> = false, <i>typed</i> = false} = {}) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file’s contents, parsed as comma-separated values (CSV) into an array.

```js
const data = await FileAttachment("cars.csv").csv();
```

If <i>array</i> is true, an array of arrays is returned; otherwise, the first row is assumed to be the header row and an array of objects is returned, and the returned array has a <i>data</i>.columns property that is an array of column names. (See <a href="https://github.com/d3/d3-dsv/blob/main/README.md#dsv_parseRows">d3.csvParseRows</a>.) If <i>typed</i> is true, [automatic type inference](https://observablehq.com/@d3/d3-autotype) is applied; only use this feature if you know your data is compatible.

<a href="#attachment_csv" name="attachment_tsv">#</a> *attachment*.<b>tsv</b>({<i>array</i> = false, <i>typed</i> = false} = {}) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file’s contents, parsed as tab-separated values (TSV) into an array.

```js
const data = await FileAttachment("cars.tsv").tsv();
```

If <i>array</i> is true, an array of arrays is returned; otherwise, the first row is assumed to be the header row and an array of objects is returned, and the returned array has a <i>data</i>.columns property that is an array of column names. (See <a href="https://github.com/d3/d3-dsv/blob/main/README.md#dsv_parseRows">d3.tsvParseRows</a>.) If <i>typed</i> is true, [automatic type inference](https://observablehq.com/@d3/d3-autotype) is applied to each row independently; if <i>typed</i> is “auto”, the type inference is based on a sample of rows. Only use this feature if you know your data is compatible.

<a href="#attachment_image" name="attachment_image">#</a> *attachment*.<b>image</b>(<i>options</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to a file loaded as an [Image](https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/Image). The promise resolves when the image has finished loading, making this useful for reading the image pixels in Canvas, or for loading the image into a WebGL texture. Consider [*attachment*.url](#attachment_url) if you want to embed an image in HTML or Markdown.

```js
const image = await FileAttachment("sunset.jpg").image();
```

If desired, additional image properties can be passed in as *options*.

```js
const image = await FileAttachment("sunset.jpg").image({width: 400, height: 400});
```

<a href="#attachment_arrayBuffer" name="attachment_arrayBuffer">#</a> *attachment*.<b>arrayBuffer</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file’s contents as an [ArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/ArrayBuffer).

```js
const city = shapefile.read(await FileAttachment("sf.shp").arrayBuffer());
```

<a href="#attachment_stream" name="attachment_stream">#</a> *attachment*.<b>stream</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to a [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/Streams_API) of the file’s contents.

```js
const stream = await FileAttachment("metrics.csv").stream();
const reader = stream.getReader();
let done, value;
while (({done, value} = await reader.read()), !done) {
  yield value;
}
```

<a href="#attachment_blob" name="attachment_blob">#</a> *attachment*.<b>blob</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to a [Blob](https://developer.mozilla.org/en-US/docs/Web/API/Blob) containing the raw contents of the file.

```js
const blob = await FileAttachment("binary-data.dat").blob();
```

<a href="#attachment_sqlite" name="attachment_sqlite">#</a> *attachment*.<b>sqlite</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to the file loaded as a [SQLite database client](https://observablehq.com/@observablehq/databases).

```js
const db = await FileAttachment("chinook.db").sqlite();
```

<a href="#attachment_xlsx" name="attachment_xlsx">#</a> *attachment*.<b>xlsx</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/xlsx.js "Source")

Returns a promise to the file loaded as a [Workbook](https://observablehq.com/@observablehq/xlsx).

```js
const workbook = await FileAttachment("profit-and-loss.xlsx").xlsx();
const sheet = workbook.sheet("Sheet1", {range: "B4:AF234", headers: true});
```

<a href="#attachment_xml" name="attachment_xml">#</a> *attachment*.<b>xml</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to an [XMLDocument](https://developer.mozilla.org/en-US/docs/Web/API/XMLDocument) containing the contents of the file.

```js
const document = await FileAttachment("cars.xml").xml();
```

<a href="#attachment_html" name="attachment_html">#</a> *attachment*.<b>html</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to an [HTMLDocument](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDocument) containing the contents of the file.

```js
const document = await FileAttachment("index.html").html();
```

<a href="#attachment_zip" name="attachment_zip">#</a> *attachment*.<b>zip</b>() [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a promise to a [ZipArchive](#zip-archives) containing the contents of the file.

```js
const archive = await FileAttachment("archive.zip").zip();
```

<a href="#FileAttachments" name="FileAttachments">#</a> <b>FileAttachments</b>(<i>resolve</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

*Note: this function is not part of the Observable standard library (in notebooks), but is provided by this module as a means for defining custom file attachment implementations when working directly with the Observable runtime.*

Returns a [*FileAttachment*](#FileAttachment) function given the specified *resolve* function. The *resolve* function is a function that takes a *name* and returns either an object {url, mimeType} representing the requested file if it exists, or null if the file does not exist. The url field (though not the object itself!) may be represented as a Promise if the URL is not yet known, such as for a file that is currently being uploaded. The mimeType must be a string, or undefined if the mime type is not known. For backwards compatibility, the *resolve* function may instead return just a URL, either a string or a promise.

#### Zip archives

<a href="#ZipArchive_filenames" name="ZipArchive_filenames">#</a> *archive*.<b>filenames</b> [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns an array of paths representing the files contained within the archive.

```js
const archive = await FileAttachment("archive.zip").zip();
console.log(archive.filenames);
```

<a href="#ZipArchive_file" name="ZipArchive_file">#</a> *archive*.<b>file</b>(<i>path</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/fileAttachment.js "Source")

Returns a [file attachment](#file-attachments) for the file with the specified *path*. One of the file attachment methods can then be called to access the contents of the file. For example, to read a text file, use [*attachment*.text](#attachment_text).

```js
const archive = await FileAttachment("archive.zip").zip();
const text = await archive.file("readme.txt").text();
```

### Generators

<a href="#Generators_disposable" name="Generators_disposable">#</a> Generators.<b>disposable</b>(<i>value</i>, <i>dispose</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/disposable.js "Source")

Returns a new generator that yields the specified *value* exactly once. The [*generator*.return](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return) method of the generator will call the specified *dispose* function, passing in the specified *value*. When this generator is the return value of a cell, this allows resources associated with the specified *value* to be disposed automatically when a cell is re-evaluated: *generator*.return is called by the Observable runtime on invalidation.  For example, to define a cell that creates a self-disposing [Tensor](https://js.tensorflow.org/):

```js
x = Generators.disposable(tf.tensor2d([[0.0, 2.0], [4.0, 6.0]]), x => x.dispose())
```

See also [invalidation](#invalidation).

<a href="#Generators_filter" name="Generators_filter">#</a> Generators.<b>filter</b>(<i>iterator</i>, <i>test</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/filter.js "Source")

Returns a generator that yields a subset of values from the specified *iterator*, if and only if the specified *test* function returns truthy for the given value. The *test* function is invoked with the current value from the *iterator* and the current index, starting at 0 and increasing by one. For example, to yield only odd integers in [0, 100]:

```js
x = Generators.filter(Generators.range(100), x => x & 1)
```

This method assumes that the specified *iterator* is synchronous; if the *iterator* yields a promise, this method does not wait for the promise to resolve before continuing. If the specified *iterator* is a generator, this method also does not (currently) wrap the specified generator’s [return](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return) and [throw](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/throw) methods.

<a href="#Generators_input" name="Generators_input">#</a> Generators.<b>input</b>(<i>input</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/input.js "Source")

Returns a new generator that yields promises to the current value of the specified *input* element; each promise resolves when the *input* element emits an event. (The promise resolves when the event is emitted, even if the value of the input is unchanged.) If the initial value of the *input* is not undefined, the returned generator’s first yielded value is a resolved promise with the initial value of the *input*.

The type of event that triggers promise resolution depends on the *input*.type as follows:

* For button, submit and checkbox inputs, *click* events.
* For file inputs, *change* events.
* For all other types, *input* events.

The resolved value is likewise dependent on the *input*.type as follows:

* For range and number inputs, *input*.valueAsNumber.
* For date inputs, *input*.valueAsDate.
* For checkbox inputs, *input*.checked.
* For single-file inputs (*input*.multiple is falsey), *input*.files[0].
* For multi-file inputs (*input*.multiple is truthy), *input*.files.
* For all other types, *input*.value.

The specified *input* need not be an HTMLInputElement, but it must support the *target*.addEventListener and *target*.removeEventListener methods of the [EventTarget interface](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener).

Generators.input is used by Observable’s [viewof operator](https://observablehq.com/@observablehq/a-brief-introduction-to-viewof) to define the current value of a view, and is based on [Generators.observe](#Generators_observe). One often does not use Generators.input directly, but it can be used to define a [generator cell](https://observablehq.com/@mbostock/generator-cells-functions-and-objects) exposing the current value of an input, and you can also read the yielded values by hand. For example, to accumulate the first four values:

```js
{
  const values = [];
  for (const value of Generators.input(element)) {
    if (values.push(await value) >= 4) {
      return values;
    }
  }
}
```

Generators.input is lossy and may skip values: if more than one event is emitted before the next promise is pulled from the generator (more than once per animation frame), then the next promise returned by the generator will be resolved with the latest *input* value, potentially skipping intermediate values. See [Generators.queue](#Generators_queue) for a non-debouncing generator.

<a href="#Generators_map" name="Generators_map">#</a> Generators.<b>map</b>(<i>iterator</i>, <i>transform</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/map.js "Source")

Returns a generator that yields transformed values from the specified *iterator*, applying the specified *transform* function to each value. The *transform* function is invoked with the current value from the *iterator* and the current index, starting at 0 and increasing by one. For example, to yield perfect squares:

```js
x = Generators.map(Generators.range(100), x => x * x)
```

This method assumes that the specified *iterator* is synchronous; if the *iterator* yields a promise, this method does not wait for the promise to resolve before continuing. If the specified *iterator* is a generator, this method also does not (currently) wrap the specified generator’s [return](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return) and [throw](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/throw) methods.

<a href="#Generators_observe" name="Generators_observe">#</a> Generators.<b>observe</b>(<i>initialize</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/observe.js "Source")

Returns a generator that yields promises to an observable value, adapting a push-based data source (such as an [Observable](https://github.com/tc39/proposal-observable/blob/master/README.md), an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) or an [EventTarget](https://developer.mozilla.org/docs/Web/API/EventTarget)) to a pull-based one.

The specified *initialize* function is invoked before Generators.observe returns, being passed a *change* function; calling *change* triggers the resolution of the current promise with the passed value. The *initialize* function may also return a *dispose* function; this function will be called when the generator is [disposed](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return). (See [invalidation](#invalidation).)

For example, to observe the current value of a text input element, you might say:

```js
Generators.observe(change => {

  // An event listener to yield the element’s new value.
  const inputted = () => change(element.value);

  // Attach the event listener.
  element.addEventListener("input", inputted);

  // Yield the element’s initial value.
  change(element.value);

  // Detach the event listener when the generator is disposed.
  return () => element.removeEventListener("input", inputted);
})
```

(See also [Generators.input](#Generators_input).)

Generators.observe is typically used to define a [generator cell](https://observablehq.com/@mbostock/generator-cells-functions-and-objects), but you can also read the yielded values by hand. For example, to accumulate the first four values:

```js
{
  const generator = Generators.observe(…);
  const values = [];
  for (const value of generator) {
    if (values.push(await value) >= 4) {
      return values;
    }
  }
}
```

Generators.observe is lossy and may skip values: if *change* is called more than once before the next promise is pulled from the generator (more than once per animation frame), then the next promise returned by the generator will be resolved with the latest value passed to *change*, potentially skipping intermediate values. See [Generators.queue](#Generators_queue) for a non-debouncing generator.

<a href="#Generators_queue" name="Generators_queue">#</a> Generators.<b>queue</b>(<i>initialize</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/queue.js "Source")

Returns a generator that yields promises to an observable value, adapting a push-based data source (such as an [Observable](https://github.com/tc39/proposal-observable/blob/master/README.md), an [EventEmitter](https://nodejs.org/api/events.html#events_class_eventemitter) or an [EventTarget](https://developer.mozilla.org/docs/Web/API/EventTarget)) to a pull-based one. The specified *initialize* function is invoked before Generators.queue returns, being passed a *change* function; calling *change* triggers the resolution of the current promise with the passed value. The *initialize* function may also return a *dispose* function; this function will be called when the generator is [disposed](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return). (See [invalidation](#invalidation).)

For example, to observe the value of a text input element, you might say:

```js
Generators.queue(change => {

  // An event listener to yield the element’s new value.
  const inputted = () => change(element.value);

  // Attach the event listener.
  element.addEventListener("input", inputted);

  // Yield the element’s initial value.
  change(element.value);

  // Detach the event listener when the generator is disposed.
  return () => element.removeEventListener("input", inputted);
})
```

(See also [Generators.input](#Generators_input).)

Generators.queue is typically used to define a [generator cell](https://observablehq.com/@mbostock/generator-cells-functions-and-objects), but you can also read the yielded values by hand. For example, to accumulate the first four values:

```js
{
  const generator = Generators.queue(…);
  const values = [];
  for (const value of generator) {
    if (values.push(await value) >= 4) {
      return values;
    }
  }
}
```

Generators.queue is non-lossy and, as a result, may yield “stale” values: if *change* is called more than once before the next promise is pulled from the generator (more than once per animation frame), the passed values are queued in order and the generator will return resolved promises until the queue is empty again. See [Generators.observe](#Generators_observe) for a debouncing generator.

<a href="#Generators_range" name="Generators_range">#</a> Generators.<b>range</b>([<i>start</i>, ]<i>stop</i>[, <i>step</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/range.js "Source")

Returns a generator yielding an arithmetic progression, similar to the Python built-in [range](https://docs.python.org/3/library/stdtypes.html#typesseq-range). This method is often used to iterate over a sequence of uniformly-spaced numeric values, such as the indexes of an array or the ticks of a linear scale. (See also [d3.range](https://github.com/d3/d3-array/blob/main/README.md#range).)

For example, to iterator over the integers from 0 to 100:

```js
i = {
  for (const i of Generators.range(0, 100, 1)) {
    yield i;
  }
}
```

Or more simply:

```js
i = Generators.range(100)
```

If *step* is omitted, it defaults to 1. If *start* is omitted, it defaults to 0. The *stop* value is exclusive; it is not included in the result. If *step* is positive, the last element is the largest *start* + *i* \* *step* less than *stop*; if *step* is negative, the last element is the smallest *start* + *i* \* *step* greater than *stop*. If the returned array would contain an infinite number of values, an empty range is returned.

The arguments are not required to be integers; however, the results are more predictable if they are. The values in the returned array are defined as *start* + *i* \* *step*, where *i* is an integer from zero to the total number of elements in the returned array minus one. For example:

```js
Generators.range(0, 1, 0.2) // 0, 0.2, 0.4, 0.6000000000000001, 0.8
```

This unexpected behavior is due to IEEE 754 double-precision floating point, which defines 0.2 * 3 = 0.6000000000000001. Use [d3-format](https://github.com/d3/d3-format) to format numbers for human consumption with appropriate rounding.

Likewise, if the returned array should have a specific length, consider using [*array*.map](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/map) on an integer range. For example:

```js
[...Generators.range(0, 1, 1 / 49)] // BAD: returns 50 elements!
```

```js
[...Generators.range(49)].map(d => d / 49) // GOOD: returns 49 elements.
```


<a href="#Generators_valueAt" name="Generators_valueAt">#</a> Generators.<b>valueAt</b>(<i>iterator</i>, <i>index</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/valueAt.js "Source")

Returns the value from the specified *iterator* at the specified *index*. For example, to return the first element from the iterator:

```js
first = Generators.valueAt(iterator, 0)
```

This method assumes that the specified *iterator* is synchronous; if the *iterator* yields a promise, this method does not wait for the promise to resolve before continuing.

<a href="#Generators_worker" name="Generators_worker">#</a> Generators.<b>worker</b>(<i>source</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/generators/worker.js "Source")

Returns a new [disposable generator](#Generators_disposable) that yields a [dedicated Worker](https://developer.mozilla.org/docs/Web/API/Web_Workers_API) running the specified JavaScript *source*. For example, to create a worker that echos messages sent to it:

```js
worker = Generators.worker(`
onmessage = function({data}) {
  postMessage({echo: data});
};
`)
```

The worker will be automatically [terminated](https://developer.mozilla.org/docs/Web/API/Worker/terminate) when [*generator*.return](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Generator/return) is called.

### Promises

<a href="#Promises_delay" name="Promises_delay">#</a> Promises.<b>delay</b>(<i>duration</i>[, <i>value</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/promises/delay.js "Source")

Returns a promise that resolves with the specified *value* after the specified *duration* in milliseconds. For example, to define a cell that increments approximately every second:

```js
i = {
  let i = 0;
  yield i;
  while (true) {
    yield Promises.delay(1000, ++i);
  }
}
```

If you desire precise synchronization, such as a timer that ticks exactly every second, use [Promises.tick](#Promises_tick) instead of Promises.delay.

<a href="#Promises_tick" name="Promises_tick">#</a> Promises.<b>tick</b>(<i>duration</i>[, <i>value</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/promises/tick.js "Source")

Returns a promise that resolves with the specified *value* at the next integer multiple of *milliseconds* since the UNIX epoch. This is much like [Promises.delay](#Promises_delay), except it allows promises to be synchronized. For example, to define a cell that increments every second, on the second:

```js
i = {
  let i = 0;
  yield i;
  while (true) {
    yield Promises.tick(1000, ++i);
  }
}
```

Or, as an async generator:

```js
i = {
  let i = 0;
  while (true) {
    yield i++;
    await Promises.tick(1000);
  }
}
```

<a href="#Promises_when" name="Promises_when">#</a> Promises.<b>when</b>(<i>date</i>[, <i>value</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/promises/when.js "Source")

Returns a promise that resolves with the specified *value* at the specified *date*. This method relies on [setTimeout](https://developer.mozilla.org/docs/Web/API/WindowOrWorkerGlobalScope/setTimeout), and thus the specified *date* must be no longer than 2,147,483,647 milliseconds (24.9 days) from now.

### Specials

<a href="#invalidation" name="invalidation">#</a> <b>invalidation</b>

A promise that resolves when the current cell is re-evaluated: when the cell’s code changes, when it is run using Shift-Enter, or when a referenced input changes. This promise is typically used to dispose of resources that were allocated by the cell. For example, to abort a fetch if the cell is invalidated:

```js
{
  const controller = new AbortController;
  invalidation.then(() => controller.abort());
  const response = await fetch(url, {signal: controller.signal});
  return response.json();
}
```

The invalidation promise is provided by the runtime rather than the standard library because it resolves to a new promise each time a cell is evaluated. See also [Generators.disposable](#Generators_disposable).

<a href="#now" name="now">#</a> <b>now</b> [<>](https://github.com/observablehq/stdlib/blob/main/src/now.js "Source")

The current value of [Date.now](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Date/now). For example, to display the current time in Markdown:

```js
md`The current time is: ${new Date(now).toISOString()}`
```

<a href="#width" name="width">#</a> <b>width</b> [<>](https://github.com/observablehq/stdlib/blob/main/src/width.js "Source")

The current width of cells. For example, to make a rounded rectangle in SVG that resizes to fit the page:

```js
html`<svg width=${width} height=200>
  <rect width=${width} height=200 rx=10 ry=10></rect>
</svg>`
```

<a href="#visibility" name="visibility">#</a> <b>visibility</b>([<i>value</i>]) [<>](https://github.com/observablehq/runtime/blob/main/src/runtime.js "Source")

Returns a promise that resolves with the specified *value* when this cell is visible in the viewport. The visibility function is provided by the runtime rather than the standard library because it resolves to a different function for each cell.

### HTML

<a href="#html" name="html">#</a> <b>html</b>\`<i>string</i>\` [<>](https://github.com/observablehq/stdlib/blob/main/src/html.js "Source")

Returns the HTML element represented by the specified HTML *string* literal. This function is intended to be used as a [tagged template literal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals_and_escape_sequences). Leading and trailing whitespace is automatically trimmed. For example, to create an H1 element whose content is “Hello, world!”:

```js
html`<h1>Hello, world!`
```

If the resulting HTML fragment is not a single HTML element or node, is it wrapped in a DIV element. For example, this expression:

```js
html`Hello, <b>world</b>!`
```

Is equivalent to this expression:

```js
html`<div>Hello, <b>world</b>!</div>`
```

If an embedded expression is a DOM element, it is embedded in generated HTML. For example, to embed [TeX](#tex) within HTML:

```js
html`I like ${tex`\KaTeX`} for math.`
```

If an embedded expression is an array, the elements of the array are embedded in the generated HTML. For example, to create a table from an array of values:

```js
html`<table>
  <tbody>${["zero", "one", "two"].map((name, i) => html`<tr>
    <td>${name}</td><td>${i}</td>
  </tr>`)}</tbody>
</table>`
```

<a href="#svg" name="svg">#</a> <b>svg</b>\`<i>string</i>\` [<>](https://github.com/observablehq/stdlib/blob/main/src/svg.js "Source")

Returns the SVG element represented by the specified SVG *string* literal. This function is intended to be used as a [tagged template literal](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Template_literals#Tagged_template_literals_and_escape_sequences). Leading and trailing whitespace is automatically trimmed. For example, to create an SVG element whose content is a circle:

```js
svg`<svg width=16 height=16>
  <circle cx=8 cy=8 r=4></circle>
</svg>`
```

If the resulting SVG fragment is not a single SVG element, is it wrapped in a G element. For example, this expression:

```js
svg`
<circle cx=8 cy=4 r=4></circle>
<circle cx=8 cy=8 r=4></circle>
`
```

Is equivalent to this expression:

```js
svg`<g>
  <circle cx=8 cy=4 r=4></circle>
  <circle cx=8 cy=8 r=4></circle>
</g>`
```

If an embedded expression is a DOM element, it is embedded in generated SVG. If an embedded expression is an array, the elements of the array are embedded in the generated SVG.

### Markdown

<a href="#md" name="md">#</a> <b>md</b>\`<i>string</i>\` [<>](https://github.com/observablehq/stdlib/blob/main/src/md.js "Source")

Returns the HTML element represented by the specified Markdown *string* literal. Implemented by [Marked](https://github.com/markedjs/marked). Leading and trailing whitespace is automatically trimmed. For example, to create an H1 element whose content is “Hello, world!”:

```js
md`# Hello, world!`
```

If an embedded expression is a DOM element, it is embedded in generated HTML. For example, to embed [LaTeX](#tex) within Markdown:

```js
md`My *favorite* number is ${tex`\tau`}.`
```

If an embedded expression is an array, the elements of the array are embedded in the generated HTML. The elements may either be strings, which are interpreted as Markdown, or DOM elements. For example, given an array of data:

```js
elements = [
  {symbol: "Co", name: "Cobalt", number: 27},
  {symbol: "Cu", name: "Copper", number: 29},
  {symbol: "Sn", name: "Tin", number: 50},
  {symbol: "Pb", name: "Lead", number: 82}
]
```

To create a table:

```js
md`
| Name      | Symbol      | Atomic number |
|-----------|-------------|---------------|${elements.map(e => `
| ${e.name} | ${e.symbol} | ${e.number}   |`)}
`
```

### TeX

<a href="#tex" name="tex">#</a> <b>tex</b>\`<i>string</i>\` [<>](https://github.com/observablehq/stdlib/blob/main/src/tex.js "Source")

Returns the HTML element represented by the specified LaTeX *string* literal. Implemented by [KaTeX](https://github.com/Khan/KaTeX).

```js
tex`E = mc^2`
```

<a href="#tex_block" name="tex_block">#</a> tex.<b>block</b>\`<i>string</i>\` [<>](https://github.com/observablehq/stdlib/blob/main/src/tex.js "Source")

Equivalent to [tex](#tex), but uses KaTeX’s display mode to produce a bigger block element rather than a smaller inline element.

```js
tex.block`E = mc^2`
```

<a href="#tex_options" name="tex_options">#</a> tex.<b>options</b>(<i>options</i>) [<>](https://github.com/observablehq/stdlib/blob/main/src/tex.js "Source")

Returns a function equivalent to [tex](#tex), but with the specified *options*.

```js
tex.options({displayMode: true})`E = mc^2`
```

### require

<a href="#require" name="require">#</a> <b>require</b>(<i>names…</i>) [<>](https://github.com/d3/d3-require/blob/main/index.js "Source")

Returns a promise of the [asynchronous module definition](https://github.com/amdjs/amdjs-api/blob/master/AMD.md) (AMD) with the specified *names*, loaded from npm. Each module *name* can be a package (or scoped package) name optionally followed by the at sign (`@`) and a semver range. For example, to load [d3-array](https://github.com/d3/d3-array):

```js
d3 = require("d3-array")
```

Or, to load [d3-array](https://github.com/d3/d3-array) and [d3-color](https://github.com/d3/d3-color) and merge them into a single object:

```js
d3 = require("d3-array", "d3-color")
```

Or, to load [d3-array](https://github.com/d3/d3-array) 1.1.x:

```js
d3 = require("d3-array@1.1")
```

See [d3-require](https://github.com/d3/d3-require) for more information.

<a href="#require_resolve" name="require_resolve">#</a> require.<b>resolve</b>(<i>name</i>) [<>](https://github.com/d3/d3-require/blob/main/index.js "Source")

Returns a promise to the resolved URL to require the module with the specified *name*. For example:

```js
require.resolve("d3-array") // "https://cdn.jsdelivr.net/npm/d3-array@2.0.3/dist/d3-array.min.js"
```

<a href="#require_alias" name="require_alias">#</a> require.<b>alias</b>(<i>aliases</i>) [<>](https://github.com/d3/d3-require/blob/main/index.js "Source")

Returns a [require function](#require) with the specified *aliases*. For each key in the specified *aliases* object, any require of that key is substituted with the corresponding value. For example:

```js
React = require("react@16/umd/react.production.min.js")
```
```js
ReactDOM = require("react-dom@16/umd/react-dom.production.min.js")
```
```js
Semiotic = require.alias({"react": React, "react-dom": ReactDOM})("semiotic@1")
```

Equivalently:

```js
r = require.alias({
  "react": "react@16/umd/react.production.min.js",
  "react-dom": "react-dom@16/umd/react-dom.production.min.js",
  "semiotic": "semiotic@1"
})
```

Then to require the libraries:

```js
React = r("react")
```
```js
ReactDOM = r("react-dom")
```
```js
Semiotic = r("semiotic")
```

## Installing

The Observable standard library is built-in to Observable, so you don’t normally need to install or instantiate it directly. If you use NPM, `npm install @observablehq/stdlib`.

<a href="#Library" name="Library">#</a> <b>Library</b>([<i>resolve</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/library.js "Source")

Returns a new standard library object. If a *resolve* function is specified, it is a function that returns a promise to the URL of the module with the specified *name*; this is used internally by [require](#require) (and by extension, [md](#md) and [tex](#tex)). See [d3-require](https://github.com/d3/d3-require/blob/main/README.md) for details.

For example, to create the default standard library, and then use it to create a [canvas](#DOM_canvas):

```js
const library = new Library();
const canvas = library.DOM.canvas(960, 500);
```

The properties on the returned *library* instance correspond to the symbols (documented above) that are available in Observable notebooks. However, note that the library fields (such as *library*.now) are *definitions*, not values: the values may be wrapped in a function which, when invoked, returns the corresponding value.

<a href="#Library_resolve" name="Library_resolve">#</a> Library.<b>resolve</b>(<i>name</i>[, <i>base</i>]) [<>](https://github.com/observablehq/stdlib/blob/main/src/library.js "Source")

An alias for [d3.require.resolve](https://github.com/d3/d3-require/blob/main/README.md#require_resolve).
