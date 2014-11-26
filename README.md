# m.js - simple module manager

## Why m.js?

I wanted to try my hand at building a javascript module manager. Yeah,
it's kinda pointless aside from the fact that it was fun to
implement. There's require.js, or http://browserify.org/ out there if
you're looking for one that's "well supported."

## How does it work?

In a javascript file, run this:

```javascript
m.module({
  name : "polyfills",
  src  : document.currentScript.src,
  dependencies :
  {
    name : "url,relative-to-this-module"
  }
});
```
