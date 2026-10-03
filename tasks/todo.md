# Undercover — web app iPhone (PWA)

Décision (2026-10-03) : PWA plein écran plutôt qu'app native (une app native signée avec un compte gratuit expire au bout de 7 jours, et aucun compte Apple n'est configuré dans Xcode).

## Plan
- [x] Logique pure testable (`js/logic.js`) : rôles par défaut, validation, attribution, ordre de parole (Mr. White jamais en premier), conditions de victoire, scores, tirage sans répétition
- [x] Binômes (`js/words.js`) : 150+ paires FR, lexique 20-25 ans
- [x] UI (`index.html`, `js/app.js`) : setup joueurs (3-12), distribution en passant le téléphone, ordre de parole, éliminations, devinette de Mr. White, résultats, scores, binômes perso
- [x] PWA : manifest, service worker hors ligne, icônes iOS
- [x] Tests node (`tests/logic.test.js`)
- [x] Test complet d'une partie dans le navigateur (viewport mobile)
- [x] Publication GitHub Pages : https://manceauconciergerie-stack.github.io/undercover/

## Vérifié (2026-10-03)
- 9/9 tests node (`node --test tests/logic.test.js`), 212 binômes, aucun doublon
- Navigateur 375x812 : ajout joueurs + refus doublon, distribution, Mr. White jamais 1er, élimination, devinette ratée/réussie, victoire civils/infiltrés, scores, reprise après rechargement, binômes perso + refus doublon, service worker (9 fichiers en cache), 0 erreur console

## V2 (2026-10-03) — demandes
- [x] Plus d'undercovers possibles : limite assouplie à civils ≥ infiltrés (avant civils > infiltrés), plafond affiché
- [x] Ordre de parole entièrement aléatoire (plus de rotation sur l'ordre des places), Mr. White jamais 1er
- [x] Système de manches : « Manche N », compteur des rôles encore en jeu, transition entre manches
- [x] Mr. White tape le mot qu'il pense ; comparaison auto (accents, casse, articles, pluriel, 1 faute) + validation manuelle si synonyme
- [x] Tests mis à jour + test navigateur + redéploiement (bump VERSION sw.js)
- V2 vérifiée : 13/13 tests, navigateur (UC 2+MW 1 à 6 joueurs, ordre non rotatif, manches + compteur, saisie MW raté/mot UC/faute de frappe validée), 0 erreur console
