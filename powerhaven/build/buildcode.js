// Build codes in the browser (docs/social-currency.md 5.5): the same reading as Core/Social/Builds.cs in the game.
// A code is one number in mixed radix written in Crockford's base 32 after "PH": from the lowest digit, a check digit
// (the rest mod 29), the version (8), the hero (16), per bar slot the skill (4 builders, 2 movement, 16 skills, each
// with "none") and, when a skill is there, its row picks (27), the vow (4), the unique count (9) and each unique (128).
// data.js (tools/buildpage.py) holds the lists in the game's content order.
(function (root) {
  var ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  var VERSION = 1, R = { version: 8, hero: 16, slot: [4, 2, 16, 16, 16], pick: 27, vow: 4, count: 9, unique: 128 }, CHECK = 29, MAX = 40;

  function digits(code) {
    if (code == null) return null;
    var t = String(code).trim().toUpperCase();
    if (t.indexOf('PH') === 0) t = t.slice(2);
    var out = '';
    for (var i = 0; i < t.length; i++) {
      var ch = t[i];
      if (ch === '-' || ch === ' ' || ch === '\t' || ch === '.') continue;
      if (ch === 'O') ch = '0'; else if (ch === 'I' || ch === 'L') ch = '1';
      if (ALPHABET.indexOf(ch) < 0) return null;
      out += ch;
    }
    return out;
  }

  function slotChoices(data, hero, slot) {
    if (slot === 0) return hero.builders.slice();
    if (slot === 1) return hero.movement && data.skills[hero.movement] ? [hero.movement] : [];
    return hero.free.slice();
  }

  // { build } or { error: 'empty' | 'notacode' | 'typo' | 'newer' | 'unknown' }
  function decode(data, code) {
    var d = digits(code);
    if (d == null) return { error: 'notacode' };
    d = d.replace(/^0+/, '');
    if (!d.length) return { error: 'empty' };
    if (d.length > MAX) return { error: 'notacode' };
    var n = 0n;
    for (var i = 0; i < d.length; i++) n = n * 32n + BigInt(ALPHABET.indexOf(d[i]));
    var check = Number(n % 32n);
    n = n / 32n;
    if (Number(n % BigInt(CHECK)) !== check) return { error: 'typo' };
    function take(radix) { var r = BigInt(radix), v = Number(n % r); n = n / r; return v; }
    var version = take(R.version);
    if (version !== VERSION) return { error: version > VERSION ? 'newer' : 'notacode' };
    var heroIndex = take(R.hero);
    var hero = data.heroes[heroIndex];
    if (!hero) return { error: 'unknown' };
    var b = { hero: hero.id, bar: [null, null, null, null, null], picks: [[null, null, null], [null, null, null], [null, null, null], [null, null, null], [null, null, null]], vow: null, uniques: [] };
    for (var slot = 0; slot < 5; slot++) {
      var v = take(R.slot[slot]);
      if (v === 0) continue;
      var choices = slotChoices(data, hero, slot);
      if (v > choices.length) return { error: 'unknown' };
      var id = choices[v - 1];
      if (b.bar.indexOf(id) >= 0) return { error: 'notacode' };
      b.bar[slot] = id;
      var p = take(R.pick), s = data.skills[id];
      for (var r = 0; r < 3; r++, p = Math.floor(p / 3)) {
        var k = p % 3;
        if (k === 0) continue;
        if (k > s.rows[r].length) return { error: 'unknown' };
        b.picks[slot][r] = s.rows[r][k - 1].id;
      }
    }
    var vow = take(R.vow);
    if (vow > 0) { if (vow > hero.vows.length) return { error: 'unknown' }; b.vow = hero.vows[vow - 1].id; }
    var count = take(R.count);
    for (var u = 0; u < count; u++) {
      var ui = take(R.unique), ud = data.uniques[ui];
      if (!ud) return { error: 'unknown' };
      if (ud.hero && ud.hero !== b.hero) return { error: 'notacode' };
      if (b.uniques.indexOf(ud.id) < 0) b.uniques.push(ud.id);
    }
    if (n !== 0n) return { error: 'notacode' };
    return { build: b };
  }

  // A build from pasted text: the code, a share message holding it, or a build link.
  function parse(data, text) {
    if (!text || !String(text).trim()) return { error: 'empty' };
    text = String(text);
    if (text.length > 600) return { error: 'notacode' };
    var tries = [];
    var c = text.toLowerCase().indexOf('c=');
    if (c >= 0 && text.toLowerCase().indexOf('/build') >= 0) {
      try { tries.push(decodeURIComponent(text.slice(c + 2).split(/[&#\s]/)[0])); } catch (e) {}
    }
    var re = /(?:^|[^0-9A-Za-z])PH[-\s]+([0-9A-Za-z]{4}(?:[-\s]+[0-9A-Za-z]{4})*)(?![0-9A-Za-z])/gi, m;
    while ((m = re.exec(text))) tries.push(m[1]);
    if (!tries.length) tries.push(text);
    var first = null;
    for (var i = 0; i < tries.length; i++) {
      var r = decode(data, tries[i]);
      if (r.build) return r;
      if (!first) first = r;
    }
    return first || { error: 'notacode' };
  }

  function crown(data, b, slot) {
    var id = b.bar[slot];
    if (!id || !b.picks[slot][2]) return null;
    var s = data.skills[id];
    return s.rows[2].filter(function (n) { return n.id === b.picks[slot][2]; })[0] || null;
  }

  function topCluster(data, b) {
    var counts = {}, order = [];
    [2, 3, 4, 0].forEach(function (slot) {
      var id = b.bar[slot], s = id && data.skills[id];
      if (!s || s.kind === 'movement' || !s.cluster) return;
      counts[s.cluster] = (counts[s.cluster] || 0) + 1;
      if (order.indexOf(s.cluster) < 0) order.push(s.cluster);
    });
    var best = null;
    order.forEach(function (c) { if (best == null || counts[c] > counts[best]) best = c; });
    return best;
  }

  // [adjective, noun] in English, as Builds.Name.
  function name(data, b) {
    var w = data.names, order = [2, 3, 4, 0, 1], noun = null, nounCrown = null;
    if (b.vow && w.vows[b.vow]) noun = w.vows[b.vow];
    [true, false].forEach(function (sigOnly) {
      if (noun) return;
      for (var i = 0; i < order.length && !noun; i++) {
        var slot = order[i], cr = crown(data, b, slot);
        if (!cr || !w.crownNouns[cr.id]) continue;
        if (sigOnly && data.skills[b.bar[slot]].kind !== 'signature') continue;
        noun = w.crownNouns[cr.id]; nounCrown = cr.id;
      }
    });
    var cluster = topCluster(data, b);
    if (!noun && cluster && w.clusterNouns[cluster]) noun = w.clusterNouns[cluster];
    if (!noun) noun = w.heroes[b.hero] || 'Hero';
    function fits(a) {   // not a word that starts like the noun ("Spiteful Spite"), as Builds.SameStem
      if (!a) return false;
      var x = a.toLowerCase(), y = noun.toLowerCase(), k = Math.min(5, x.length, y.length);
      return !(k > 0 && x.slice(0, k) === y.slice(0, k));
    }
    for (var u = 0; u < b.uniques.length; u++) if (fits(w.uniques[b.uniques[u]])) return [w.uniques[b.uniques[u]], noun];
    for (var j = 0; j < order.length; j++) {
      var cr2 = crown(data, b, order[j]);
      if (!cr2 || cr2.id === nounCrown) continue;
      if (fits(w.crownWords[cr2.id])) return [w.crownWords[cr2.id], noun];
    }
    if (cluster && fits(w.clusterAdjectives[cluster])) return [w.clusterAdjectives[cluster], noun];
    return [w.fallback, noun];
  }

  // The needed level: skills, picked rows, the vow (Builds.NeededLevel, rows opening 'rowOpens' levels after the skill).
  var api = { decode: decode, parse: parse, digits: digits, name: name, crown: crown, slotChoices: slotChoices };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PHBuild = api;
})(typeof window !== 'undefined' ? window : this);
