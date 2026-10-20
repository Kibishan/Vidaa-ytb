# Installation sur Hisense VIDAA OS

Ce dossier fournit exactement les mêmes méthodes de déploiement et d'installation sur **Hisense VIDAA OS** que le fork [`Empi9245/nuviotvsmart`](https://github.com/Empi9245/nuviotvsmart).

## Méthode 1 : Déploiement sur Vercel + Navigateur TV ou Sidee (Recommandé)

1. Déployez ce dépôt sur **Vercel** (le fichier `vercel.json` est déjà configuré avec `npm run package:vidaa`, `dist/vidaa` et le proxy Serverless `/api/proxy`).
2. Sur votre téléviseur Hisense VIDAA OS :
   - **Accès direct dans le navigateur VIDAA** : ouvrez `https://<votre-projet>.vercel.app/vidaa.html`
   - **Installation d'une tuile sur l'écran d'accueil VIDAA avec [Sidee](https://github.com/Empi9245/Sidee)** : indiquez `https://<votre-projet>.vercel.app/vidaa.html` comme URL d'application.

## Méthode 2 : Serveur local sur votre réseau Wi-Fi / LAN

Depuis la racine du projet :

```bash
npm run package:vidaa
npm run serve:vidaa
```

Puis ouvrez sur votre téléviseur Hisense VIDAA :
- `http://<IP_DE_VOTRE_PC>:3000/vidaa.html`
- Ou `http://<IP_DE_VOTRE_PC>:3000/installer/` pour utiliser l'installateur `Hisense_installApp`.
