/* Menu + footer uniques, injectés sur toutes les pages.
   Structure reprise du site Lutèce Group d'origine :
   Qui sommes-nous ? / Service Location / Service Exploitation et Financement.
   Une seule source : modifier ici = modifier partout. */
(function () {
  const MENU = [
    { label: 'Qui sommes-nous ?', items: [
      ['presentation.html', 'Présentation de Lutèce Group'],
      ['reglement.html', "Le règlement de l'Alliance"],
      ['forfaits.html', 'Nos forfaits']
    ]},
    { label: 'Service Location', items: [
      ['pole-location.html', 'Pôle Location'],
      ['parc.html', 'Notre Parc']
    ]},
    { label: 'Service Exploitation et Financement', items: [
      ['pole-exploitation.html', 'Pôle Exploitation'],
      ['pole-financement.html', 'Pôle Financement']
    ]}
  ];
  const page = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const current = page === 'vehicule.html' ? 'parc.html' : page;

  const nav = MENU.map(g => {
    const active = g.items.some(i => i[0] === current);
    return `<div class="nav-item ${active ? 'active' : ''}">
      <button class="nav-link" type="button" aria-haspopup="true">${g.label} <span class="chev">▾</span></button>
      <div class="dropdown">${g.items.map(i =>
        `<a href="${i[0]}" class="${i[0] === current ? 'active' : ''}">${i[1]}</a>`).join('')}</div>
    </div>`;
  }).join('');

  const header = `<header class="site-header"><div class="container header-inner">
    <a href="index.html" class="logo" aria-label="Lutèce Group — Accueil">
      <span class="logo-mark">LG</span><span>LUTÈCE GROUP<small>Opérateur de transport</small></span>
    </a>
    <button class="menu-button" id="menuButton" type="button" aria-label="Ouvrir le menu" aria-expanded="false">☰</button>
    <nav class="nav" id="mainNav" aria-label="Navigation principale">${nav}
      <a href="rejoindre.html" class="btn btn-gold nav-cta">Nous rejoindre</a>
    </nav></div></header>`;

  const footer = `<footer class="site-footer"><div class="container">
    <div class="footer-grid">
      <div class="footer-brand"><div class="logo" style="color:#fff"><span class="logo-mark">LG</span><span>LUTÈCE GROUP</span></div>
        <p>Opérateur de transport et prestataire de services privé, spécialisé dans les services auxiliaires des transports terrestres.</p></div>
      <div><h4>Qui sommes-nous ?</h4><ul>
        <li><a href="presentation.html">Présentation</a></li><li><a href="reglement.html">Règlement</a></li><li><a href="forfaits.html">Forfaits</a></li></ul></div>
      <div><h4>Location</h4><ul>
        <li><a href="pole-location.html">Pôle Location</a></li><li><a href="parc.html">Notre Parc</a></li></ul></div>
      <div><h4>Exploitation &amp; Financement</h4><ul>
        <li><a href="pole-exploitation.html">Pôle Exploitation</a></li><li><a href="pole-financement.html">Pôle Financement</a></li>
        <li><a href="rejoindre.html">Nous rejoindre</a></li></ul></div>
    </div>
    <div class="footer-bottom"><span>© 2026 Lutèce Group</span>
      <span>Site fictif, conçu dans le cadre du jeu <a href="https://transport-manager.net/">Transport Manager</a></span></div>
  </div></footer>`;

  document.addEventListener('DOMContentLoaded', () => {
    const h = document.getElementById('site-header'), f = document.getElementById('site-footer');
    if (h) h.outerHTML = header;
    if (f) f.outerHTML = footer;

    const btn = document.getElementById('menuButton'), n = document.getElementById('mainNav');
    btn && btn.addEventListener('click', () => {
      const open = n.classList.toggle('open');
      btn.setAttribute('aria-expanded', open);
      btn.textContent = open ? '✕' : '☰';
    });
    document.querySelectorAll('.nav-item > .nav-link').forEach(b =>
      b.addEventListener('click', () => {
        if (window.innerWidth <= 1020) b.parentElement.classList.toggle('open');
      }));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && n) { n.classList.remove('open'); btn && (btn.textContent = '☰'); }
    });
    document.querySelectorAll('.acc-q').forEach(q =>
      q.addEventListener('click', () => q.parentElement.classList.toggle('open')));
  });
})();
