# SinkLink

Éditeur photo qui tourne entièrement dans le navigateur. L'idée : la prise en main
de Snapseed, avec la précision d'un logiciel de développement photo. Des styles prêts
à l'emploi et une correction automatique pour aller vite, des réglages fins et des
outils locaux quand on veut reprendre une zone précise.

Pas d'installation, pas de compte, pas de serveur : la photo ne quitte jamais la machine.

## Fonctionnalités

- **Styles** : Auto, Portrait, Paysage, Lumineux, HDR naturel, HDR intense, Drame, Mat,
  Film, Vintage, Ciné, Froid, N&B, N&B contrasté, Noir, Sépia. Aperçu sur la photo en
  cours, intensité réglable.
- **Réglages** : exposition, luminosité, contraste, hautes lumières, ombres, blancs,
  noirs, ambiance, saturation, vibrance, température, teinte, correction automatique.
- **Détails** : structure (contraste local, ou lissage en négatif) et netteté.
- **Courbes** : RVB et par couche, préréglages, histogramme en fond.
- **Couleur** : teinte / saturation / luminance pour 8 plages de couleurs, virage partiel.
- **HDR** : tone mapping local façon HDR Scape, 4 styles de départ.
- **Effets** : lueur, vignette (centre déplaçable sur la photo), grain.
- **N&B** : filtres couleur rouge, orange, jaune, vert, bleu.
- **Recadrer** : formats courants, rotation, miroir, redressement.
- **Local** :
  - *point* : agit sur un disque et, avec la sélectivité, sur les couleurs proches de
    son centre (dans l'esprit des points de contrôle U-Point) ;
  - *pinceau* : on peint l'effet là où on le veut, avec gomme ;
  - *dégradé* : pour un ciel, un premier plan…

  Chaque zone a sa luminosité, son contraste, sa saturation, sa chaleur et sa structure,
  peut être inversée et afficher son masque.
- **Correcteur** : un clic sur une poussière ou un bouton, la zone de remplacement est
  choisie automatiquement et reste déplaçable.
- Historique (100 étapes), comparaison avec l'original, histogramme, zoom, export JPEG,
  WebP ou PNG en pleine résolution.

L'édition est non destructive : tous les réglages tiennent dans un objet JSON, la photo
source n'est jamais modifiée. Les retouches locales sont stockées en coordonnées de
l'image, elles suivent donc le recadrage et la rotation.

## Prise en main

Ouvrir une photo : bouton *Ouvrir*, glisser-déposer ou coller (Ctrl+V).

Comme dans Snapseed, on peut régler sans viser les curseurs : glisser horizontalement
sur la photo modifie le réglage actif, glisser verticalement en choisit un autre. Un
double-clic sur un curseur le remet à zéro.

| Raccourci | Action |
| --- | --- |
| Ctrl+O | Ouvrir une photo |
| Ctrl+S | Exporter |
| Ctrl+Z / Ctrl+Maj+Z | Annuler / rétablir |
| C (maintenu) | Afficher l'original |
| Molette, pincement | Zoom |
| Espace + glisser, clic molette | Déplacer la vue |
| 0 ou F / 1 | Ajuster à l'écran / 100 % |
| M | Afficher le masque de la zone (outil Local) |
| [ et ] | Taille du pinceau |
| Suppr | Supprimer la zone ou la correction sélectionnée |
| Échap | Désélectionner |

## Lancer le projet

Aucune dépendance, aucune étape de build : ce sont des modules ES servis tels quels.
Node.js 20 ou plus sert uniquement au serveur de développement et aux tests.

```bash
npm start
```

L'application est alors sur http://localhost:5173. N'importe quel serveur statique
convient (les modules ES ne se chargent pas depuis `file://`). Pour publier, GitHub
Pages sur la branche `main` suffit.

```bash
npm test
```

Navigateurs : versions récentes de Chrome, Edge, Firefox et Safari (WebGL 2 requis).

## Organisation du code

```
index.html          structure de l'interface
styles/app.css
src/
  app.js            relie état, rendu, vue et outils
  state/            document d'édition immuable et historique
  render/           pipeline WebGL 2 : shaders, géométrie, masques
  edit/             logique sans DOM : courbes, correction auto, styles, correcteur
  tools/            un fichier par outil (panneau et interactions sur la photo)
  ui/               vue zoomable, curseurs, histogramme
  image/            chargement et export
tests/              tests unitaires (node:test)
```

À chaque modification, le pipeline rejoue :

1. le correcteur et trois copies floutées de la source (calculés une fois, puis gardés
   en cache) ;
2. le développement : balance des blancs, exposition, HDR et structure, tons, couleurs,
   noir et blanc, virage, courbes ;
3. une passe par retouche locale ;
4. la sortie : géométrie, netteté, vignette, grain.

Les calculs intermédiaires se font en flottants 16 bits quand le GPU le permet. L'aperçu
travaille sur une copie de 2560 px maximum ; l'export rejoue le même pipeline sur
l'image d'origine.

## Licence

[GNU AGPL v3](LICENSE) ou ultérieure.

Copyright © 2026 NightFury
