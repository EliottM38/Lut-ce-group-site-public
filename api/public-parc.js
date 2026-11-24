// ============================================================
// API PUBLIQUE (lecture seule) du site public
// ------------------------------------------------------------
// - Aucune clé ni URL dans le code : tout vient des variables Vercel
//   (TM_API_KEY, TM_API_BASE, SUPABASE_URL, SUPABASE_SECRET_KEY)
//   et de la table app_config (liens des Google Sheets, liens publics).
// - GET uniquement, aucun paramètre ne choisit l'URL appelée en amont.
// - Seuls des champs filtrés (liste blanche) sont renvoyés : jamais de
//   nom de membre, de comptabilité, de salarié ni de clé.
// - Réponse mise en cache par le CDN Vercel (5 min).
// ============================================================

const TIMEOUT_MS = 8000;

// ---------- utilitaires ----------
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// IMPORTANT : même algorithme que pubCle() dans index.html (gestion)
const cleOf = (marque, modele) => norm(marque) + '|' + norm(modele);
const flat = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
// Les références TM peuvent être des nombres, des chaînes ou contenir des espaces.
// Une clé stable évite de rater un véhicule loué lors de la fusion global/location.
const refKey = value => String(value ?? '').trim().toLowerCase().replace(/[\s._-]+/g, '');

function pick(obj, aliases) {
  if (!obj || typeof obj !== 'object') return '';
  const map = {};
  for (const k of Object.keys(obj)) map[flat(k)] = obj[k];
  for (const a of aliases) {
    const v = map[flat(a)];
    if (v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

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

async function getJSON(url, headers) {
  const r = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  const t = await r.text();
  try { return JSON.parse(t); } catch (e) { throw new Error('réponse non JSON (' + (r.headers.get('content-type') || '?') + ')'); }
}

const asList = raw => Array.isArray(raw) ? raw
  : (raw && (raw.data || raw.vehicules || Object.values(raw).find(Array.isArray))) || [];

// ---------- catégories ----------
const CATEGORIES = ['Minibus', 'Midibus', 'Standards', 'Articulés', 'BHNS', 'LE & Cars'];

function categorize(...hints) {
  const t = norm(hints.join(' '));
  if (/bhns|brt|\btram/.test(t)) return 'BHNS';
  if (/\bmini|sprinter/.test(t)) return 'Minibus';
  if (/\bmidi|\bcitaro k\b/.test(t)) return 'Midibus';
  if (/articul|\bgu\s*c2\b|double|\bciti?aro\s*g\b|\bg\s*c2\b|\b(lion.?s city|urbino|solaris|sileo)\s*18\b|\b(eletta|e0[0-9]+)\s*g\b/.test(t)) return 'Articulés';
  if (/\bcar\b|autocar|\ble\b|low entry|intercit|tourisme/.test(t)) return 'LE & Cars';
  return 'Standards';
}

function motorLabel(v) {
  const t = norm(v);
  if (!t) return '';
  if (/hybrid/.test(t)) return 'Hybride';
  if (/electr|elec|batterie/.test(t)) return 'Électrique';
  if (/gnv|gaz|biogaz|cng/.test(t)) return 'GNV';
  if (/hydrog/.test(t)) return 'Hydrogène';
  if (/diesel|gazole/.test(t)) return 'Diesel';
  return String(v).trim();
}

function yearOf(v) {
  const m = String(v ?? '').match(/(19|20)\d{2}/);
  return m ? m[0] : '';
}

function dateOf(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const d = new Date(s);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return '';
}

// État (usure) : accepte « 87 », « 87 % », « 0,87 » ; renvoie un entier 0-100 ou null (texte non chiffré, vide).
function pctOf(v) {
  const m = String(v ?? '').replace(',', '.').match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  let n = parseFloat(m[0]);
  if (n > 0 && n <= 1 && !/%/.test(String(v))) n *= 100;
  return Math.max(0, Math.min(100, Math.round(n)));
}
// Kilométrage : « 123 456 », « 123456 km » → entier, ou null.
function kmOf(v) {
  const t = String(v ?? '').replace(/[\s\u00a0.]/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  return t ? Math.round(parseFloat(t[0])) : null;
}

function statusLabel(v) {
  const t = norm(v);
  if (!t) return '';
  if (/dispo/.test(t)) return 'Disponible';
  if (/prepa/.test(t)) return 'En préparation';
  if (/atelier|panne|repar/.test(t)) return 'Aux ateliers';
  if (/location|loue/.test(t)) return 'En location';
  return '';
}

// « parc=location » ne suffit pas à prouver qu'un véhicule est loué : selon
// les versions de TM, cet endpoint peut aussi contenir tout le parc affecté à
// la location. On ne retient que ses champs explicitement contractuels.
function activeRental(raw) {
  const truthy = value => /^(1|true|oui|yes)$/i.test(String(value ?? '').trim());
  if (['en_location', 'est_loue', 'loue', 'loué'].some(key => truthy(pick(raw, [key])))) return true;
  const state = statusLabel(pick(raw, ['statut_location', 'etat_location', 'location_statut', 'statut_contrat', 'contrat_statut']));
  if (state === 'En location') return true;
  const renter = pick(raw, ['locataire', 'client_location', 'membre_location', 'entreprise_location', 'contractant']);
  const start = dateOf(pick(raw, ['date_debut_location', 'debut_location', 'location_debut', 'date_debut_contrat']));
  const end = dateOf(pick(raw, ['date_fin_location', 'fin_location', 'location_fin', 'date_fin_contrat']));
  return Boolean(renter && start && (!end || end >= new Date().toISOString().slice(0, 10)));
}

// ---------- normalisation des véhicules ----------
const unent = x => String(x == null ? '' : x).replace(/&#0*39;|&apos;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function fromTM(v) {
  const marqueRaw = pick(v, ['marque', 'constructeur', 'brand', 'fabricant']);
  const modeleRaw = pick(v, ['modele', 'model', 'nom_modele', 'designation', 'nom']);
  const marque = unent(marqueRaw), modele = unent(modeleRaw);
  const type = pick(v, ['categorie', 'category', 'type_vehicule', 'type', 'genre']);
  return {
    ref: pick(v, ['numero_parc', 'num_parc', 'n_parc', 'parc_numero', 'numero', 'immatriculation', 'id']),
    marque, modele, cleRaw: cleOf(marqueRaw, modeleRaw),
    categorie: (Number(String(pick(v, ['places', 'nb_places', 'capacite', 'places_totales'])).replace(/\D/g, '')) >= 140 && categorize(type, modele) === 'Standards') ? 'Articulés' : categorize(type, modele),
    moteur: motorLabel(pick(v, ['motorisation', 'moteur', 'energie', 'carburant', 'type_moteur'])),
    annee: yearOf(pick(v, ['mise_en_service', 'date_mise_en_service', 'mes', 'annee', 'year', 'date_achat'])),
    places: pick(v, ['places', 'nb_places', 'capacite', 'places_totales']),
    portes: pick(v, ['portes', 'nb_portes']),
    clim: pick(v, ['climatisation', 'clim', 'ventilation']),
    accessibilite: pick(v, ['accessibilite', 'pmr']),
    options: pick(v, ['options', 'options_usine']),
    conso: pick(v, ['consommation', 'conso', 'consommation_100km']),
    etat_tech: pctOf(pick(v, ['etat_technique', 'etat_moteur', 'etat_mecanique', 'usure_technique', 'etat_tech'])),
    etat_int: pctOf(pick(v, ['etat_interieur', 'etat_int', 'usure_interieur', 'etat_habitacle'])),
    km: kmOf(pick(v, ['kilometrage', 'kilometres', 'km', 'compteur', 'odometre'])),
    // TM renseigne l'état opérationnel ici (disponible, location, atelier…).
    // Cet état est distinct du seul nom du parc utilisé par l'endpoint location.
    statut: statusLabel(pick(v, ['disponibilite', 'disponibilité', 'statut_disponibilite', 'statut', 'etat', 'status'])), retour: dateOf(pick(v, ['date_fin', 'fin', 'retour']))
  };
}

function fromSheet(rows, categorie) {
  if (!rows || rows.length < 2) return [];
  const head = rows[0].map(flat);
  const col = (...names) => { for (const n of names) { const i = head.indexOf(flat(n)); if (i !== -1) return i; } return -1; };
  const C = {
    ref: col('Numéro de Parc', 'N° de parc', 'Numéro de Parc Réparation prévue', 'Parc', 'Numéro'),
    marque: col('Marque'), modele: col('Modèle', 'Modele'),
    moteur: col('Motorisation', 'Moteur'), annee: col('M.E.S', 'Mise en service', 'Année'),
    statut: col('Statut', 'Disponibilité'), retour: col('Date de retour', 'Date de retour DATE MAXIMUM ATTEINTE'),
    places: col('Places'), portes: col('Portes'), clim: col('Ventilation', 'Climatisation'),
    options: col("OPTIONS D'USINE", 'Options'),
    conso: col('Consommation', 'Conso'),
    etat_tech: col('État Moteur', 'Etat Moteur', 'État technique', 'Etat technique'),
    etat_int: col('État Intérieur', 'Etat Intérieur', 'Etat interieur'),
    km: col('Kilométrage', 'Kilometrage', 'Km')
  };
  const g = (row, k) => (C[k] >= 0 ? String(row[C[k]] ?? '').trim() : '');
  return rows.slice(1).map(row => ({
    ref: g(row, 'ref'), marque: g(row, 'marque'), modele: g(row, 'modele'),
    categorie: categorie || categorize(g(row, 'modele')),
    moteur: motorLabel(g(row, 'moteur')), annee: yearOf(g(row, 'annee')),
    places: g(row, 'places'), portes: g(row, 'portes'), clim: g(row, 'clim'), accessibilite: '', options: g(row, 'options'),
    conso: g(row, 'conso'), etat_tech: pctOf(g(row, 'etat_tech')), etat_int: pctOf(g(row, 'etat_int')), km: kmOf(g(row, 'km')),
    statut: statusLabel(g(row, 'statut')), retour: dateOf(g(row, 'retour'))
  })).filter(v => v.ref || v.modele);
}

// ---------- tarifs ----------
// Valeurs de repli = tarifs publiés sur le site Lutèce Group ; la table "tarifs" (gestion) fait foi.
const TARIF_DEFAUT = {
  minibus:  { j: 150, s: 900,  m: 3000 },
  midibus:  { j: 200, s: 1200, m: 4000 },
  standard: { j: 250, s: 1500, m: 5000 },
  articule: { j: 300, s: 1800, m: 6000 },
  bhns:     { j: 250, s: 1500, m: 5000 },
  carle:    { j: 250, s: 1500, m: 5000 }
};
const TARIF_META = [
  ['minibus',  'Minibus',          'Minibus',   'Adapté aux TAD du N3'],
  ['midibus',  'Midibus',          'Midibus',   ''],
  ['standard', 'Standards',        'Standards', ''],
  ['articule', 'Articulés',        'Articulés', ''],
  ['bhns',     'BHNS',             'BHNS',      'À partir du N3'],
  ['carle',    'Cars | LE',        'LE & Cars', 'À partir du N4']
];

function buildTarifs(rows) {
  const t = {};
  for (const r of rows || []) t[r.key] = Number(r.value);
  return TARIF_META.map(([k, label, categorie, note]) => {
    const d = TARIF_DEFAUT[k];
    const val = suf => (Number.isFinite(t[`${k}_${suf}`]) && t[`${k}_${suf}`] > 0 ? t[`${k}_${suf}`] : d[suf]);
    return { cle: k, label, categorie, note, j: val('j'), s: val('s'), m: val('m') };
  });
}

// ---------- handler ----------
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { SUPABASE_URL, TM_API_KEY, TM_API_BASE } = process.env;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  const sources = { tm: false, sheet: false, db: false };
  const warnings = [];

  // 1) Base de données : app_config, tarifs, photos
  let cfg = {}, tarifRows = [], photoRows = [], dbBase = '', dbH = null;
  if (SUPABASE_URL && SUPABASE_SECRET_KEY) {
    const h = { apikey: SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + SUPABASE_SECRET_KEY, Accept: 'application/json' };
    const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/';
    dbBase = base; dbH = h;
    const [a, b, c] = await Promise.allSettled([
      getJSON(base + 'app_config?select=key,value&key=in.(site_links,parc_sheet_urls,parc_cache,parc_categories,parc_manual,parc_overrides)', h),
      getJSON(base + 'tarifs?select=key,value', h),
      getJSON(base + 'parc_photos?select=cle,storage_path,ordre&order=ordre.asc,created_at.asc', h)
    ]);
    if (a.status === 'fulfilled') for (const r of a.value) { try { cfg[r.key] = JSON.parse(r.value); } catch (e) {} }
    if (b.status === 'fulfilled') tarifRows = b.value;
    if (c.status === 'fulfilled') photoRows = c.value; else warnings.push('photos');
    sources.db = a.status === 'fulfilled' || b.status === 'fulfilled' || c.status === 'fulfilled';
  } else {
    warnings.push('db');
  }

  const photoBase = SUPABASE_URL ? SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/parc-photos/' : '';
  const photos = {};
  for (const p of photoRows) {
    if (!p.cle || !p.storage_path || !photoBase) continue;
    (photos[p.cle] = photos[p.cle] || []).push(photoBase + p.storage_path.split('/').map(encodeURIComponent).join('/'));
  }

  // 2) API Transport Manager (clé uniquement côté serveur)
  let list = [];
  let enLocation = new Map();
  let locOk = false;
  if (TM_API_KEY) {
    const h = { Authorization: 'Bearer ' + TM_API_KEY, Accept: 'application/json' };
    const baseRaw = (TM_API_BASE || 'https://transport-manager.net').trim(); // même hôte que le site de gestion ; surchargeable par TM_API_BASE
    let base = (/^https?:\/\//i.test(baseRaw) ? baseRaw : 'https://' + baseRaw).replace(/\/+$/, '');
    try { const u = new URL(base); base = /\.[a-z]{2,}$/i.test(u.hostname) ? u.origin : 'https://transport-manager.net'; } catch (e) { base = 'https://transport-manager.net'; } // valeur invalide (ex. une clé collée par erreur) → hôte par défaut
    const baseHost = base.replace(/^https?:\/\//, '');
    const [glob, loc] = await Promise.allSettled([
      getJSON(base + '/api/v1/vehicules?parc=global&limit=1000', h),
      getJSON(base + '/api/v1/vehicules?parc=location&limit=1000', h)
    ]);
    const meta = r => (r && !Array.isArray(r) && typeof r === 'object')
      ? Object.fromEntries(Object.entries(r).filter(([, v]) => ['number', 'boolean'].includes(typeof v) || (typeof v === 'string' && v.length < 40)).slice(0, 8)) : undefined;
    const refOf = raw => pick(raw, ['numero_parc', 'num_parc', 'n_parc', 'parc_numero', 'numero', 'immatriculation', 'id']);
    const byRefTM = new Map();
    const diag = {};
    if (glob.status === 'fulfilled') {
      const items = asList(glob.value).map(fromTM).filter(v => v.ref || v.modele);
      items.forEach(v => byRefTM.set(refKey(v.ref) || Symbol(), v));
      diag.global = items.length; diag.global_keys = Object.keys(asList(glob.value)[0] || {}).slice(0, 40); diag.global_meta = meta(glob.value);
    } else warnings.push('tm[' + baseHost + ']: ' + String(glob.reason && glob.reason.message || glob.reason).slice(0, 80));
    locOk = loc.status === 'fulfilled';
    if (loc.status === 'fulfilled') {
      const items = asList(loc.value);
      diag.location = items.length; diag.location_keys = Object.keys(items[0] || {}).slice(0, 40); diag.location_meta = meta(loc.value);
      for (const raw of items) {
        const ref = refOf(raw);
        const fin = dateOf(pick(raw, ['date_fin', 'fin', 'retour']));
        const key = refKey(ref);
        if (key && activeRental(raw)) enLocation.set(key, fin);
        if (!byRefTM.has(key)) { const v = fromTM(raw); if (v.ref || v.modele) byRefTM.set(refKey(v.ref) || Symbol(), v); }
      }
    } else warnings.push('tm-location: ' + String(loc.reason && loc.reason.message || loc.reason).slice(0, 80));
    list = [...byRefTM.values()];
    sources.tm = list.length > 0;
    sources.tm_detail = diag;
  } else {
    warnings.push('tm-config');
  }

  // Dernière liste TM valide conservée en base : évite un catalogue vide si TM est indisponible un instant
  if (dbH) {
    if (list.length) {
      try {
        await fetch(dbBase + 'app_config?on_conflict=key', {
          method: 'POST', signal: AbortSignal.timeout(TIMEOUT_MS),
          headers: { ...dbH, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ key: 'parc_cache', value: JSON.stringify({ t: Date.now(), list }) })
        });
      } catch (e) {}
    } else if (cfg.parc_cache && Array.isArray(cfg.parc_cache.list) && cfg.parc_cache.list.length) {
      list = cfg.parc_cache.list; sources.cache = true; warnings.push('tm: dernière liste connue (sauvegarde)');
    }
  }

  // 3) Google Sheet(s) : liens stockés en base (aucune URL dans le code)
  const sheetUrls = cfg.parc_sheet_urls && typeof cfg.parc_sheet_urls === 'object' ? cfg.parc_sheet_urls : {};
  const sheetRows = [];
  await Promise.all(Object.entries(sheetUrls).map(async ([cat, url]) => {
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:') return;
      const r = await fetch(u, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const text = await r.text();
      if (text.trim().startsWith('<')) throw new Error('not csv');
      const category = CATEGORIES.includes(cat) ? cat : '';
      sheetRows.push(...fromSheet(parseCSV(text), category));
    } catch (e) { warnings.push('sheet:' + cat); }
  }));
  sources.sheet = sheetRows.length > 0;

  // 4) Fusion par numéro de parc : le Sheet complète/écrase statut, retour, détails.
  // Les locations TM sont appliquées ici, après le repli cache, uniquement si
  // TM fournit une indication explicite de contrat actif.
  const byRef = new Map();
  const noRef = [];
  for (const v of list) (v.ref ? byRef.set(refKey(v.ref), v) : noRef.push(v));
  for (const s of sheetRows) {
    const key = refKey(s.ref);
    const base = key ? byRef.get(key) : null;
    if (base) {
      for (const [k, val] of Object.entries(s)) if (val || (typeof val === 'number' && val === 0)) base[k] = val;
    } else if (key) byRef.set(key, s); else noRef.push(s);
  }

  // Saisie manuelle : sert autant à corriger un statut qu'à garder un véhicule
  // visible si TM est indisponible longtemps. Les valeurs manuelles passent après
  // les imports, mais les informations de location TM restent prioritaires.
  const manualRows = Array.isArray(cfg.parc_manual) ? cfg.parc_manual : [];
  for (const raw of manualRows) {
    if (!raw || typeof raw !== 'object') continue;
    const manual = fromTM(raw);
    const key = refKey(manual.ref);
    if (key && byRef.has(key)) Object.assign(byRef.get(key), Object.fromEntries(Object.entries(manual).filter(([, v]) => v !== '' && v !== null)));
    else if (key) byRef.set(key, manual);
    else if (manual.modele) noRef.push(manual);
  }
  const vehicles = [...byRef.values(), ...noRef];
  for (const v of vehicles) {
    const locationReturn = enLocation.get(refKey(v.ref));
    if (locationReturn !== undefined) { v.statut = 'En location'; v.retour = locationReturn; }
    v.cle = v.cleRaw || cleOf(v.marque, v.modele); delete v.cleRaw;
    if (cfg.parc_categories && CATEGORIES.includes(cfg.parc_categories[v.cle])) v.categorie = cfg.parc_categories[v.cle];
    // Un statut absent ne permet pas de conclure que le véhicule est disponible.
    if (v.statut !== 'En location') v.retour = '';
  }

  // Les corrections de disponibilité décidées par le gestionnaire restent
  // applicables même pendant une panne TM. Elles sont volontairement finales.
  const overrides = cfg.parc_overrides && typeof cfg.parc_overrides === 'object' ? cfg.parc_overrides : {};
  for (const v of vehicles) {
    const override = overrides[refKey(v.ref)];
    if (!override || typeof override !== 'object') continue;
    const statut = statusLabel(override.statut);
    if (statut) v.statut = statut;
    v.retour = v.statut === 'En location' ? dateOf(override.retour) : '';
  }

  // 5) Modèles agrégés (catalogue)
  const models = new Map();
  for (const v of vehicles) {
    if (!v.modele) continue;
    let m = models.get(v.cle);
    if (!m) {
      m = { cle: v.cle, categorie: v.categorie, marque: v.marque, modele: v.modele, moteurs: [], annees: {}, quantite: 0, disponibles: 0,
        suivis: 0, places: '', portes: '', clim: '', accessibilite: '', options: '', conso: '', photos: photos[v.cle] || [] };
      models.set(v.cle, m);
    }
    m.quantite++;
    if (v.statut) m.suivis++;
    if (v.statut === 'Disponible') m.disponibles++;
    if (v.moteur && !m.moteurs.includes(v.moteur)) m.moteurs.push(v.moteur);
    if (v.annee) m.annees[v.annee] = (m.annees[v.annee] || 0) + 1;
    for (const k of ['places', 'portes', 'clim', 'accessibilite', 'options', 'conso']) if (!m[k] && v[k]) m[k] = v[k];
  }
  const modelList = [...models.values()].sort((a, b) =>
    CATEGORIES.indexOf(a.categorie) - CATEGORIES.indexOf(b.categorie) || (a.marque + a.modele).localeCompare(b.marque + b.modele, 'fr'));

  const siteImages = {};
  for (const k of Object.keys(photos)) if (k.startsWith('site:')) siteImages[k.slice(5)] = photos[k][0];

  const links = {};
  if (cfg.site_links && typeof cfg.site_links === 'object') {
    for (const [k, v] of Object.entries(cfg.site_links)) {
      try { const u = new URL(String(v)); if (u.protocol === 'https:' || u.protocol === 'http:') links[k] = u.toString(); } catch (e) {}
    }
  }

  const stats = {
    total: vehicles.length,
    disponibles: vehicles.filter(v => v.statut === 'Disponible').length,
    modeles: modelList.length,
    categories: CATEGORIES.map(c => ({ nom: c, quantite: vehicles.filter(v => v.categorie === c).length }))
  };

  res.setHeader('Cache-Control', vehicles.length ? 'public, s-maxage=120, stale-while-revalidate=600' : 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(200).json({
    generated_at: new Date().toISOString(),
    sources, warnings,
    categories: CATEGORIES,
    stats,
    models: modelList,
    // champs publics uniquement (liste blanche)
    vehicles: vehicles.map(v => ({
      ref: v.ref, cle: v.cle, categorie: v.categorie, marque: v.marque, modele: v.modele,
      moteur: v.moteur, annee: v.annee, statut: v.statut, retour: v.retour,
      // Les données d'état technique et kilométrage restent utilisées en
      // interne, mais ne sont pas exposées aux visiteurs du site public.
    })),
    tarifs: buildTarifs(tarifRows),
    site_images: siteImages,
    links
  });
}
