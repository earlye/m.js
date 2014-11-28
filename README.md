# m.js - simple module manager

## Why m.js?

I wanted to try my hand at building a javascript module manager. Yeah,
it's kinda pointless aside from the fact that it was fun to
implement. There's require.js, or http://browserify.org/ out there if
you're looking for one that's "well supported."

I suppose it has an advantage in that its code is really short, so it's
pretty easy to figure out what it's doing if the docs aren't enough.
Uncompressed, it's only 6.8k (excluding a polyfill for document.currentScript).
Compressed using uglify-js, it drops to 3.7k, and when that runs through
gzip for compressed HTTP transmission, it drops even further down to 1.3k.

It doesn't include a lot of fluff, either. All it does is allow you to
manage dependencies. You want ajax, http, or dom assistance? Well, those
are other modules.

## How does it work?

In a javascript file, say... app.js, write this:

```javascript
m.module({
  name : "app",
  src  : document.currentScript.src,
  dependencies :
  {
    name : "url,relative-to-this-module"
  },

  main : function() {
    // your app's main entry point
  }
});
```

In your HTML, write this:

```html
<html>
  <head>
    <title>Media Inventory</title>
    <script main="app.js" src="lib/m/m.js"></script>
  </head>
  <body>
  </body>
</html>
```

Here's what happens. Your browser loads the HTML. As a part of this
process, the browser loads and executed m.js. m.js waits until the
entire document is loaded, and then looks in the document for a
&lt;script&gt; element with a "main" attribute. When m.js finds that
element, it loads the script specified by the "main" sttribute, in
this example, app.js, relative to the html document. m.js registers a
callback so it knows when app.js is finished loading. While it loads,
app.js defines a module, which is just an object with "name," "src,"
and "dependencies" attributes. The "name" attribute is used by
m.module to save the module in its list of modules. The "src"
attribute is useful in figuring out where a particular module was
loaded from. The "dependencies" attribute is a list of other modules,
and where m.js can look for them, if they aren't already loaded.
A module may also define a method, "initialize", which m.js will call
after the module and all of its dependencies are loaded. The "main"
module can also define a "main" method, which m.js will call after
the entire dependency tree is loaded.






