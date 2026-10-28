# SinkLink

Éditeur photo qui tourne entièrement dans le navigateur. L'idée : la prise en main
de Snapseed, avec la précision d'un logiciel de développement photo. Des styles prêts
à l'emploi et une correction automatique pour aller vite, des réglages fins et des
outils locaux quand on veut reprendre une zone précise.

Pas d'installation, pas de compte, pas de serveur : la photo ne quitte jamais la machine.

## Fonctionnalités

- **Styles** : Auto, Portrait, Paysage, Lumineux, HDR, Drame, Mat, Film, Vintage,
  Teal & orange, Froid… Une famille *Photo réaliste* (Réaliste, Heure dorée,
  Téléobjectif, Cinéma, Reportage, Argentique) pensée aussi pour les captures de jeux
  vidéo. Plus quatre styles noir et blanc. Aperçu sur la photo en cours, intensité
  réglable.
- **Réglages** : exposition, luminosité, contraste, hautes lumières, ombres, blancs,
  noirs, ambiance, saturation, vibrance, température, teinte, correction automatique.
- **Détails** : structure (contraste local, ou lissage en négatif), netteté, anti-voile
  (ou brume ajoutée en négatif).
- **Courbes** : RVB et par couche, préréglages, histogramme en fond.
- **Couleur** : teinte / saturation / luminance pour 8 plages de couleurs, virage partiel.
- **HDR** : tone mapping local façon HDR Scape, 4 styles de départ.
- **Effets** : lueur, vignette (centre déplaçable sur la photo), grain.
- **Objectif** : profondeur de champ (zone nette ronde ou en bande, déplaçable, bokeh
  sur les lumières) et aberration chromatique.
- **N&B** : filtres couleur rouge, orange, jaune, vert, bleu.
- **Recadrer** : formats courants, rotation, miroir, redressement, perspective en
  quatre coins avec correction de courbure.
- **Local** :
  - *point* : agit sur un disque et, avec la sélectivité, sur les couleurs proches de
    son centre (dans l'esprit des points de contrôle U-Point) ;
  - *pinceau* : on peint l'effet là où on le veut, avec gomme ;
  - *dégradé* : pour un ciel, un premier plan…

  Chaque zone a sa luminosité, son contraste, sa saturation, sa chaleur et sa structure,
  peut être inversée et afficher son masque.
- **Correcteur** : un clic sur une poussière ou un bouton, la zone de remplacement est
  choisie automatiquement et reste déplaçable.
- **Pochoir** : transforme la photo d'un tatouage en dessin noir sur blanc, à plat :
  perspective, déroulé du bras, seuil adapté à l'éclairage de la peau, lissage,
  épaisseur du trait, fond transparent.
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

## Recettes

**Reprendre un tatouage à partir d'une photo**

1. Outil *Pochoir* → *Délimiter le tatouage* : placer les quatre coins sur la peau,
   autour du dessin, puis *Valider les coins*.
2. *Courbure* : la monter jusqu'à ce que le dessin ne soit plus écrasé sur les bords du
   bras (*Membre vertical* ou *horizontal* selon la photo).
3. Passer en *Noir et blanc*, ajuster le *Seuil* (quantité d'encre gardée) et le
   *Lissage* (grain de la peau). Un grain de beauté gênant s'enlève avec le
   *Correcteur*.
4. *Recadrer* au plus près, tourner si besoin, puis exporter en PNG avec le fond
   *Transparent* pour l'importer comme calque dans un logiciel de dessin.

**Rendre une capture de jeu plus photographique**

1. *Recadrer* pour sortir l'interface du jeu (mini-carte, messages).
2. Appliquer un style de la famille *Photo réaliste*, puis doser l'*Intensité*.
3. Avec un sujet (avion, voiture, personnage) : outil *Objectif*, poser le point
   central dessus et régler la zone nette.
4. Finitions : *Anti-voile* pour déboucher un ciel laiteux, *Grain* et *Vignette* pour
   le rendu boîtier.

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
2. le développement : balance des blancs, exposition, anti-voile, HDR et structure,
   tons, couleurs, noir et blanc, virage, courbes ;
3. une passe par retouche locale, puis le pochoir s'il est activé ;
4. la sortie : géométrie (perspective comprise), profondeur de champ, aberration
   chromatique, netteté, vignette, grain.

Les calculs intermédiaires se font en flottants 16 bits quand le GPU le permet. L'aperçu
travaille sur une copie de 2560 px maximum ; l'export rejoue le même pipeline sur
l'image d'origine.

## Licence

[GNU AGPL v3](LICENSE) ou ultérieure.

Copyright © 2026 NightFury
