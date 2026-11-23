// Contenu éditorial du site public : articles, pop-up, liens supplémentaires, widget Discord.
// Lecture seule. Tout est configuré depuis l'espace staff (tables Supabase) :
// aucun lien ni identifiant n'est écrit dans le code.
const TIMEOUT_MS = 8000;

const str = (v, max) => String(v == null ? '' : v).slice(0, max);
const url = v => { try { const u = new URL(String(v)); return /^https?:$/.test(u.protocol) ? u.toString() : ''; } catch (e) { return ''; } };

async function rest(base, h, path) {
  const r = await fetch(base + path, { headers: h, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

function articleOut(a, full) {
  const o = {
    slug: str(a.slug, 120), titre: str(a.titre, 200), resume: str(a.resume, 400),
    image: url(a.image_url), date: str(a.publie_le || a.created_at, 40), auteur: str(a.auteur, 80),
    categorie: str(a.categorie, 60)
  };
  if (full) o.contenu = str(a.contenu, 60000);
  return o;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.setHeader('Allow', 'GET, HEAD'); res.status(405).end(); return; }
  const { SUPABASE_URL } = process.env;
  const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_KEY;
  const out = { generated_at: new Date().toISOString(), articles: [], article: null, popup: null, links: [], discord: null, reglement: null, brand: null, theme: null, navigation: null, seo: null, pages: null, home: null, publication: null, warnings: [] };
  if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) { out.warnings.push('db-config'); res.setHeader('Cache-Control', 'no-store'); res.status(200).json(out); return; }
  const base = SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/';
  const h = { apikey: SUPABASE_SECRET_KEY, Authorization: 'Bearer ' + SUPABASE_SECRET_KEY };
  const slug = String((req.query && req.query.slug) || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 120);
  const now = encodeURIComponent(new Date().toISOString());
  const cols = 'slug,titre,resume,image_url,publie_le,created_at,auteur,categorie' + (slug ? ',contenu' : '');
  try {
    const [cfg, arts] = await Promise.allSettled([
      rest(base, h, 'app_config?select=key,value&key=in.(site_popup,site_links_extra,site_discord,site_reglement,site_brand,site_theme,site_navigation,site_seo,site_pages,site_home,site_publication)'),
      rest(base, h, 'articles?select=' + cols + '&publie=eq.true&publie_le=lte.' + now + (slug ? '&slug=eq.' + slug + '&limit=1' : '&order=publie_le.desc&limit=60'))
    ]);
    if (cfg.status === 'fulfilled') {
      const c = {};
      for (const r of cfg.value || []) { try { c[r.key] = JSON.parse(r.value); } catch (e) {} }
      const p = c.site_popup;
      if (p && p.actif && (p.titre || p.texte)) {
        const t = Date.now();
        const d0 = p.debut ? Date.parse(p.debut) : NaN, d1 = p.fin ? Date.parse(p.fin) : NaN;
        if ((isNaN(d0) || t >= d0) && (isNaN(d1) || t <= d1)) {
          out.popup = { id: str(p.id || p.version || '', 40), titre: str(p.titre, 120), texte: str(p.texte, 1200), image: url(p.image), bouton: str(p.bouton, 60), lien: url(p.lien) };
        }
      }
      if (Array.isArray(c.site_links_extra)) {
        out.links = c.site_links_extra.map(l => ({ label: str(l && l.label, 80), url: url(l && l.url), zone: l && l.zone === 'menu' ? 'menu' : 'footer' })).filter(l => l.label && l.url).slice(0, 40);
      }
      const d = c.site_discord;
      if (d && /^\d{5,25}$/.test(String(d.id || ''))) out.discord = { id: String(d.id), theme: d.theme === 'light' ? 'light' : 'dark' };
      const rg = c.site_reglement;
      if (rg && (rg.version || rg.introduction)) out.reglement = { version: str(rg.version, 40), introduction: str(rg.introduction, 240) };
      const brand = c.site_brand;
      if (brand) out.brand = { name: str(brand.name, 80), slogan: str(brand.slogan, 100), logo: url(brand.logo), cta: str(brand.cta, 50) };
      const theme = c.site_theme;
      if (theme) out.theme = { navy: str(theme.navy, 20), gold: str(theme.gold, 20), accent: str(theme.accent, 20) };
      if (c.site_navigation) out.navigation = c.site_navigation;
      if (c.site_seo) out.seo = c.site_seo;
      if (c.site_pages) out.pages = c.site_pages;
      if (c.site_home) out.home = c.site_home;
      if (c.site_publication) out.publication = c.site_publication;
    } else out.warnings.push('config');
    if (arts.status === 'fulfilled') {
      if (slug) out.article = arts.value && arts.value[0] ? articleOut(arts.value[0], true) : null;
      else out.articles = (arts.value || []).map(a => articleOut(a, false));
    } else out.warnings.push('articles: ' + String(arts.reason && arts.reason.message || arts.reason).slice(0, 80));
  } catch (e) { out.warnings.push('site'); }
  res.setHeader('Cache-Control', out.warnings.length ? 'no-store' : 'public, s-maxage=60, stale-while-revalidate=300');
  res.status(200).json(out);
}
