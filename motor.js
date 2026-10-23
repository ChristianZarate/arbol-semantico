/* Motor de inferencia: lenguaje natural (español) -> fórmulas proposicionales -> árbol semántico (tableau).
   Sin dependencias. Funciona en el navegador (window.Motor) y en Node (module.exports). */
(function (root) {
  'use strict';

  // ---------- utilidades de texto ----------
  const strip = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const nt = t => strip(t).replace(/[¿?¡!."“”()]/g, '');
  const isComma = t => t === ',' || t === ';' || t === ':';

  function tokenize(s) {
    s = s.trim().replace(/^[¿¡\s]+/, '').replace(/[.!?]+\s*$/, '');
    s = s.replace(/\bsi\s*,\s*y\s+(s[oó]lo|solamente|[uú]nicamente)\s+si\b/gi, 'si y solo si');
    return s.match(/[,;:]|[^\s,;:]+/g) || [];
  }
  function trimC(toks) {
    let a = 0, b = toks.length;
    while (a < b && isComma(toks[a])) a++;
    while (b > a && isComma(toks[b - 1])) b--;
    return toks.slice(a, b);
  }
  function findPhrase(toks, ph, from) {
    for (let i = from || 0; i <= toks.length - ph.length; i++) {
      let ok = true;
      for (let j = 0; j < ph.length; j++) if (nt(toks[i + j]) !== ph[j]) { ok = false; break; }
      if (ok) return i;
    }
    return -1;
  }
  const startsWith = (toks, ph) => toks.length >= ph.length && ph.every((w, i) => nt(toks[i]) === w);

  // ---------- AST ----------
  const mk = {
    not: a => ({ t: 'not', a }),
    and: args => ({ t: 'and', args }),
    or: args => ({ t: 'or', args }),
    imp: (a, b) => ({ t: 'imp', a, b }),
    iff: (a, b) => ({ t: 'iff', a, b })
  };
  // negación que cancela doble negación (se usa al expandir)
  const neg = f => (f.t === 'not' ? f.a : mk.not(f));

  const LETTERS = 'pqrstuwxyzabcdeghijklmno'.split('');
  function newCtx() {
    return {
      atoms: [], map: new Map(),
      atom(key, text) {
        if (!this.map.has(key)) {
          const i = this.atoms.length;
          const letter = i < LETTERS.length ? LETTERS[i] : LETTERS[i % LETTERS.length] + Math.floor(i / LETTERS.length);
          const a = { letter, text: text.charAt(0).toLowerCase() + text.slice(1), key };
          this.atoms.push(a); this.map.set(key, a);
        }
        return { t: 'atom', p: this.map.get(key).letter };
      }
    };
  }

  // ---------- parser ----------
  const NEG_PREFIX = [
    ['no', 'es', 'cierto', 'que'], ['no', 'es', 'verdad', 'que'], ['no', 'ocurre', 'que'],
    ['no', 'sucede', 'que'], ['no', 'es', 'el', 'caso', 'que'], ['es', 'falso', 'que'], ['es', 'mentira', 'que']
  ];
  const IFF = [['si', 'y', 'solo', 'si'], ['si', 'y', 'solamente', 'si'], ['si', 'y', 'unicamente', 'si'], ['sii']];
  // [frase, tipo]  tipo: 'lr' = izq -> der ; 'rl' = der -> izq ; 'unless' = (no der) -> izq
  const TRAIL = [
    [['implica', 'que'], 'lr'], [['implica'], 'lr'],
    [['solo', 'si'], 'lr'], [['solamente', 'si'], 'lr'], [['unicamente', 'si'], 'lr'], [['solo', 'cuando'], 'lr'],
    [['a', 'menos', 'que'], 'unless'], [['salvo', 'que'], 'unless'],
    [['siempre', 'que'], 'rl'], [['en', 'caso', 'de', 'que'], 'rl'], [['cuando'], 'rl'], [['si'], 'rl'],
    [['entonces'], 'lr']
  ];

  function splitTop(toks, detect) {
    const parts = []; let cur = [], sep = false;
    for (let i = 0; i < toks.length; i++) {
      const n = detect(toks, i);
      if (n > 0) { parts.push(cur); cur = []; i += n - 1; sep = true; } else cur.push(toks[i]);
    }
    parts.push(cur);
    return { parts: parts.map(trimC).filter(p => p.length), sep };
  }
  const detY = (t, i) => { const w = nt(t[i]); return (w === 'y' || w === 'pero' || w === 'ademas') ? 1 : 0; };
  const detO = (t, i) => { const w = nt(t[i]); if (w === 'o' || w === 'u') return nt(t[i + 1] || '') === 'bien' ? 2 : 1; return 0; };
  const detNi = (t, i) => (nt(t[i]) === 'ni' ? 1 : 0);

  function parse(toks, ctx) {
    toks = trimC(toks);
    if (!toks.length) throw new Error('Hay una parte vacía en la frase.');

    // 1) negación explícita de toda la frase: "No es cierto que ..."
    for (const ph of NEG_PREFIX) if (startsWith(toks, ph)) {
      const rest = toks.slice(ph.length);
      if (!rest.length) throw new Error('Falta la frase después de "' + ph.join(' ') + '".');
      return mk.not(parse(rest, ctx));
    }
    // 2) bicondicional
    for (const ph of IFF) {
      const i = findPhrase(toks, ph);
      if (i > 0 && i + ph.length < toks.length)
        return mk.iff(parse(toks.slice(0, i), ctx), parse(toks.slice(i + ph.length), ctx));
    }
    // 3) "Si A, entonces B"
    if (nt(toks[0]) === 'si') {
      const rest = toks.slice(1);
      const e = findPhrase(rest, ['entonces']);
      let ant, con;
      if (e >= 0) { ant = rest.slice(0, e); con = rest.slice(e + 1); }
      else {
        const c = rest.findIndex(isComma);
        if (c < 0) throw new Error('En "si ..." falta "entonces" o una coma que separe la condición del resultado.');
        ant = rest.slice(0, c); con = rest.slice(c + 1);
      }
      const A = parse(ant, ctx), B = parse(con, ctx);
      return mk.imp(A, B);
    }
    // 4) condicionales "al revés": "B si A", "B cuando A", "A implica B", "A solo si B", ...
    for (const [ph, kind] of TRAIL) {
      const i = findPhrase(toks, ph, 1);
      if (i > 0 && i + ph.length < toks.length) {
        const L = parse(toks.slice(0, i), ctx), R = parse(toks.slice(i + ph.length), ctx);
        if (kind === 'lr') return mk.imp(L, R);
        if (kind === 'rl') return mk.imp(R, L);
        return mk.imp(neg(R), L);
      }
    }
    // 5) "ni A ni B"  ==  no A y no B
    if (toks.some(t => nt(t) === 'ni')) {
      const { parts } = splitTop(toks, detNi);
      if (parts.length && nt(parts[0][0]) === 'no') parts[0] = parts[0].slice(1);
      const fs = parts.filter(p => p.length).map(p => mk.not(parse(p, ctx)));
      return fs.length === 1 ? fs[0] : mk.and(fs);
    }
    // 6) disyunción (o / o bien / u)
    {
      const { parts, sep } = splitTop(toks, detO);
      if (parts.length > 1) return mk.or(parts.map(p => parse(p, ctx)));
      if (sep) toks = parts[0];
    }
    // 7) conjunción (y / pero / además)
    {
      const { parts, sep } = splitTop(toks, detY);
      if (parts.length > 1) return mk.and(parts.map(p => parse(p, ctx)));
      if (sep) toks = parts[0];
    }
    // 8) negación simple: "no ..."
    if (nt(toks[0]) === 'no' && toks.length > 1) return mk.not(parse(toks.slice(1), ctx));
    // 9) átomo
    const text = toks.join(' ').replace(/\s+([,;:])/g, '$1');
    const key = nt(text).replace(/\s+/g, ' ').trim().replace(/^que /, '');
    if (!key) throw new Error('No encontré una proposición en esa parte.');
    return ctx.atom(key, text);
  }

  // ---------- impresión de fórmulas ----------
  function show(f, top) {
    switch (f.t) {
      case 'atom': return f.p;
      case 'not':
        return '¬' + ((f.a.t === 'atom' || f.a.t === 'not') ? show(f.a, false) : '(' + show(f.a, true) + ')');
      case 'and': case 'or': {
        const s = f.args.map(a => show(a, false)).join(f.t === 'and' ? ' ∧ ' : ' ∨ ');
        return top ? s : '(' + s + ')';
      }
      case 'imp': case 'iff': {
        const s = show(f.a, false) + (f.t === 'imp' ? ' → ' : ' ↔ ') + show(f.b, false);
        return top ? s : '(' + s + ')';
      }
    }
  }

  // ---------- tableau ----------
  function kind(f) {
    switch (f.t) {
      case 'atom': return 'lit';
      case 'and': return 'alpha';
      case 'or': case 'imp': case 'iff': return 'beta';
      case 'not':
        switch (f.a.t) {
          case 'atom': return 'lit';
          case 'not': case 'or': case 'imp': return 'alpha';
          case 'and': case 'iff': return 'beta';
        }
    }
  }
  function expand(f) {
    switch (f.t) {
      case 'and': return { type: 'alpha', rule: '∧', items: f.args };
      case 'or': return { type: 'beta', rule: '∨', branches: f.args.map(a => [a]) };
      case 'imp': return { type: 'beta', rule: '→', branches: [[neg(f.a)], [f.b]] };
      case 'iff': return { type: 'beta', rule: '↔', branches: [[f.a, f.b], [neg(f.a), neg(f.b)]] };
      case 'not': {
        const g = f.a;
        switch (g.t) {
          case 'not': return { type: 'alpha', rule: '¬¬', items: [g.a] };
          case 'or': return { type: 'alpha', rule: '¬∨', items: g.args.map(neg) };
          case 'imp': return { type: 'alpha', rule: '¬→', items: [g.a, neg(g.b)] };
          case 'and': return { type: 'beta', rule: '¬∧', branches: g.args.map(a => [neg(a)]) };
          case 'iff': return { type: 'beta', rule: '¬↔', branches: [[g.a, neg(g.b)], [neg(g.a), g.b]] };
        }
      }
    }
  }

  function buildTree(rules, atoms, limit) {
    limit = limit || 3000;
    let nid = 0, count = 0;
    const mkNode = (f, src, via) => {
      if (++count > limit) throw new Error('El árbol es demasiado grande (más de ' + limit + ' nodos). Usa menos reglas.');
      return { id: nid++, f, formula: f ? show(f, true) : '', src, via, children: [], used: false, closed: false, open: false };
    };
    const complement = f => (f.t === 'not' ? show(f.a, true) : '¬' + show(f, true));

    function attach(parent, items, path) {
      let cur = parent;
      for (const it of items) {
        const n = mkNode(it.f, it.src, it.via);
        cur.children.push(n);
        if (kind(n.f) === 'lit') {
          const ck = complement(n.f);
          const clash = path.find(m => kind(m.f) === 'lit' && m.formula === ck);
          if (clash) { n.closed = true; n.clashWith = clash.formula; path.push(n); return null; }
        }
        path.push(n); cur = n;
      }
      return cur;
    }
    function modelOf(path) {
      const m = {};
      for (const n of path) if (kind(n.f) === 'lit') {
        if (n.f.t === 'atom') m[n.f.p] = true; else m[n.f.a.p] = false;
      }
      return m;
    }
    function proc(leaf, path, used) {
      let pick = null, beta = null;
      for (const n of path) {
        if (used.has(n.id)) continue;
        const k = kind(n.f);
        if (k === 'lit') continue;
        if (k === 'alpha') { pick = n; break; }
        if (!beta) beta = n;
      }
      pick = pick || beta;
      if (!pick) { leaf.open = true; leaf.model = modelOf(path); return; }
      pick.used = true;
      const u2 = new Set(used); u2.add(pick.id);
      const ex = expand(pick.f);
      if (ex.type === 'alpha') {
        const last = attach(leaf, ex.items.map(f => ({ f, src: pick.src, via: ex.rule })), path);
        if (last) proc(last, path, u2);
      } else {
        for (const b of ex.branches) {
          const p2 = path.slice();
          const last = attach(leaf, b.map(f => ({ f, src: pick.src, via: ex.rule })), p2);
          if (last) proc(last, p2, u2);
        }
      }
    }
    const rootNode = mkNode(null, null, null);
    rootNode.virtual = true;
    const path = [];
    const last = attach(rootNode, rules.map(r => ({ f: r.f, src: r.label, via: null })), path);
    if (last) proc(last, path, new Set());
    return rootNode;
  }

  function leaves(n, out) {
    out = out || [];
    if (!n.children.length) { if (!n.virtual) out.push(n); return out; }
    n.children.forEach(c => leaves(c, out));
    return out;
  }

  // ---------- API ----------
  function analyze(text) {
    const ctx = newCtx(), rules = [], errors = [];
    const sentences = text.split(/\n+/).flatMap(l => l.split(/(?<=[.!?])\s+/)).map(s => s.trim()).filter(Boolean);
    sentences.forEach(s => {
      const n0 = ctx.atoms.length;
      try {
        const f = parse(tokenize(s), ctx);
        rules.push({ label: 'R' + (rules.length + 1), text: s, f, formula: show(f, true) });
      } catch (e) {
        while (ctx.atoms.length > n0) { const a = ctx.atoms.pop(); ctx.map.delete(a.key); }
        errors.push({ text: s, msg: e.message });
      }
    });
    let tree = null, stats = null;
    if (rules.length) {
      tree = buildTree(rules, ctx.atoms);
      const ls = leaves(tree);
      const open = ls.filter(l => l.open), closed = ls.filter(l => l.closed);
      stats = {
        total: ls.length, closed: closed.length, open: open.length,
        models: open.map(l => ctx.atoms.map(a => ({ letter: a.letter, value: a.letter in l.model ? (l.model[a.letter] ? 'V' : 'F') : 'libre' }))),
        consistent: open.length > 0
      };
    }
    return { atoms: ctx.atoms, rules, errors, tree, stats };
  }

  const api = { analyze, parse, tokenize, show, newCtx, buildTree };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Motor = api;
})(typeof window !== 'undefined' ? window : globalThis);
