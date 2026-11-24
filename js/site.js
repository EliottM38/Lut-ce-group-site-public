/* Lutèce Group — site public de l'alliance
   - Aucune clé ni URL externe ici : les données viennent de /api/public-parc
     (liens, photos et catalogue configurés depuis l'espace staff).
   - Animations : apparitions, parallaxe, compteurs, mots révélés au scroll,
     inclinaison des cartes. Tout est désactivé si l'utilisateur demande
     « réduire les animations ». */
(() => {
'use strict';
const BASE = (() => { try { const s = document.currentScript && document.currentScript.src; return s ? new URL('../', s).pathname : './'; } catch (e) { return './'; } })();
const API = '/api/public-parc';
const API_SITE = '/api/public-site';
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover:hover) and (pointer:fine)').matches;
const root = document.documentElement;
root.classList.add('js');
const THEME_KEY = 'lg-theme';
function storedTheme() { try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; } }
function setTheme(t, save) {
  root.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = t === 'dark' ? '#050a1c' : '#080f28';
  if (save) { try { localStorage.setItem(THEME_KEY, t); } catch (e) {} }
}
setTheme(storedTheme() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
function ensureFavicon() {
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.appendChild(icon); }
  icon.type = 'image/png'; icon.href = BASE + 'images/logo.png?v=202701';
}
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Les URLs provenant du contenu administrable ne sont jamais interpolées sans
// validation. Cela évite qu'une valeur mal formée casse l'attribut style ou un lien.
const httpUrl = value => { try { const u = new URL(String(value || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const fmt = n => Number(n).toLocaleString('fr-FR');
const page = (document.body.dataset.page || '');
const CATS = ['Minibus', 'Midibus', 'Standards', 'Articulés', 'BHNS', 'LE & Cars'];

/* ------------------------------------------------------------ données */
let dataP;
function loadData() {
  if (dataP) return dataP;
  dataP = (async () => {
    try {
      const c = JSON.parse(sessionStorage.getItem('lg_pub') || 'null');
      if (c && Date.now() - c.t < 300000) return c.d;
    } catch (e) {}
    try {
      const r = await fetch(API, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      try { sessionStorage.setItem('lg_pub', JSON.stringify({ t: Date.now(), d })); } catch (e) {}
      return d;
    } catch (e) { return null; }
  })();
  return dataP;
}

/* ------------------------------------------------------------ menu */
const MENU = [
  { t: 'L’Alliance', cols: [{ h: 'L’alliance', l: [
    ['presentation.html', 'Présentation de Lutèce Group', 'Ce que fait l’Alliance et comment elle fonctionne'],
    ['reglement.html', 'Le règlement de l’Alliance', 'Les règles applicables à tous les membres'],
    ['forfaits.html', 'Nos forfaits', 'Les services et cotisations Standard et Ultimate'],
    ['articles.html', 'Actualités', 'Les dernières informations de l’Alliance']] }] },
  { t: 'Location', cols: [
    { h: 'Louer', l: [
      ['pole-location.html', 'Pôle Location', 'Les conditions de location et le suivi du parc'],
      ['pole-location.html#tarifs', 'Tarifs de location', 'Les tarifs à la semaine et au mois'],
      ['pole-location.html#sal', 'Service Après Location', 'Pannes, révisions et contrôles techniques']] },
    { h: 'Notre parc', l: [['parc.html', 'Notre Parc', 'Les véhicules disponibles à la location']] }] },
  { t: 'Exploitation & finance', cols: [
    { h: 'Exploitation', l: [
      ['pole-exploitation.html', 'Pôle Exploitation', 'Intérimaires, ateliers et demandes de service'],
      ['pole-exploitation.html#interimaires', 'Demande d’intérimaires', 'Conducteurs et mécaniciens'],
      ['pole-exploitation.html#ateliers', 'Ateliers de l’Alliance', 'Réparations, révisions et véhicules de remplacement']] },
    { h: 'Financement', l: [
      ['pole-financement.html', 'Pôle Financement', 'CT, révisions, FCO et rénovations'],
      ['pole-financement.html#gold', 'Programme GOLD', 'Daimler Buses et VDI Star'],
      ['pole-financement.html#renovations', 'Rénovations', 'Prises en charge intérieures et techniques']] }] }
];
const here = location.pathname.split('/').pop() || 'index.html';

// Logo : images/logo.png (ou l'image « logo » configurée dans l'espace staff). Repli : monogramme LG.
function logoHTML() { return `<img class="brand-logo" data-logo src="${BASE}images/logo.png" alt="" width="40" height="40"><span class="brand-mark" hidden>LG</span>`; }
function fixLogos() {
  $$('img[data-logo]').forEach(img => {
    const fail = () => { img.hidden = true; const m = img.nextElementSibling; if (m && m.classList.contains('brand-mark')) m.hidden = false; };
    img.addEventListener('error', fail, { once: true });
    if (img.complete && img.naturalWidth === 0) fail();
  });
}
function headerHTML() {
  const items = MENU.map(g => {
    const cur = g.cols.some(c => c.l.some(l => l[0].split(/[#?]/)[0] === here));
    return `<div class="nav-i${cur ? ' cur' : ''}"><button class="nav-b" type="button" aria-haspopup="true">${esc(g.t)} <i class="fa-solid fa-chevron-down"></i></button>
      <div class="mega">${g.cols.map(c => `<div class="mega-col"><h4>${esc(c.h)}</h4>${c.l.map(l =>
        `<a href="${BASE}${l[0]}"${l[3] ? ' class="sub"' : ''}><b>${esc(l[1])}</b>${l[2] ? `<span>${esc(l[2])}</span>` : ''}</a>`).join('')}</div>`).join('')}</div></div>`;
  }).join('');
  return `<a class="skip" href="#main">Aller au contenu</a><header class="hdr" id="hdr"><div class="wrap hdr-in">
    <a class="brand" href="${BASE}index.html" aria-label="Lutèce Group — accueil">${logoHTML()}<span>Lutèce Group<small>Opérateur de transport</small></span></a>
    <nav class="nav" id="nav" aria-label="Navigation principale">${items}<a class="btn btn-gold btn-sm hdr-cta" href="${BASE}rejoindre.html">Nous rejoindre</a></nav>
    <div class="hdr-tools">
      <button class="hdr-btn" id="btn-search" type="button" aria-label="Rechercher sur le site" aria-haspopup="dialog"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i></button>
      <button class="hdr-btn" id="btn-theme" type="button" aria-label="Changer de thème (clair / sombre)"><i class="fa-solid fa-moon t-moon" aria-hidden="true"></i><i class="fa-solid fa-sun t-sun" aria-hidden="true"></i></button>
    </div>
    <button class="burger" id="burger" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="nav"><i></i><i></i></button>
  </div></header><div class="progress" id="progress"></div>`;
}

function footerHTML() {
  const L = (p, t) => `<li><a href="${BASE}${p}">${t}</a></li>`;
  const K = (k, t) => `<li data-link="${k}"><a rel="noopener" target="_blank">${t}</a></li>`;
  return `<footer class="ftr"><div class="wrap">
    <div class="ftr-top">
      <div><a class="brand" href="${BASE}index.html" aria-label="Lutèce Group — accueil">${logoHTML()}<span>Lutèce Group</span></a>
        <p>Opérateur de transport et prestataire de service privé, spécialisé dans les services auxiliaires des transports terrestres.</p></div>
      <div><h4>Qui sommes-nous ?</h4><ul>${L('articles.html', 'Actualités')}${L('presentation.html', 'Présentation')}${L('reglement.html', 'Règlement de l’Alliance')}${L('forfaits.html', 'Nos forfaits')}${L('rejoindre.html', 'Nous rejoindre')}</ul></div>
      <div><h4>Service Location</h4><ul>${L('pole-location.html', 'Pôle Location')}${L('parc.html', 'Notre Parc')}${L('pole-location.html#tarifs', 'Tarifs de location')}${L('pole-location.html#sal', 'Service Après Location')}</ul></div>
      <div><h4>Exploitation &amp; Financement</h4><ul>${L('pole-exploitation.html', 'Pôle Exploitation')}${L('pole-exploitation.html#ateliers', 'Ateliers de l’Alliance')}${L('pole-financement.html', 'Pôle Financement')}${L('pole-financement.html#gold', 'Programme GOLD')}</ul></div>
      <div><h4>Liens utiles</h4><ul>${K('forum', 'Forum Transport Manager')}${K('tm', 'Transport Manager')}${K('demande_location', 'Demande de location')}${K('sal', 'Formulaire S.A.L')}${K('intervention', 'Intervention atelier')}${K('remboursement', 'Demande de remboursement')}${K('disponibilites', 'Disponibilités du parc')}<span id="ftr-extra" style="display:contents"></span></ul></div>
    </div>
    <div class="ftr-bot"><span>© 2026 Lutèce Group · Alliance du jeu Transport Manager</span>
      <span class="lg"><a href="${BASE}mentions-legales.html">Mentions légales</a><a href="${BASE}confidentialite.html">Confidentialité</a><a href="${BASE}cgv-cgu.html">CGV / CGU</a></span></div>
  </div></footer>
  <button class="to-top" id="to-top" type="button" aria-label="Retour en haut de la page"><i class="fa-solid fa-arrow-up" aria-hidden="true"></i></button>
  <dialog class="sdlg" id="sdlg" aria-label="Recherche sur le site"><form method="dialog" id="sform" role="search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input id="sq" type="search" placeholder="Rechercher une page ou un modèle de bus…" aria-label="Rechercher" autocomplete="off"><button class="sx" value="close" aria-label="Fermer la recherche">Échap</button></form><div class="sres" id="sres" aria-live="polite"></div></dialog>`;
}

function mountChrome() {
  const h = $('#hdr-slot'), f = $('#ftr-slot');
  if (h) h.outerHTML = headerHTML();
  if (f) f.outerHTML = footerHTML();
  const hdr = $('#hdr'), burger = $('#burger');
  if (burger) burger.addEventListener('click', () => {
    const o = hdr.classList.toggle('open');
    burger.setAttribute('aria-expanded', o);
    document.body.style.overflow = o ? 'hidden' : '';
  });
  $$('.nav-b').forEach(b => b.addEventListener('click', () => { if (innerWidth <= 1060) b.parentElement.classList.toggle('open'); }));
  $$('.nav a').forEach(a => a.addEventListener('click', () => { hdr.classList.remove('open'); document.body.style.overflow = ''; }));
  addEventListener('keydown', e => { if (e.key === 'Escape') { hdr.classList.remove('open'); document.body.style.overflow = ''; burger && burger.setAttribute('aria-expanded', 'false'); } });
  const mainEl = $('main'); if (mainEl) { mainEl.id = 'main'; mainEl.tabIndex = -1; }
  fixLogos();
  const tb = $('#btn-theme');
  const syncThemeButton = () => { if (tb) { const dark = root.getAttribute('data-theme') === 'dark'; tb.setAttribute('aria-pressed', String(dark)); tb.setAttribute('aria-label', dark ? 'Activer le thème clair' : 'Activer le thème sombre'); } };
  syncThemeButton();
  if (tb) tb.addEventListener('click', () => { setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark', true); syncThemeButton(); });
  const tt = $('#to-top');
  if (tt) { tt.addEventListener('click', () => scrollTo({ top: 0, behavior: REDUCE ? 'auto' : 'smooth' }));
    const upd = () => tt.classList.toggle('on', scrollY > 700); addEventListener('scroll', upd, { passive: true }); upd(); }
  mountSearch();
}

/* ------------------------------------------------------------ recherche */
const PAGES = [
  ['index.html', 'Accueil', 'lutèce group alliance transport'],
  ['presentation.html', 'Présentation de Lutèce Group', 'alliance qui sommes-nous services conditions'],
  ['reglement.html', 'Règlement de l’Alliance', 'règles articles amende forfait location recrutement départ confidentialité'],
  ['forfaits.html', 'Nos forfaits : Standard et Ultimate', 'standard ultimate basique tarif facture intérimaires gold'],
  ['rejoindre.html', 'Nous rejoindre', 'candidature adhésion conditions ancienneté solde raz forum'],
  ['pole-location.html', 'Pôle Location', 'location bus tarifs semaine mois contrat durée'],
  ['pole-location.html#tarifs', 'Tarifs de location', 'prix minibus midibus standard articulé car semaine mois'],
  ['pole-location.html#sal', 'Service Après Location (S.A.L)', 'panne immobilisation contrôle technique ct remplacement'],
  ['parc.html', 'Notre parc', 'catalogue véhicules bus modèles disponibilité état kilométrage'],
  ['pole-exploitation.html', 'Pôle Exploitation', 'intérimaires mécaniciens conducteurs ateliers'],
  ['pole-exploitation.html#ateliers', 'Ateliers de l’Alliance', 'panne options véhicule de remplacement révision'],
  ['pole-financement.html', 'Pôle Financement', 'contrôle technique révision fco rénovation crédit banque'],
  ['pole-financement.html#gold', 'Programme GOLD', 'daimler buses evobus vdi star'],
  ['articles.html', 'Actualités', 'articles annonces nouvelles'],
  ['mentions-legales.html', 'Mentions légales', 'éditeur hébergeur contact'],
  ['confidentialite.html', 'Confidentialité', 'données cookies rgpd vie privée'],
  ['cgv-cgu.html', 'CGV / CGU', 'conditions générales utilisation vente']
];
const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function mountSearch() {
  const dlg = $('#sdlg'), inp = $('#sq'), out = $('#sres'), btn = $('#btn-search');
  if (!dlg || typeof dlg.showModal !== 'function') { if (btn) btn.hidden = true; return; }
  let models = [], sel = -1;
  const open = () => { if (!dlg.open) dlg.showModal(); inp.focus(); inp.select(); render(); loadData().then(d => { models = (d && d.models) || []; render(); }); };
  function render() {
    const q = fold(inp.value).trim(), terms = q.split(/\s+/).filter(Boolean);
    const hit = (t, k) => terms.every(w => fold(t + ' ' + k).includes(w));
    const pages = (terms.length ? PAGES.filter(p => hit(p[1], p[2])) : PAGES.slice(0, 6));
    const vs = terms.length ? models.filter(m => hit(m.marque + ' ' + m.modele, m.categorie + ' ' + (m.moteurs || []).join(' '))).slice(0, 8) : [];
    let h = '';
    if (pages.length) h += '<h4>Pages</h4>' + pages.map(p => `<a href="${BASE}${p[0]}"><b>${esc(p[1])}</b></a>`).join('');
    if (vs.length) h += '<h4>Modèles du parc</h4>' + vs.map(m => `<a href="${modelHref(m)}"><b>${esc((m.marque + ' ' + m.modele).trim())}</b><span>${esc(m.categorie)} · ${m.quantite} véhicule${m.quantite > 1 ? 's' : ''}</span></a>`).join('');
    out.innerHTML = h || '<p class="none">Aucun résultat. Essayez un autre mot, par exemple « tarifs » ou « Citaro ».</p>';
    sel = -1;
  }
  const links = () => $$('a', out);
  const mark = () => links().forEach((a, i) => { a.classList.toggle('sel', i === sel); if (i === sel) a.scrollIntoView({ block: 'nearest' }); });
  inp.addEventListener('input', render);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); dlg.close(); return; }
    const n = links().length; if (!n) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % n; mark(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + n) % n; mark(); }
    else if (e.key === 'Enter') { e.preventDefault(); const a = links()[sel < 0 ? 0 : sel]; if (a) location.href = a.href; }
  });
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  if (btn) btn.addEventListener('click', open);
  addEventListener('keydown', e => {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(tag))) { e.preventDefault(); open(); }
  });
}

/* ------------------------------------------------------------ écran de chargement (une fois par visite) */
function preloader() {
  if (REDUCE) return;
  let seen = false; try { seen = sessionStorage.getItem('lg_seen') === '1'; sessionStorage.setItem('lg_seen', '1'); } catch (e) {}
  if (seen) return;
  const el = document.createElement('div'); el.className = 'pl'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<img src="${BASE}images/logo.png" alt="" width="64" height="64"><b hidden>LG</b>`;
  const im = el.firstChild;
  const fail = () => { im.hidden = true; el.lastChild.hidden = false; };
  im.addEventListener('error', fail, { once: true });
  document.body.appendChild(el);
  const done = () => { el.classList.add('go'); setTimeout(() => el.remove(), 1300); };
  setTimeout(done, 650);
}

/* ------------------------------------------------------------ routes (décor des hero sans photo) */
function routesSVG() {
  return `<svg class="routes" viewBox="0 0 1440 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <path pathLength="1" d="M-20 610 C 220 610 280 420 520 420 S 800 560 1020 330 S 1300 190 1470 190"/>
    <path pathLength="1" d="M-20 720 C 300 720 420 640 640 640 S 960 700 1160 520 S 1380 420 1470 430"/>
    <path pathLength="1" d="M300 -20 C 340 160 520 200 600 330 S 700 560 880 640 S 1160 790 1200 830"/>
    <circle cx="520" cy="420" r="9" style="animation-delay:1.4s"/><circle cx="1020" cy="330" r="9" style="animation-delay:2.2s"/>
    <circle cx="640" cy="640" r="9" style="animation-delay:2.8s"/><circle cx="1160" cy="520" r="9" style="animation-delay:3.4s"/>
  </svg>`;
}
function decorate() {
  $$('.hero,.phero').forEach(h => { if (!$('.routes', h)) h.insertAdjacentHTML('afterbegin', routesSVG()); });
}

/* ------------------------------------------------------------ silhouettes (quand il n'y a pas encore de photo) */
function busSVG(cat) {
  const wheel = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="19"/><circle cx="${cx}" cy="${cy}" r="6"/>`;
  const body = (x, y, w, h, win) => {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16"/>`;
    const n = Math.max(2, Math.floor((w - 96) / 50));
    for (let i = 0; i < n; i++) s += `<rect x="${x + 20 + i * 50}" y="${y + 16}" width="38" height="${win}" rx="6"/>`;
    return s + `<rect x="${x + w - 70}" y="${y + 16}" width="26" height="${h - 16}" rx="4"/>`;
  };
  let i;
  switch (cat) {
    case 'Minibus': i = body(100, 84, 200, 78, 28) + wheel(150, 166) + wheel(252, 166); break;
    case 'Midibus': i = body(66, 72, 268, 90, 30) + wheel(120, 166) + wheel(270, 166); break;
    case 'Articulés': i = body(14, 68, 176, 94, 32) + body(214, 68, 176, 94, 32) + '<path d="M190 82c12 0 12 6 24 0M190 148c12 0 12-6 24 0"/>' + wheel(60, 166) + wheel(150, 166) + wheel(300, 166); break;
    case 'BHNS': i = '<path d="M150 66l22-20h56l22 20" opacity=".7"/>' + body(28, 66, 344, 96, 32) + wheel(96, 166) + wheel(300, 166); break;
    case 'LE & Cars': i = body(24, 50, 352, 112, 40) + '<rect x="60" y="118" width="64" height="30" rx="5" opacity=".7"/><rect x="134" y="118" width="64" height="30" rx="5" opacity=".7"/>' + wheel(96, 166) + wheel(300, 166); break;
    default: i = body(28, 66, 344, 96, 32) + wheel(96, 166) + wheel(300, 166);
  }
  return `<svg viewBox="0 0 400 220" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${i}<path d="M10 192h380" opacity=".3"/></svg>`;
}

/* ------------------------------------------------------------ données → éléments communs */
function applyData(d) {
  if (!d) return;
  $$('[data-img]').forEach(el => {
    const u = httpUrl(d.site_images && d.site_images[el.dataset.img]);
    if (u) { el.style.backgroundImage = `url("${u}")`; el.classList.remove('noimg'); el.classList.add('has'); }
  });
  const logo = httpUrl(d.site_images && d.site_images.logo);
  if (logo) $$('img[data-logo]').forEach(img => { img.src = logo; img.hidden = false; const m = img.nextElementSibling; if (m && m.classList.contains('brand-mark')) m.hidden = true; });
  $$('[data-link]').forEach(el => {
    const u = d.links && (d.links[el.dataset.link] || (el.dataset.linkAlt && d.links[el.dataset.linkAlt]));
    if (!u) return;
    const a = el.matches('a') ? el : $('a', el);
    const url = httpUrl(u);
    if (!url) return;
    if (a) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
    el.classList.add('ok');
  });
  if (d.stats) {
    $$('[data-stat]').forEach(el => {
      const v = d.stats[el.dataset.stat];
      if (v > 0) { el.dataset.count = v; el.dataset.suffix = ''; el.textContent = fmt(v); }
    });
    const total = d.stats.total;
    if (total > 0) $$('[data-parc-title]').forEach(el => { el.textContent = `Un parc de ${fmt(total)} véhicules.`; });
  }
}


/* ------------------------------------------------------------ contenu éditorial (articles, pop-up, liens, Discord) */
let siteP;
function loadSite(slug) {
  if (!slug && siteP) return siteP;
  const p = (async () => {
    const key = 'lg_site' + (slug ? '_' + slug : '');
    try {
      const c = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (c && Date.now() - c.t < 60000) return c.d;
    } catch (e) {}
    try {
      const r = await fetch(API_SITE + (slug ? '?slug=' + encodeURIComponent(slug) : ''), { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(r.status);
      const d = await r.json();
      try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch (e) {}
      return d;
    } catch (e) { return null; }
  })();
  if (!slug) siteP = p;
  return p;
}

const fmtDay = iso => { try { return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { return ''; } };

function applyLinks(s) {
  if (!s || !s.links || !s.links.length) return;
  const foot = s.links.filter(l => l.zone !== 'menu');
  const slot = $('#ftr-extra');
  if (slot) slot.innerHTML = foot.map(l => `<li><a href="${esc(httpUrl(l.url))}" target="_blank" rel="noopener noreferrer">${esc(l.label)}</a></li>`).join('');
  const men = s.links.filter(l => l.zone === 'menu');
  const nav = $('.nav');
  if (men.length && nav && !$('#nav-extra')) {
    const div = document.createElement('div');
    div.className = 'nav-i'; div.id = 'nav-extra';
    div.innerHTML = `<button class="nav-b" type="button" aria-haspopup="true">Liens <i class="fa-solid fa-chevron-down"></i></button>
      <div class="mega"><div class="mega-col"><h4>Liens utiles</h4>${men.map(l => `<a href="${esc(httpUrl(l.url))}" target="_blank" rel="noopener noreferrer"><b>${esc(l.label)}</b></a>`).join('')}</div></div>`;
    nav.insertBefore(div, $('.hdr-cta', nav));
    $('.nav-b', div).addEventListener('click', () => { if (innerWidth <= 1060) div.classList.toggle('open'); });
  }
}

function applyReglement(s) {
  if (!s || !s.reglement) return;
  const rg = s.reglement;
  const intro = $('[data-reglement-intro]');
  if (intro && rg.introduction) intro.textContent = rg.introduction;
  if (rg.version) $$('[data-reglement-version]').forEach(el => { el.textContent = rg.version; });
}

function applyStudioSettings(s) {
  if (!s) return;
  const hex = v => /^#[0-9a-f]{6}$/i.test(String(v || '')) ? v : '';
  if (s.theme) {
    const navy = hex(s.theme.navy), gold = hex(s.theme.gold), accent = hex(s.theme.accent);
    if (navy) { root.style.setProperty('--navy', navy); root.style.setProperty('--ink', navy); }
    if (gold) { root.style.setProperty('--gold', gold); root.style.setProperty('--gold-2', gold); }
    if (accent) root.style.setProperty('--accent', accent);
  }
  const b = s.brand || {};
  if (b.name) $$(' .brand > span, .brand span').forEach(el => { if (el.parentElement && el.parentElement.classList.contains('brand')) el.firstChild.textContent = b.name; });
  if (b.slogan) $$('.brand small').forEach(el => { el.textContent = b.slogan; });
  if (b.logo) $$('img[data-logo]').forEach(el => { el.src = httpUrl(b.logo) || el.src; });
  if (b.cta) $$('.hdr-cta').forEach(el => { el.textContent = b.cta; });
  const p = s.pages && s.pages[here];
  if (p) {
    if (p.title) { const h = $('h1'); if (h) h.textContent = p.title; document.title = p.title + ' — ' + (b.name || 'Lutèce Group'); }
    if (p.intro) { const lead = $('.phero .lead,.hero .lead'); if (lead) lead.textContent = p.intro; }
    if (p.description) { let d = $('meta[name="description"]'); if (!d) { d = document.createElement('meta'); d.name = 'description'; document.head.appendChild(d); } d.content = p.description; }
  }
  if (s.seo && s.seo.title && here === 'index.html') document.title = s.seo.title;
}

function discordHTML(dc) {
  return `<iframe title="Discord de Lutèce Group" src="https://discord.com/widget?id=${encodeURIComponent(dc.id)}&theme=${dc.theme}" width="350" height="500" allowtransparency="true" frameborder="0" loading="lazy" sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"></iframe>`;
}
function mountDiscord(s) {
  const dc = s && s.discord;
  $$('[data-discord]').forEach(el => {
    if (!dc) { el.hidden = true; return; }
    const box = $('.dc-frame', el);
    // Rien n'est demandé à Discord tant que le visiteur ne clique pas (vie privée).
    if (box) {
      box.innerHTML = '<div class="dc-ask"><p>Le widget est fourni par Discord. En l’affichant, votre navigateur se connecte aux serveurs de Discord.</p><button class="btn btn-gold" type="button">Afficher le widget Discord</button></div>';
      $('button', box).addEventListener('click', () => { box.innerHTML = discordHTML(dc); });
    }
    el.hidden = false;
  });
}

function showPopup(s) {
  const p = s && s.popup;
  if (!p || $('#popup')) return;
  const sig = p.id || (p.titre + '|' + p.texte).slice(0, 80);
  try { if (localStorage.getItem('lg_popup') === sig) return; } catch (e) {}
  const el = document.createElement('div');
  el.className = 'popup'; el.id = 'popup'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'popup-t');
  const image = httpUrl(p.image), link = httpUrl(p.lien);
  el.innerHTML = `<div class="popup-bg" data-close></div><div class="popup-box">
    <button class="popup-x" type="button" data-close aria-label="Fermer"><i class="fa-solid fa-xmark"></i></button>
    ${image ? `<div class="popup-img" style="background-image:url('${esc(image)}')"></div>` : ''}
    <div class="popup-body"><h2 id="popup-t">${esc(p.titre)}</h2>${p.texte ? `<p>${esc(p.texte).replace(/\n/g, '<br>')}</p>` : ''}
    <div class="popup-act">${link ? `<a class="btn btn-gold" href="${esc(link)}" target="_blank" rel="noopener noreferrer">${esc(p.bouton || 'En savoir plus')}</a>` : ''}<button class="btn btn-ghost" type="button" data-close>Fermer</button></div></div></div>`;
  const close = () => {
    el.classList.remove('on');
    try { localStorage.setItem('lg_popup', sig); } catch (e) {}
    setTimeout(() => el.remove(), 500);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = e => { if (e.key === 'Escape') close(); };
  setTimeout(() => {
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    requestAnimationFrame(() => { el.classList.add('on'); const b = $('.popup-x', el); if (b) b.focus(); });
  }, 1200);
}

function artCard(a, i) {
  const image = httpUrl(a.image);
  return `<a class="acard rv" style="--d:${(i % 3) * 80}ms" href="${BASE}article.html?s=${encodeURIComponent(a.slug)}">
    <div class="acard-img${image ? '' : ' noimg'}"${image ? ` style="background-image:url('${esc(image)}')"` : ''}></div>
    <div class="acard-b"><span class="chip-k">${esc(a.categorie || 'Actualité')}</span><h3>${esc(a.titre)}</h3>
      <p>${esc(a.resume)}</p><small>${esc(fmtDay(a.date))}${a.auteur ? ' · ' + esc(a.auteur) : ''}</small></div></a>`;
}

function pageHomeNews(s) {
  const box = $('#home-news'); if (!box) return;
  const list = (s && s.articles || []).slice(0, 3);
  if (!list.length) { box.hidden = true; return; }
  $('.news-grid', box).innerHTML = list.map(artCard).join('');
  box.hidden = false;
}

function pageArticles(s) {
  const g = $('#agrid'); if (!g) return;
  const list = s && s.articles || [];
  if (!list.length) { g.innerHTML = `<div class="empty"><b>Aucun article pour le moment</b>Les actualités de l’alliance apparaîtront ici.</div>`; return; }
  const featured = list[0], feature = $('#news-feature'), toolbar = $('#news-toolbar');
  const image = httpUrl(featured.image);
  if (feature) feature.innerHTML = `<a class="news-feature rv" href="${BASE}article.html?s=${encodeURIComponent(featured.slug)}"><div class="news-feature-img${image ? '' : ' noimg'}"${image ? ` style="background-image:url('${esc(image)}')"` : ''}></div><div><span class="chip-k">À la une · ${esc(featured.categorie || 'Actualité')}</span><h2>${esc(featured.titre)}</h2><p>${esc(featured.resume)}</p><small>${esc(fmtDay(featured.date))}${featured.auteur ? ' · ' + esc(featured.auteur) : ''}</small><b class="news-read">Lire l’article <i class="fa-solid fa-arrow-right"></i></b></div></a>`;
  const cats = Array.from(new Set(list.map(a => a.categorie || 'Actualité')));
  let active = 'Tout';
  function render(){ const rest = list.slice(1).filter(a => active === 'Tout' || (a.categorie || 'Actualité') === active); g.innerHTML = rest.length ? rest.map(artCard).join('') : '<div class="empty"><b>Aucun article dans cette catégorie</b>Choisissez une autre catégorie.</div>'; observeReveal(g); }
  if (toolbar) { toolbar.hidden = false; toolbar.innerHTML = ['Tout'].concat(cats).map(c => `<button class="chip${c === active ? ' on' : ''}" type="button">${esc(c)}</button>`).join(''); toolbar.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; active = b.textContent; $$('button', toolbar).forEach(x => x.classList.toggle('on', x === b)); render(); }); }
  render();
}

function paragraphs(txt) {
  return String(txt || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean).map(b => {
    if (/^#{1,3}\s/.test(b)) return `<h3>${esc(b.replace(/^#{1,3}\s+/, ''))}</h3>`;
    return `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
  }).join('');
}

async function pageArticle() {
  const t = $('#art-title'); if (!t) return;
  const slug = (new URLSearchParams(location.search).get('s') || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
  const s = slug ? await loadSite(slug) : null;
  const a = s && s.article;
  if (!a) {
    t.textContent = 'Article introuvable';
    $('#art-body').innerHTML = `<div class="empty"><b>Cet article n’existe pas ou n’est plus en ligne.</b><a class="link" href="${BASE}articles.html">Voir toutes les actualités <i class="fa-solid fa-arrow-right"></i></a></div>`;
    return;
  }
  document.title = a.titre + ' — Lutèce Group';
  t.textContent = a.titre;
  $('#art-meta').textContent = fmtDay(a.date) + (a.auteur ? ' · ' + a.auteur : '');
  const image = httpUrl(a.image);
  if (image) { const im = $('#art-img'); im.style.backgroundImage = `url("${image}")`; im.hidden = false; }
  $('#art-body').innerHTML = paragraphs(a.contenu);
}

/* ------------------------------------------------------------ animations */
let ro;
function observeReveal(scope) {
  const els = $$('.rv:not(.in)', scope || document);
  if (REDUCE || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  if (!ro) ro = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); ro.unobserve(e.target); } }), { threshold: .12, rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => ro.observe(e));
}
function stagger() {
  $$('[data-stagger]').forEach(p => $$(':scope > .rv', p).forEach((c, i) => c.style.setProperty('--d', (i * 90) + 'ms')));
}

function countUp(el) {
  const target = Number(el.dataset.count || 0), suf = el.dataset.suffix || '';
  if (REDUCE || !target) { el.textContent = fmt(target) + suf; return; }
  const t0 = performance.now(), dur = 1900;
  const step = t => {
    const p = clamp((t - t0) / dur, 0, 1), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
    el.textContent = fmt(Math.round(target * e)) + suf;
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
function observeCounters() {
  const els = $$('[data-count]');
  if (!('IntersectionObserver' in window)) { els.forEach(countUp); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } }), { threshold: .6 });
  els.forEach(e => io.observe(e));
}

function splitStatement() {
  $$('.statement').forEach(el => {
    const out = [];
    el.childNodes.forEach(n => {
      const hl = n.nodeType === 1 && n.tagName === 'B';
      const txt = n.textContent.split(/\s+/).filter(Boolean);
      txt.forEach(w => out.push(`<span class="w${hl ? ' hl' : ''}">${esc(w)}</span>`));
    });
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = out.join(' ');
  });
}

function tilt() {
  if (REDUCE || !FINE) return;
  document.addEventListener('pointermove', e => {
    const c = e.target.closest && e.target.closest('.mcard');
    $$('.mcard.tilted').forEach(x => { if (x !== c) { x.style.transform = ''; x.classList.remove('tilted'); } });
    if (!c) return;
    const r = c.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
    c.style.transform = `perspective(1000px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg) translateY(-6px)`;
    c.classList.add('tilted');
  });
  document.addEventListener('pointerleave', () => $$('.mcard.tilted').forEach(x => { x.style.transform = ''; x.classList.remove('tilted'); }));
  document.addEventListener('pointermove', e => {
    const b = e.target.closest && e.target.closest('.btn-gold,.btn-ghost');
    $$('.btn.mag').forEach(x => { if (x !== b) { x.style.translate = ''; x.classList.remove('mag'); } });
    if (!b) return;
    const r = b.getBoundingClientRect();
    b.style.translate = `${((e.clientX - r.left - r.width / 2) * .16).toFixed(1)}px ${((e.clientY - r.top - r.height / 2) * .22).toFixed(1)}px`;
    b.classList.add('mag');
  });
}

let ticking = false;
function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
function frame() {
  ticking = false;
  const y = scrollY, vh = innerHeight, max = document.documentElement.scrollHeight - vh;
  const hdr = $('#hdr'); if (hdr) hdr.classList.toggle('scrolled', y > 40);
  const pr = $('#progress'); if (pr) pr.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
  if (REDUCE) return;
  $$('.hero-bg,.cta .bg').forEach(el => {
    const r = el.parentElement.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    el.style.setProperty('--py', ((vh / 2 - (r.top + r.height / 2)) * -.12).toFixed(1) + 'px');
  });
  $$('.statement').forEach(el => {
    const r = el.getBoundingClientRect(), w = $$('.w', el);
    const p = clamp((vh * .9 - r.top) / (r.height + vh * .2), 0, 1), n = p * (w.length + 2);
    w.forEach((s, i) => { s.style.opacity = (.16 + .84 * clamp(n - i, 0, 1)).toFixed(2); });
  });
}

function rails() {
  $$('[data-rail]').forEach(w => {
    const rail = $('.rail', w);
    const go = d => rail.scrollBy({ left: d * Math.min(420, rail.clientWidth * .8), behavior: 'smooth' });
    const p = $('[data-prev]', w), n = $('[data-next]', w);
    if (p) p.addEventListener('click', () => go(-1));
    if (n) n.addEventListener('click', () => go(1));
  });
}

function scrollspy() {
  const links = $$('.toc a'); if (!links.length || !('IntersectionObserver' in window)) return;
  const map = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { links.forEach(l => l.classList.remove('on')); const a = map.get(e.target.id); if (a) a.classList.add('on'); }
  }), { rootMargin: '-30% 0px -60% 0px' });
  $$('.art').forEach(a => io.observe(a));
}

/* ------------------------------------------------------------ catalogue */
const ENG = { 'Diesel': 'fa-gas-pump', 'Hybride': 'fa-leaf', 'Électrique': 'fa-bolt', 'GNV': 'fa-fire-flame-simple', 'Hydrogène': 'fa-droplet' };
const engIcon = m => ENG[m] || 'fa-gas-pump';
const TKEY = { 'Minibus': 'minibus', 'Midibus': 'midibus', 'Standards': 'standard', 'Articulés': 'articule', 'BHNS': 'bhns', 'LE & Cars': 'carle' };
function tarifOf(cat, d) { const k = TKEY[cat]; return k && d && d.tarifs ? d.tarifs.find(t => t.cle === k) : null; }
function yearsOf(m) { const y = Object.keys(m.annees || {}).sort(); return !y.length ? '' : (y.length === 1 ? y[0] : y[0] + ' – ' + y[y.length - 1]); }
function fmtDate(s) { return s ? s.split('-').reverse().join('/') : ''; }
const modelHref = m => `${BASE}modele.html?m=${encodeURIComponent(m.cle)}`;

function cardHTML(m, d, i) {
  const t = tarifOf(m.categorie, d), photo = m.photos && m.photos[0];
  const avail = m.suivis > 0 ? (m.disponibles > 0 ? `<span class="avail">${m.disponibles} disponible${m.disponibles > 1 ? 's' : ''}</span>` : '') : '';
  const motors = (m.moteurs || []).length ? `<li><i class="fa-solid ${engIcon(m.moteurs[0])}"></i>${esc(m.moteurs.join(' · '))}</li>` : '';
  const yrs = yearsOf(m) ? `<li><i class="fa-regular fa-calendar"></i>${esc(yearsOf(m))}</li>` : '';
  return `<a class="mcard fadein" style="--d:${Math.min(i, 12) * 55}ms" href="${modelHref(m)}">
    <div class="mcard-media">${photo ? `<img src="${esc(photo)}" alt="${esc(m.marque + ' ' + m.modele)}" loading="lazy" decoding="async">` : `<div class="ph">${busSVG(m.categorie)}</div>`}
      <span class="tag">${esc(m.categorie)}</span>${avail}</div>
    <div class="mcard-body"><div class="mcard-brand">${esc(m.marque || '—')}</div><h3>${esc(m.modele)}</h3>
      <ul class="specs">${motors}${yrs}<li><i class="fa-solid fa-bus"></i>${m.quantite} véhicule${m.quantite > 1 ? 's' : ''}</li></ul>
      <div class="mcard-foot"><span class="price">${t ? `<i>Location dès</i>${fmt(t.s)} € <small>/ semaine</small>` : '<i>Location</i><small>Tarif sur demande</small>'}</span><span class="more"><i class="fa-solid fa-arrow-right"></i></span></div></div></a>`;
}

function pageHome(d) {
  const rail = $('#rail'); if (!rail) return;
  if (!d || !d.models || !d.models.length) {
    rail.innerHTML = `<div class="empty" style="flex:1 1 100%;background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.18);color:rgba(255,255,255,.7)"><b style="color:#fff">Le catalogue arrive bientôt</b>Les véhicules de l’alliance sont en cours de mise en ligne.</div>`;
    return;
  }
  const list = d.models.slice().sort((a, b) => ((b.photos || []).length - (a.photos || []).length) || (b.quantite - a.quantite)).slice(0, 10);
  rail.innerHTML = list.map((m, i) => cardHTML(m, d, i)).join('');
}

function pageParc(d) {
  const grid = $('#grid'); if (!grid) return;
  const bar = $('#fbar');
  if (!d || !d.models || !d.models.length) {
    bar.style.display = 'none'; $('#count').textContent = '';
    grid.innerHTML = `<div class="empty"><b>${d ? 'Le catalogue est en cours de mise en ligne' : 'Le catalogue est momentanément indisponible'}</b>${d ? 'Revenez bientôt : les véhicules de l’alliance apparaîtront ici.' : 'Merci de réessayer dans quelques instants.'}</div>`;
    return;
  }
  const S = { cat: new URLSearchParams(location.search).get('cat') || 'Tous', q: '', moteur: '', dispo: false, sort: 'cat' };
  if (S.cat !== 'Tous' && !CATS.includes(S.cat)) S.cat = 'Tous';
  const cnt = c => d.models.filter(m => c === 'Tous' || m.categorie === c).reduce((n, m) => n + m.quantite, 0);
  $('#chips').innerHTML = ['Tous'].concat(CATS).filter(c => c === 'Tous' || cnt(c) > 0).map(c => `<button class="chip" data-c="${esc(c)}">${esc(c)} <em>${cnt(c)}</em></button>`).join('');
  const motors = Array.from(new Set(d.models.flatMap(m => m.moteurs || []))).sort();
  $('#f-moteur').innerHTML = '<option value="">Toutes motorisations</option>' + motors.map(x => `<option>${esc(x)}</option>`).join('');
  if (!d.models.some(m => m.suivis > 0)) $('#f-dispo').style.display = 'none';
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function render() {
    $$('.chip').forEach(c => c.classList.toggle('on', c.dataset.c === S.cat));
    let l = d.models.filter(m => (S.cat === 'Tous' || m.categorie === S.cat) && (!S.moteur || (m.moteurs || []).includes(S.moteur)) && (!S.dispo || m.disponibles > 0) &&
      (!S.q || norm(m.marque + ' ' + m.modele + ' ' + m.categorie).includes(norm(S.q))));
    const by = {
      cat: (a, b) => CATS.indexOf(a.categorie) - CATS.indexOf(b.categorie) || (a.marque + a.modele).localeCompare(b.marque + b.modele, 'fr'),
      nom: (a, b) => (a.marque + a.modele).localeCompare(b.marque + b.modele, 'fr'),
      qte: (a, b) => b.quantite - a.quantite,
      recent: (a, b) => (Object.keys(b.annees || {}).sort().pop() || 0) - (Object.keys(a.annees || {}).sort().pop() || 0)
    };
    l.sort(by[S.sort]);
    $('#count').textContent = `${l.length} modèle${l.length > 1 ? 's' : ''} · ${l.reduce((n, m) => n + m.quantite, 0)} véhicules`;
    grid.innerHTML = l.length ? l.map((m, i) => cardHTML(m, d, i)).join('') : '<div class="empty"><b>Aucun modèle ne correspond</b>Essayez d’élargir vos filtres.</div>';
    const u = new URL(location.href); S.cat === 'Tous' ? u.searchParams.delete('cat') : u.searchParams.set('cat', S.cat); history.replaceState(null, '', u);
  }
  $('#chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (b) { S.cat = b.dataset.c; render(); } });
  $('#f-q').addEventListener('input', e => { S.q = e.target.value; render(); });
  $('#f-moteur').addEventListener('change', e => { S.moteur = e.target.value; render(); });
  $('#f-sort').addEventListener('change', e => { S.sort = e.target.value; render(); });
  $('#f-dispo').addEventListener('click', e => { S.dispo = !S.dispo; e.currentTarget.classList.toggle('on', S.dispo); render(); });
  render();
}

function pageModele(d) {
  const out = $('#fiche'); if (!out) return;
  const key = new URLSearchParams(location.search).get('m') || '';
  const m = d && d.models ? d.models.find(x => x.cle === key) : null;
  if (!m) {
    out.innerHTML = `<div class="empty"><b>${d ? 'Modèle introuvable' : 'Catalogue momentanément indisponible'}</b><a class="link" href="${BASE}parc.html"><i class="fa-solid fa-arrow-left"></i> Retour au parc</a></div>`;
    return;
  }
  document.title = `${m.marque} ${m.modele} — Lutèce Group`;
  $('#crumb-name').textContent = `${m.marque} ${m.modele}`.trim();
  $('#crumb-cat').textContent = m.categorie; $('#crumb-cat').href = `${BASE}parc.html?cat=${encodeURIComponent(m.categorie)}`;
  const hero = $('#fiche-hero-title'); if (hero) hero.textContent = `${m.marque} ${m.modele}`.trim();
  const t = tarifOf(m.categorie, d);
  const vs = (d.vehicles || []).filter(v => v.cle === m.cle);
  const photos = m.photos || [];
  const gal = photos.length
    ? photos.map((p, i) => `<img class="${i ? '' : 'show'}" data-i="${i}" src="${esc(p)}" alt="${esc(m.marque + ' ' + m.modele)} — photo ${i + 1}" decoding="async">`).join('')
    : `<div class="ph show">${busSVG(m.categorie)}</div>`;
  const thumbs = photos.length > 1 ? `<div class="gal-thumbs">${photos.map((p, i) => `<button type="button" class="${i ? '' : 'on'}" data-i="${i}" aria-label="Photo ${i + 1}"><img src="${esc(p)}" alt="" loading="lazy"></button>`).join('')}</div>` : '';
  const kv = [['Catégorie', m.categorie], ['Constructeur', m.marque], ['Motorisation', (m.moteurs || []).join(' · ')], ['Mise en service', yearsOf(m)],
    ['Places', m.places], ['Portes', m.portes], ['Consommation', m.conso], ['Climatisation / ventilation', m.clim], ['Accessibilité', m.accessibilite], ['Options', m.options], ['Au parc', m.quantite + ' véhicule' + (m.quantite > 1 ? 's' : '')]]
    .filter(x => x[1]).map(x => `<div><span>${esc(x[0])}</span><b>${esc(x[1])}</b></div>`).join('');
  const sCls = { 'Disponible': 's-disp', 'En préparation': 's-prep', 'Aux ateliers': 's-atel', 'En location': 's-loc' };
  const rows = vs.sort((a, b) => String(a.ref).localeCompare(String(b.ref), 'fr', { numeric: true })).map(v => `<tr><td><b>${esc(v.ref || '—')}</b></td><td>${esc(v.annee || '—')}</td><td>${esc(v.moteur || '—')}</td>
    <td>${v.statut ? `<span class="badge ${sCls[v.statut] || ''}">${esc(v.statut)}</span>${v.retour ? ` <small style="color:var(--muted)">retour le ${fmtDate(v.retour)}</small>` : ''}` : '<span style="color:var(--muted)">—</span>'}</td></tr>`).join('');
  const tar = t ? `<div class="tbl-w"><table class="tbl"><thead><tr><th>Durée</th><th>Standard</th><th class="col-u">Ultimate</th></tr></thead><tbody>
      <tr><td>À la semaine</td><td><b>${fmt(t.s)} €</b></td><td class="col-u">Gratuit*</td></tr>
      <tr><td>Au mois</td><td><b>${fmt(t.m)} €</b></td><td class="col-u">Gratuit*</td></tr></tbody></table></div>
      <p class="note">*Forfait Ultimate : gratuité totale dans la limite de 25 véhicules par type.${t.note ? ' ' + esc(t.note) + '.' : ''}</p>`
    : `<div class="callout"><b>Tarif sur demande</b>Ce type de véhicule n’a pas de tarif de location publié. Faites votre demande de location, nous vous répondrons.</div>`;
  const similar = d.models.filter(x => x.categorie === m.categorie && x.cle !== m.cle).slice(0, 8);
  out.innerHTML = `<div class="wrap"><div class="fiche">
    <div class="rv"><div class="gal-main" id="gal">${gal}</div>${thumbs}</div>
    <aside class="fiche-side rv" style="--d:120ms"><span class="eyebrow">${esc(m.categorie)}</span><h1>${esc(m.modele)}</h1><div class="lead" style="font-size:19px">${esc(m.marque)}</div>
      <div class="kv">${kv}</div>
      <div style="display:flex;gap:12px;flex-wrap:wrap"><a class="btn btn-dark" data-link="demande_location" href="#"><i class="fa-solid fa-file-signature"></i> Demander la location</a><a class="btn btn-line" href="${BASE}pole-location.html#tarifs">Conditions de location</a></div>
    </aside></div></div>
    <section class="sec sec--soft" style="margin-top:clamp(64px,9vw,120px)"><div class="wrap"><div class="head rv"><span class="eyebrow">Tarifs</span><h2 class="h-md">Louer ce modèle</h2></div><div class="rv">${tar}</div></div></section>
    ${rows ? `<section class="sec"><div class="wrap"><div class="head rv"><span class="eyebrow">Au parc</span><h2 class="h-md">Les ${vs.length} véhicule${vs.length > 1 ? 's' : ''} de ce modèle</h2></div>
      <div class="tbl-w rv"><table class="tbl"><thead><tr><th>N° de parc</th><th>Mise en service</th><th>Motorisation</th><th>Disponibilité</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div></section>` : ''}
    ${similar.length ? `<section class="sec sec--dark"><div class="wrap" data-rail><div class="rail-top"><div><span class="eyebrow">Dans la même catégorie</span><h2 class="h-md" style="margin-top:14px">D’autres ${esc(m.categorie)}</h2></div>
      <div class="rail-ctl"><button data-prev aria-label="Précédent"><i class="fa-solid fa-arrow-left"></i></button><button data-next aria-label="Suivant"><i class="fa-solid fa-arrow-right"></i></button></div></div>
      <div class="rail">${similar.map((x, i) => cardHTML(x, d, i)).join('')}</div></div></section>` : ''}`;
  // galerie
  const g = $('#gal');
  $$('.gal-thumbs button').forEach(b => b.addEventListener('click', () => {
    $$('img', g).forEach(i => i.classList.toggle('show', i.dataset.i === b.dataset.i));
    $$('.gal-thumbs button').forEach(x => x.classList.toggle('on', x === b));
  }));
  applyData(d); observeReveal(out); rails();
}

function pageTarifs(d) {
  const body = $('#tarifs-body'); if (!body || !d || !d.tarifs) return;
  body.innerHTML = d.tarifs.map(t => `<tr><td><b>${esc(t.label)}</b>${t.note ? `<br><small style="color:var(--muted)">${esc(t.note)}</small>` : ''}</td><td>${fmt(t.s)} €</td><td>${fmt(t.m)} €</td></tr>`).join('');
}

/* ------------------------------------------------------------ démarrage */
function init() {
  ensureFavicon();
  preloader();
  mountChrome(); decorate(); splitStatement(); stagger(); observeReveal(); observeCounters(); tilt(); rails(); scrollspy();
  addEventListener('scroll', onScroll, { passive: true }); addEventListener('resize', onScroll); onScroll();
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('loaded')));
  loadSite().then(st => {
    applyStudioSettings(st); applyLinks(st); applyReglement(st); mountDiscord(st); showPopup(st);
    if (page === 'home') pageHomeNews(st);
    if (page === 'articles') pageArticles(st);
    observeReveal(); onScroll();
  });
  if (page === 'article') pageArticle().then(() => { observeReveal(); onScroll(); });
  loadData().then(d => {
    applyData(d);
    if (page === 'home') pageHome(d);
    if (page === 'parc') pageParc(d);
    if (page === 'modele') pageModele(d);
    if (page === 'location') pageTarifs(d);
    const jn = $('.join [data-link]');
    if (jn && !jn.classList.contains('ok')) { const n = $('.join .note'); if (n) n.textContent = 'Le lien de demande n’est pas encore disponible. Rendez-vous sur Transport Manager pour faire votre demande d’adhésion.'; }
    observeReveal(); observeCounters(); onScroll();
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
