# Lutèce Group — site public

Site statique (HTML/CSS/JS) + une seule fonction serveur `api/public-parc.js`, entièrement indépendant du site de gestion.

## Aucune clé ni lien dans le code
Tout est lu à l'exécution :
- **Variables d'environnement Vercel** (Settings → Environment Variables) : `TM_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
  L'ancien nom `SUPABASE_SERVICE_KEY` est accepté temporairement pour permettre une rotation sans coupure, mais ne doit plus être utilisé après migration.
- **Base Supabase** (table `app_config`) : liens publics (`site_links`) et liens CSV des Google Sheets (`parc_sheet_urls`), tarifs (`tarifs`), photos (`parc_photos` + bucket public `parc-photos`).

Ces données sont gérées depuis l'Espace Staff (carte « Site public » de la page TM). Ce dépôt ne fait que les **lire**.

## Mise en place
1. Exécuter une fois `sql/public-site.sql` dans Supabase (table `parc_photos`).
2. Définir les 3 variables d'environnement ci-dessus (`TM_API_BASE` est facultative) dans ce projet Vercel, puis redéployer.
3. Le site est servi à la racine du domaine.

## Fichiers
- `*.html`, `css/site.css`, `js/site.js` : le site
- `api/public-parc.js` : catalogue du parc (lecture seule, champs filtrés)
- `api/public-site.js` : articles, pop-up, liens supplémentaires et widget Discord (lus en base, gérés depuis l'Espace Staff)
