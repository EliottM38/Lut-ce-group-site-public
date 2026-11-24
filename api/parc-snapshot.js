// Appelé chaque matin par Vercel Cron. Le même handler que la route publique
// recharge TM et remplace uniquement la dernière sauvegarde valide du parc.
import publicParc from './public-parc.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).end();
  }
  return publicParc(req, res);
}
