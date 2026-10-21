/* CppPhone C++ runner — runs programs in a Web Worker so the UI never freezes.
 * Loaded as a classic worker: new Worker('cpprunner.js').
 * Stopping a run = the page terminates this worker and starts a fresh one.
 *
 * Two engines:
 *   offline : JSCPP, a C++ interpreter written in JavaScript (vendor/jscpp.js).
 *             Works with no internet, but only knows a subset of C++.
 *   online  : real g++ on Wandbox (https://wandbox.org). Full C++ and the STL,
 *             but the code is sent to wandbox.org and it needs internet.
 *
 * Messages in  : { type:'run', engine, code, stdin, std }
 * Messages out : { type:'out', text, cls }          cls: 'err' | 'info' | undefined
 *                { type:'done', ok }
 */

importScripts('vendor/jscpp.js');

const WANDBOX_API = 'https://wandbox.org/api/';
const FALLBACK_COMPILER = 'gcc-head';
const MAX_OUTPUT_CHARS = 2 * 1024 * 1024;

function out(text, cls){ postMessage({ type: 'out', text: text, cls: cls }); }

/* ---------- offline: JSCPP ---------- */

const OFFLINE_HEADERS = ['iostream', 'cstdio', 'cmath', 'cstring', 'cstdlib',
  'ctime', 'cctype', 'iomanip', 'stdio.h', 'math.h', 'string.h', 'stdlib.h',
  'time.h', 'ctype.h'];

/* JSCPP has no STL and no classes. Say so up front instead of a parse error. */
function offlineHint(msg){
  const m = /cannot find library: (\S+)/.exec(msg);
  if (m){
    return '\nThe offline engine only has: <' + OFFLINE_HEADERS.slice(0, 8).join('>, <') + '>.\n' +
      '<' + m[1] + '> needs the online engine (real g++). Tap "C++Phone" at the top to switch to Online.\n';
  }
  if (/Parsing Failure/.test(msg)){
    return '\nIf this code is valid C++, it may use a feature the offline engine lacks ' +
      '(classes, templates, std::string, STL). Try the online engine.\n';
  }
  return '';
}

function runOffline(code, stdin){
  /* Batch writes: a print loop would otherwise post one message per character. */
  let buf = '', total = 0, lastFlush = Date.now(), truncated = false;
  function flush(){
    if (buf){ out(buf); buf = ''; }
    lastFlush = Date.now();
  }
  const config = {
    stdio: {
      write(s){
        if (truncated) return;
        total += s.length;
        if (total > MAX_OUTPUT_CHARS){
          truncated = true;
          flush();
          out('\n[output truncated]\n', 'info');
          return;
        }
        buf += s;
        if (buf.length > 4096 || Date.now() - lastFlush > 50) flush();
      },
    },
    unsigned_overflow: 'warn',
  };
  try {
    const exitCode = JSCPP.run(code, stdin, config);
    flush();
    out('\n[exit code ' + exitCode + ']\n', 'info');
    postMessage({ type: 'done', ok: exitCode === 0 });
  } catch (err){
    flush();
    const msg = String((err && err.message) || err);
    out(msg.replace(/\s*$/, '\n'), 'err');
    const hint = offlineHint(msg);
    if (hint) out(hint, 'info');
    postMessage({ type: 'done', ok: false });
  }
}

/* ---------- online: g++ on Wandbox ---------- */

let compilerName = null;

/* Pick the newest gcc Wandbox offers for C++; its list changes over time. */
async function pickCompiler(){
  if (compilerName) return compilerName;
  try {
    const resp = await fetch(WANDBOX_API + 'list.json');
    const list = await resp.json();
    const gcc = list.filter(c => c.language === 'C++' && /^gcc-/.test(c.name));
    const head = gcc.find(c => c.name === 'gcc-head');
    compilerName = (head || gcc[0] || {}).name || FALLBACK_COMPILER;
  } catch (e){
    compilerName = FALLBACK_COMPILER;
  }
  return compilerName;
}

async function runOnline(code, stdin, std){
  try {
    const compiler = await pickCompiler();
    out('Compiling with ' + compiler + ' (-std=' + std + ') on wandbox.org...\n', 'info');
    const resp = await fetch(WANDBOX_API + 'compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        compiler: compiler,
        code: code,
        stdin: stdin,
        'compiler-option-raw': '-std=' + std + '\n-O2\n-Wall',
        save: false,
      }),
    });
    if (!resp.ok) throw new Error('wandbox.org answered HTTP ' + resp.status);
    const r = await resp.json();

    if (r.compiler_message){
      const cm = r.compiler_message.replace(/\s*$/, '\n');
      out(cm, String(r.status) === '0' ? 'info' : 'err');
    }
    if (r.program_output) out(r.program_output);
    if (r.program_error) out(r.program_error, 'err');

    if (r.signal) out('\n[killed by ' + r.signal + ']\n', 'err');
    else if (r.status !== undefined) out('\n[exit code ' + r.status + ']\n', 'info');
    postMessage({ type: 'done', ok: String(r.status) === '0' && !r.signal });
  } catch (err){
    out('Online compile failed: ' + String((err && err.message) || err) + '\n', 'err');
    out('Check your internet connection, or switch to the offline engine.\n', 'info');
    postMessage({ type: 'done', ok: false });
  }
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  if (msg.type !== 'run') return;
  const code = String(msg.code || '');
  const stdin = String(msg.stdin || '');
  if (msg.engine === 'online') await runOnline(code, stdin, String(msg.std || 'gnu++20'));
  else runOffline(code, stdin);
};
