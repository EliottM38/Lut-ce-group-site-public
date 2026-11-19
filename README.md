# Lutèce Group — site public

Site statique (HTML/CSS/JS) + une seule fonction serveur `api/public-parc.js`, entièrement indépendant du site de gestion.

## Aucune clé ni lien dans le code
Tout est lu à l'exécution :
- **Variables d'environnement Vercel** (Settings → Environment Variables) : `TM_API_KEY`, `TM_API_BASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- **Base Supabase** (table `app_config`) : liens publics (`site_links`) et liens CSV des Google Sheets (`parc_sheet_urls`), tarifs (`tarifs`), photos (`parc_photos` + bucket public `parc-photos`).

Ces données sont gérées depuis l'Espace Staff (carte « Site public » de la page TM). Ce dépôt ne fait que les **lire**.

## Mise en place
1. Exécuter une fois `sql/public-site.sql` dans Supabase (table `parc_photos`).
2. Définir les 4 variables d'environnement ci-dessus dans ce projet Vercel, puis redéployer.
3. Le site est servi à la racine du domaine.

## Fichiers
- `*.html`, `css/site.css`, `js/site.js` : le site
- `api/public-parc.js` : endpoint public en lecture seule (champs filtrés, cache 5 min)
