# CppPhone

Write and run C++ on your phone or tablet. The C++ sibling of
[PyPhone](https://github.com/rishitmpatel/pyphone): same editor, tabs, snippet
chips, symbol bar, themes and offline install (PWA).

## Two ways to run C++

Tap **C++Phone** in the top bar to switch.

| Engine | How it works | Good | Bad |
| --- | --- | --- | --- |
| **Online (default)** | Sends the code to [Wandbox](https://wandbox.org) and runs it with real g++ | Full C++ and the STL: `string`, `vector`, `map`, classes, templates; pick `-std=c++11` … `c++23` | Needs internet; your code goes to wandbox.org |
| **Offline** | [JSCPP](https://github.com/felixhao28/JSCPP), a C++ interpreter written in JavaScript, bundled in `vendor/jscpp.js` | Runs on the phone, works with no signal | Basic C++ only: no `std::string`, STL, classes or templates |

That is the trade-off: an in-browser interpreter is private and offline but
small; a real compiler needs a server.

Neither engine can pause for typing mid-run, so when the code uses `cin` or
`scanf`, **Run** asks for all the input first. It is saved per tab
(☰ → Program input).

## Files

- `index.html` — the app (editor, tabs, suggestions, menus)
- `cpprunner.js` — Web Worker that runs the program (both engines); Stop terminates it
- `worker.js` — C++ syntax highlighting off the main thread
- `vendor/jscpp.js` — JSCPP 2.0.9 bundled for the browser (MIT)
- `sw.js`, `manifest.json`, `icon*.svg` — offline install

## Run locally

Any static server works, e.g. `python3 -m http.server`, then open
`http://localhost:8000`. On GitHub Pages it works as is.

### Rebuilding `vendor/jscpp.js`

```sh
npm i JSCPP@2.0.9 esbuild
echo 'module.exports={inspect:v=>JSON.stringify(v)}' > util-shim.js
echo 'module.exports={Stream:function(){}}' > stream-shim.js
npx esbuild node_modules/JSCPP/lib/commonjs.js --bundle --minify \
  --platform=browser --format=iife --global-name=JSCPP --target=es2017 \
  --alias:util=./util-shim.js --alias:stream=./stream-shim.js \
  --outfile=vendor/jscpp.js
```
