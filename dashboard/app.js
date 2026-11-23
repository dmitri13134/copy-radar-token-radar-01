/* Copy Radar dashboard: board, live view, model view, detail view.
   Reads window.RADAR (written by main.ts from the same board as board.json),
   so the page never invents a number the board does not hold. No network. */
(function () {
  'use strict';
  var R = window.RADAR;
  if (!R || !Array.isArray(R.rows)) {
    document.querySelector('#view-board tbody').innerHTML = '<tr><td colspan="10">No radar data loaded.</td></tr>';
    return;
  }

  var $ = function (s) { return document.querySelector(s); };
  var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function moneyFull(n) { return '$' + Math.round(n).toLocaleString('en-US'); }
  function pct(n) {
    if (n == null) return '—';
    var s = (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
    return '<span class="' + (n >= 0 ? 'up' : 'down') + '">' + s + '</span>';
  }
  function age(n) {
    if (n == null) return '—';
    if (n < 30) return n + 'd';
    if (n < 365) return Math.round(n / 30) + 'mo';
    return (n / 365).toFixed(1) + 'y';
  }
  function badge(sig) {
    var cls = sig === 'STRONG MIRROR' ? 'strong' : sig === 'MIRROR' ? 'mirror' : sig === 'WATCH' ? 'watch' : 'track';
    return '<span class="badge ' + cls + '">' + esc(sig) + '</span>';
  }

  /* ---- header stats, legend, selects ---- */
  var counts = { 'STRONG MIRROR': 0, MIRROR: 0, WATCH: 0, TRACK: 0 };
  R.rows.forEach(function (r) { counts[r.signal] = (counts[r.signal] || 0) + 1; });
  $('#stats').innerHTML =
    '<div><dt>Board rows</dt><dd>' + R.board_size + '</dd></div>' +
    '<div><dt>Watchlist</dt><dd>' + R.watchlist_size + '</dd></div>' +
    '<div><dt>Early finds</dt><dd>' + R.early_size + '</dd></div>' +
    '<div><dt>Live tokens</dt><dd>' + R.live_size + '</dd></div>';
  $('#legend').innerHTML =
    'Signals — <b class="s-strong">STRONG MIRROR ' + counts['STRONG MIRROR'] + '</b> · ' +
    '<b class="s-mirror">MIRROR ' + counts.MIRROR + '</b> · ' +
    '<b class="s-watch">WATCH ' + counts.WATCH + '</b> · ' +
    '<b class="s-track">TRACK ' + counts.TRACK + '</b>. ' +
    'A signal mirrors the crowd: TVL is committed capital, the 7-day change is the flow, tenure without a token is the accumulation window.';
  $('#asof').textContent = R.as_of;

  var cats = {}, chains = {};
  R.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    (r.chains || []).forEach(function (c) { chains[c] = 1; });
  });
  Object.keys(cats).sort().forEach(function (c) {
    $('#cat').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });
  Object.keys(chains).sort().forEach(function (c) {
    $('#chain').insertAdjacentHTML('beforeend', '<option>' + esc(c) + '</option>');
  });

  /* ---- board ---- */
  var bySlug = {};
  R.rows.forEach(function (r) { bySlug[r.slug] = r; });
  var selected = null;

  function filtered() {
    var q = $('#q').value.trim().toLowerCase();
    var cat = $('#cat').value, sig = $('#sig').value, ch = $('#chain').value;
    var minTvl = parseFloat($('#minTvl').value) || 0;
    var rows = R.rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (sig && r.signal !== sig) return false;
      if (ch && (r.chains || []).indexOf(ch) < 0) return false;
      if (r.tvl_usd < minTvl) return false;
      return true;
    });
    var sort = $('#sort').value;
    var key = {
      value: function (r) { return -r.implied_value_usd; },
      score: function (r) { return -r.copy_score; },
      tvl: function (r) { return -r.tvl_usd; },
      flow: function (r) { return -(r.change_7d == null ? -1e9 : r.change_7d); },
      age: function (r) { return -(r.age_days == null ? -1 : r.age_days); }
    }[sort];
    rows.sort(function (a, b) { return key(a) - key(b) || a.slug.localeCompare(b.slug); });
    return rows;
  }

  function renderBoard() {
    var rows = filtered();
    var html = rows.map(function (r) {
      return '<tr data-slug="' + esc(r.slug) + '"' + (selected === r.slug ? ' class="sel"' : '') + '>' +
        '<td>' + r.rank + '</td>' +
        '<td><span class="name">' + esc(r.name) + '</span><span class="meta">' + esc(r.category || 'uncategorised') + ' · ' + esc(r.slug) + '</span></td>' +
        '<td>' + badge(r.signal) + '</td>' +
        '<td><span class="bar"><i style="width:' + r.copy_score + '%"></i></span>' + r.copy_score + '</td>' +
        '<td>' + money(r.implied_value_usd) + '</td>' +
        '<td>' + money(r.tvl_usd) + '</td>' +
        '<td>' + pct(r.change_7d) + '</td>' +
        '<td>' + age(r.age_days) + '</td>' +
        '<td>' + esc((r.chains || []).slice(0, 2).join(', ')) + ((r.chains || []).length > 2 ? ' +' + ((r.chains || []).length - 2) : '') + '</td>' +
        '<td>$' + r.allocation_usd + '</td></tr>';
    }).join('');
    $('#board tbody').innerHTML = html || '<tr><td colspan="10">No protocols match these filters.</td></tr>';
    $('#count').textContent = rows.length + ' of ' + R.rows.length + ' protocols shown. Click a row for its detail view and farm plan.';
  }

  /* ---- detail ---- */
  function showDetail(slug) {
    var r = bySlug[slug];
    var box = $('#detail');
    if (!r) { box.hidden = true; box.innerHTML = ''; selected = null; return; }
    selected = slug;
    var f = r.factors;
    function factorRow(label, score, note) {
      return '<div class="f">' + esc(label) + '<b>' + (score * 100).toFixed(0) + ' / 100</b>' +
        '<span class="bar"><i style="width:' + Math.round(score * 100) + '%"></i></span>' + esc(note) + '</div>';
    }
    var steps = (r.farm_steps || []).map(function (s) {
      var m = s.match(/^(.*?) Cost: (.*?) Time: (.*?)\.?$/);
      if (!m) return '<li>' + esc(s) + '</li>';
      var cost = m[2].replace(/\.+$/, ''), time = m[3].replace(/\.+$/, '');
      return '<li>' + esc(m[1]) + ' <span class="cost">Cost: ' + esc(cost) + '. Time: ' + esc(time) + '.</span></li>';
    }).join('');
    box.innerHTML =
      '<button class="close" type="button" id="detailClose">Close</button>' +
      '<h2>' + esc(r.name) + ' <span class="meta">rank #' + r.rank + ' · ' + esc(r.slug) + '</span></h2>' +
      '<p>' + badge(r.signal) + ' &nbsp;Copy score <b>' + r.copy_score + '</b> · mirror with <b>$' + r.allocation_usd + '</b></p>' +
      '<div class="facts">' +
      '<span>Implied value <b>' + moneyFull(r.implied_value_usd) + '</b></span>' +
      '<span>TVL <b>' + moneyFull(r.tvl_usd) + '</b></span>' +
      '<span>7-day flow <b>' + (r.change_7d == null ? 'not reported' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + '</b></span>' +
      '<span>Age, no token <b>' + age(r.age_days) + '</b></span>' +
      '<span>Chains <b>' + esc((r.chains || []).join(', ') || '—') + '</b></span>' +
      '<span>Category <b>' + esc(r.category || '—') + '</b></span>' +
      '<span>Listed <b>' + esc(r.listed_at || 'not reported') + '</b></span>' +
      '</div>' +
      '<h3>Why this signal</h3><div class="factors">' +
      factorRow('Committed capital (TVL)', f.tvl, 'TVL ' + money(r.tvl_usd) + ' on a log scale') +
      factorRow('Flow (7-day change)', f.flow, (r.change_7d == null ? 'not reported' : (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%') + ' in 7 days') +
      factorRow('Tenure, no token', f.tenure, age(r.age_days) + ' since listing') +
      factorRow('Crowd spread (chains)', f.breadth, (r.chains || []).length + ' chain' + ((r.chains || []).length === 1 ? '' : 's')) +
      '</div>' +
      '<p class="math">Model <code>copySignal</code>: implied = TVL × ' + R.model.base_multiple +
      ' × flow ' + r.flow_multiplier + ' × tenure ' + r.tenure_multiplier + ' × breadth ' + r.breadth_multiplier +
      ' = ' + moneyFull(r.implied_value_usd) + '. The record carries no token — never that it has none.</p>' +
      '<h3>Farm plan — copy the crowd</h3><ol class="steps">' + steps + '</ol>';
    box.hidden = false;
    $('#detailClose').addEventListener('click', function () { showDetail(null); renderBoard(); });
    box.scrollIntoView({ block: 'nearest' });
  }

  $('#board tbody').addEventListener('click', function (ev) {
    var tr = ev.target.closest('tr[data-slug]');
    if (!tr) return;
    showDetail(tr.getAttribute('data-slug'));
    renderBoard();
    try { history.replaceState(null, '', '#detail=' + tr.getAttribute('data-slug')); } catch (e) {}
  });

  /* ---- live view ---- */
  $('#live tbody').innerHTML = R.live.map(function (p) {
    return '<tr><td><span class="name">' + esc(p.name) + '</span><span class="meta">' + esc(p.category || 'uncategorised') + ' · ' + esc(p.slug) + '</span></td>' +
      '<td>' + (p.mcap_usd == null ? '—' : money(p.mcap_usd)) + '</td>' +
      '<td>' + money(p.tvl_usd) + '</td><td>' + pct(p.change_7d) + '</td>' +
      '<td>' + esc((p.chains || []).slice(0, 3).join(', ')) + '</td></tr>';
  }).join('');

  /* ---- model view + tuner ---- */
  $('#formula').textContent =
    'implied = TVL × base (' + R.model.base_multiple + ')' +
    ' × flow (1 + clamp(7d%, ' + R.model.flow_floor + ', ' + R.model.flow_cap + ') / 100 × ' + R.model.flow_weight + ')' +
    ' × tenure (' + R.model.tenure_floor + ' + min(age, ' + R.model.tenure_days + 'd) / ' + R.model.tenure_days + 'd × ' + R.model.tenure_range + ')' +
    ' × breadth (1 + min(chains, ' + R.model.breadth_max_chains + ') × ' + R.model.breadth_per_chain + ')\n' +
    'score = 100 × (' + R.model.weight_tvl + ' × tvl + ' + R.model.weight_flow + ' × flow + ' +
    R.model.weight_tenure + ' × tenure + ' + R.model.weight_breadth + ' × breadth), each factor 0–1\n' +
    'signal: score ≥ 65 STRONG MIRROR ($250) · ≥ 45 MIRROR ($150) · ≥ 25 WATCH ($100) · else TRACK ($50)';
  var tuner = [
    ['weight_tvl', 'TVL weight', R.model.weight_tvl],
    ['weight_flow', 'Flow weight', R.model.weight_flow],
    ['weight_tenure', 'Tenure weight', R.model.weight_tenure],
    ['weight_breadth', 'Breadth weight', R.model.weight_breadth],
    ['base_multiple', 'Base multiple', R.model.base_multiple]
  ];
  $('#tuner').innerHTML = tuner.map(function (t) {
    var max = t[0] === 'base_multiple' ? 1 : 1;
    var step = t[0] === 'base_multiple' ? 0.05 : 0.05;
    return '<label>' + esc(t[1]) + ' <output id="out-' + t[0] + '">' + t[2] + '</output>' +
      '<input type="range" id="in-' + t[0] + '" min="0" max="' + max + '" step="' + step + '" value="' + t[2] + '"></label>';
  }).join('');
  function retune() {
    var w = {};
    tuner.forEach(function (t) { w[t[0]] = parseFloat($('#in-' + t[0]).value); $('#out-' + t[0]).textContent = w[t[0]].toFixed(2); });
    var sum = w.weight_tvl + w.weight_flow + w.weight_tenure + w.weight_breadth || 1;
    var rescored = R.rows.map(function (r) {
      var f = r.factors;
      var score = Math.round(100 * (w.weight_tvl * f.tvl + w.weight_flow * f.flow + w.weight_tenure * f.tenure + w.weight_breadth * f.breadth) / sum);
      var implied = Math.max(1, Math.round(r.tvl_usd * w.base_multiple * r.flow_multiplier * r.tenure_multiplier * r.breadth_multiplier));
      return { name: r.name, score: score, implied: implied };
    }).sort(function (a, b) { return b.implied - a.implied; });
    $('#tunerOut').textContent = 'Top 5 under these weights: ' + rescored.slice(0, 5).map(function (r, i) {
      return (i + 1) + '. ' + r.name + ' (' + money(r.implied) + ', score ' + r.score + ')';
    }).join(' · ') + '. The submitted board uses the default weights above.';
  }
  $$('#tuner input').forEach(function (el) { el.addEventListener('input', retune); });
  retune();

  /* ---- views, filters, hash ---- */
  function setView(v) {
    $$('.tabs button').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-view') === v); });
    $('#view-board').hidden = v !== 'board';
    $('#view-live').hidden = v !== 'live';
    $('#view-model').hidden = v !== 'model';
    if (v !== 'board') { $('#detail').hidden = true; }
  }
  $$('.tabs button').forEach(function (b) {
    b.addEventListener('click', function () { setView(b.getAttribute('data-view')); });
  });
  ['q', 'cat', 'sig', 'chain', 'minTvl', 'sort'].forEach(function (id) {
    $('#' + id).addEventListener('input', renderBoard);
    $('#' + id).addEventListener('change', renderBoard);
  });
  $('#reset').addEventListener('click', function () {
    $('#q').value = ''; $('#cat').value = ''; $('#sig').value = ''; $('#chain').value = '';
    $('#minTvl').value = ''; $('#sort').value = 'value';
    renderBoard();
  });

  var hash = (location.hash || '').replace(/^#/, '');
  var params = {};
  hash.split('&').forEach(function (kv) {
    var p = kv.split('=');
    if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
  });
  if (params.view) setView(params.view);
  if (params.signal) { $('#sig').value = params.signal.toUpperCase().replace(/-/g, ' '); }
  renderBoard();
  if (params.detail && bySlug[params.detail]) {
    document.body.classList.add('detail-mode');
    showDetail(params.detail);
  }
})();
