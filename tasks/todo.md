# Undercover — web app iPhone (PWA)

Décision (2026-10-03) : PWA plein écran plutôt qu'app native (une app native signée avec un compte gratuit expire au bout de 7 jours, et aucun compte Apple n'est configuré dans Xcode).

## Plan
- [x] Logique pure testable (`js/logic.js`) : rôles par défaut, validation, attribution, ordre de parole (Mr. White jamais en premier), conditions de victoire, scores, tirage sans répétition
- [x] Binômes (`js/words.js`) : 150+ paires FR, lexique 20-25 ans
- [x] UI (`index.html`, `js/app.js`) : setup joueurs (3-12), distribution en passant le téléphone, ordre de parole, éliminations, devinette de Mr. White, résultats, scores, binômes perso
- [x] PWA : manifest, service worker hors ligne, icônes iOS
- [x] Tests node (`tests/logic.test.js`)
- [x] Test complet d'une partie dans le navigateur (viewport mobile)
- [ ] Publication GitHub Pages (après accord de l'utilisateur)

## Vérifié (2026-10-03)
- 9/9 tests node (`node --test tests/logic.test.js`), 212 binômes, aucun doublon
- Navigateur 375x812 : ajout joueurs + refus doublon, distribution, Mr. White jamais 1er, élimination, devinette ratée/réussie, victoire civils/infiltrés, scores, reprise après rechargement, binômes perso + refus doublon, service worker (9 fichiers en cache), 0 erreur console
