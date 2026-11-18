/* Couche de données du parc : fusion de 2 sources.
   1) API Transport Manager, via une route PUBLIQUE en lecture seule hébergée sur le
      site de gestion (jamais la clé TM dans ce site public).
   2) Google Sheet publié en CSV (statuts, options, dates de retour).
   Fusion par numéro de parc : le Sheet complète/écrase les champs d'exploitation,
   l'API TM fait foi pour l'existence du véhicule et ses caractéristiques. */
window.LG = (function () {
  const CONFIG = {
    // URL du site de gestion exposant /api/public-parc (à créer côté gestion). Vide = désactivé.
    MANAGEMENT_API: '',
    SHEET_ID: '2PACX-1vROu3RCHzL0ghXoz3KjdrsetZRBv_Purve375qpNmYrPw3dYCeUIClozbvsG6uKtVp9CtiYVcCghUpo',
    // gid de chaque onglet : à renseigner
    TABS: { 'Mini': '', 'Midi': '', 'Standards': '', 'Articulés': '', 'BHNS': '', 'Cars & LE': '' }
  };

  const norm = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function parseCSV(t) {
    const rows = []; let r = [], c = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '"' && q && t[i + 1] === '"') { c += '"'; i++; }
      else if (ch === '"') q = !q;
      else if (ch === ',' && !q) { r.push(c); c = ''; }
      else if ((ch === '\n' || ch === '\r') && !q) {
        if (ch === '\r' && t[i + 1] === '\n') i++;
        r.push(c); if (r.some(v => v.trim())) rows.push(r); r = []; c = '';
      } else c += ch;
    }
    r.push(c); if (r.some(v => v.trim())) rows.push(r);
    return rows;
  }

  function fromSheetRows(rows, category) {
    if (!rows || rows.length < 2) return [];
    const h = rows[0].map(norm);
    const col = (...n) => { for (const x of n) { const i = h.indexOf(norm(x)); if (i !== -1) return i; } return -1; };
    const C = {
      number: col('Numéro de Parc Réparation prévue', 'Numéro de Parc'), brand: col('Marque'), model: col('Modèle'),
      fuel: col('Motorisation'), year: col('M.E.S'), status: col('Statut'),
      returnDate: col('Date de retour DATE MAXIMUM ATTEINTE', 'Date de retour'), engine: col('État Moteur'),
      interior: col('État Intérieur'), seats: col('Places'), ventilation: col('Ventilation'), doors: col('Portes'),
      factory: col("OPTIONS D'USINE"), saeiv: col('OPTIONS SAEIV'), workshop: col('OPTIONS ATELIER')
    };
    const g = (row, k) => C[k] >= 0 ? String(row[C[k]] ?? '').trim() : '';
    return rows.slice(1).map(row => ({
      category, source: 'sheet',
      number: g(row, 'number'), brand: g(row, 'brand'), model: g(row, 'model'), fuel: g(row, 'fuel'), year: g(row, 'year'),
      status: g(row, 'status'), returnDate: g(row, 'returnDate'), engine: g(row, 'engine'), interior: g(row, 'interior'),
      seats: g(row, 'seats'), ventilation: g(row, 'ventilation'), doors: g(row, 'doors'),
      factory: g(row, 'factory'), saeiv: g(row, 'saeiv'), workshop: g(row, 'workshop')
    })).filter(v => v.number || v.model);
  }

  async function loadSheet() {
    const tabs = Object.entries(CONFIG.TABS).filter(([, gid]) => String(gid).trim());
    const res = await Promise.allSettled(tabs.map(async ([cat, gid]) => {
      const url = `https://docs.google.com/spreadsheets/d/e/${CONFIG.SHEET_ID}/pub?output=csv&gid=${encodeURIComponent(gid)}`;
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) throw new Error(cat);
      const t = await r.text();
      if (t.trim().startsWith('<')) throw new Error(cat);
      return fromSheetRows(parseCSV(t), cat);
    }));
    return res.flatMap(x => x.status === 'fulfilled' ? x.value : []);
  }

  async function loadTM() {
    if (!CONFIG.MANAGEMENT_API) return [];
    const r = await fetch(CONFIG.MANAGEMENT_API.replace(/\/$/, '') + '/api/public-parc', { cache: 'no-store' });
    if (!r.ok) throw new Error('TM ' + r.status);
    const raw = await r.json();
    const list = Array.isArray(raw) ? raw : (raw.data || raw.vehicules || []);
    // Champs TM probables : adapter ici quand le format réel de la route sera fixé.
    return list.map(v => ({
      source: 'tm', category: v.categorie || v.type || '',
      number: String(v.numero_parc ?? v.numero ?? v.id ?? ''), brand: v.marque || '', model: v.modele || v.model || '',
      fuel: v.motorisation || '', year: v.mise_en_service || '', status: v.statut || '', seats: v.places || ''
    })).filter(v => v.number);
  }

  let cache = null;
  async function loadFleet() {
    if (cache) return cache;
    const [tm, sheet] = await Promise.allSettled([loadTM(), loadSheet()]);
    const a = tm.status === 'fulfilled' ? tm.value : [];
    const b = sheet.status === 'fulfilled' ? sheet.value : [];
    const map = new Map();
    a.forEach(v => map.set(v.number, v));
    b.forEach(v => { // le Sheet complète les champs non vides
      const base = map.get(v.number) || {};
      const merged = { ...base };
      Object.entries(v).forEach(([k, val]) => { if (val) merged[k] = val; });
      merged.source = base.source ? 'tm+sheet' : 'sheet';
      map.set(v.number, merged);
    });
    cache = { vehicles: [...map.values()], tm: a.length, sheet: b.length };
    return cache;
  }

  const statusClass = s => ({ 'Disponible': 'badge-disponible', 'En prépa loc': 'badge-prepa', 'Aux ateliers': 'badge-ateliers', 'En location': 'badge-location' }[String(s).trim()] || '');

  // Compteur de la page d'accueil
  document.addEventListener('DOMContentLoaded', async () => {
    const el = document.querySelector('[data-stat="vehicules"]');
    if (!el) return;
    try { const { vehicles } = await loadFleet(); if (vehicles.length) el.textContent = vehicles.length; } catch (e) {}
  });

  return { CONFIG, loadFleet, norm, esc, statusClass };
})();
