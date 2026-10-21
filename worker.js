/* CppPhone highlight worker — tokenizes C++ off the main thread */

const HTML_ESCAPES = { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' };
function esc(s){
  return String(s).replace(/[&<>"']/g, c => HTML_ESCAPES[c]);
}

const TOKEN_RE = new RegExp(
  '(?<comment>//[^\\n]*|/\\*[\\s\\S]*?(?:\\*/|(?![\\s\\S])))' +
  '|(?<preproc>^[ \\t]*#[ \\t]*[A-Za-z_]\\w*)' +
  '|(?<header>(?<=#[ \\t]*include[ \\t]*)<[^>\\n]*>)' +
  '|(?<string>R"(?<rawtag>[^(\\s]*)\\([\\s\\S]*?\\)\\k<rawtag>"|(?:u8|[uUL])?"(?:\\\\.|[^"\\\\\\n])*"|(?:u8|[uUL])?\'(?:\\\\.|[^\'\\\\\\n])*\')' +
  '|(?<number>\\b(?:0[xX][0-9a-fA-F\']+|0[bB][01\']+|\\d[\\d\']*(?:\\.\\d[\\d\']*)?(?:[eE][+-]?\\d+)?)[uUlLfF]*)' +
  '|(?<word>[A-Za-z_]\\w*)' +
  '|(?<op>[+\\-*/%=<>!&|^~?:]+)' +
  '|(?<punct>[(){}\\[\\],.;])',
  'gm'
);

const KW_BLUE = new Set(['int','long','short','char','bool','float','double',
  'void','auto','signed','unsigned','const','constexpr','static','extern',
  'inline','volatile','mutable','class','struct','union','enum','namespace',
  'using','typedef','typename','template','public','private','protected',
  'virtual','override','final','friend','operator','this','true','false',
  'nullptr','sizeof','new','delete','explicit','noexcept','decltype',
  'static_cast','dynamic_cast','const_cast','reinterpret_cast','size_t',
  'wchar_t','char16_t','char32_t','NULL']);
const KW_PURPLE = new Set(['if','else','for','while','do','switch','case',
  'default','return','break','continue','goto','try','catch','throw']);
const STD_TYPES = new Set(['std','string','vector','map','set','unordered_map',
  'unordered_set','pair','tuple','array','deque','list','queue','stack',
  'priority_queue','stringstream','istringstream','ostringstream','ifstream',
  'ofstream','fstream','istream','ostream','optional','function','bitset',
  'multiset','multimap','unique_ptr','shared_ptr']);
const BUILTINS = new Set(['cout','cin','cerr','endl','printf','scanf','puts',
  'getline','getchar','putchar','main','max','min','swap','sort','reverse',
  'abs','sqrt','pow','floor','ceil','round','strlen','strcpy','strcmp','memset',
  'rand','srand','time','to_string','stoi','stod','make_pair','accumulate',
  'find','count','lower_bound','upper_bound','setw','setprecision','fixed',
  'exit','malloc','free']);

function highlightCpp(code){
  const tokens = [];
  let last = 0, m;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(code)) !== null){
    if (m[0] === ''){ TOKEN_RE.lastIndex++; continue; }
    if (m.index > last) tokens.push({ t:'plain', v: code.slice(last, m.index) });
    const g = m.groups;
    let kind = 'plain';
    if (g.comment !== undefined) kind = 'comment';
    else if (g.preproc !== undefined) kind = 'preproc';
    else if (g.header !== undefined) kind = 'string';
    else if (g.string !== undefined) kind = 'string';
    else if (g.number !== undefined) kind = 'number';
    else if (g.word !== undefined) kind = 'word';
    else if (g.op !== undefined) kind = 'op';
    else if (g.punct !== undefined) kind = 'punct';
    tokens.push({ t: kind, v: m[0] });
    last = m.index + m[0].length;
  }
  if (last < code.length) tokens.push({ t:'plain', v: code.slice(last) });

  let html = '', prevWord = '';
  for (let i = 0; i < tokens.length; i++){
    const tk = tokens[i];
    if (tk.t === 'word'){
      let j = i + 1;
      while (j < tokens.length && tokens[j].t === 'plain') j++;
      const nx = tokens[j];
      const isCall = nx && nx.v.charAt(0) === '(';
      let cls;
      if (prevWord === 'class' || prevWord === 'struct' || prevWord === 'enum') cls = 'cls';
      else if (KW_BLUE.has(tk.v)) cls = 'kw';
      else if (KW_PURPLE.has(tk.v)) cls = 'cf';
      else if (STD_TYPES.has(tk.v)) cls = 'cls';
      else if (BUILTINS.has(tk.v)) cls = 'bi';
      else if (isCall) cls = 'fn';
      else cls = 'var';
      html += '<span class="' + cls + '">' + esc(tk.v) + '</span>';
      prevWord = tk.v;
    }
    else if (tk.t === 'comment') html += '<span class="com">' + esc(tk.v) + '</span>';
    else if (tk.t === 'preproc') html += '<span class="cf">'  + esc(tk.v) + '</span>';
    else if (tk.t === 'string')  html += '<span class="str">' + esc(tk.v) + '</span>';
    else if (tk.t === 'number')  html += '<span class="num">' + esc(tk.v) + '</span>';
    else if (tk.t === 'op')      html += '<span class="op">'  + esc(tk.v) + '</span>';
    else                         html += esc(tk.v);
  }
  return html;
}

self.onmessage = function(e){
  const { id, code } = e.data;
  try {
    const html = highlightCpp(code);
    self.postMessage({ id, html, ok: true });
  } catch(err){
    self.postMessage({ id, html: '', ok: false, error: String(err) });
  }
};
