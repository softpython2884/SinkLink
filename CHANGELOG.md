# Journal des modifications

Les versions suivent le [versionnage sémantique](https://semver.org/lang/fr/).

## [0.2.0] - 2026-10-28

### Ajouts

- **Pochoir** : transforme la photo d'un tatouage en dessin noir sur blanc, à plat.
  Perspective en quatre coins, déroulé du bras, seuil adapté à l'éclairage de la peau,
  lissage, épaisseur du trait, fond transparent.
- **Perspective** en quatre coins avec correction de courbure, aussi disponible dans
  l'outil Recadrer.
- **Objectif** : profondeur de champ avec zone nette déplaçable (ronde ou en bande),
  bokeh sur les lumières, aberration chromatique.
- **Anti-voile** dans Détails, ou brume ajoutée en négatif.
- Styles **Photo réaliste**, pensés aussi pour les captures de jeux vidéo : Réaliste,
  Heure dorée, Téléobjectif, Cinéma, Reportage, Argentique.
- Export PNG et WebP avec transparence.

### Modifications

- Les styles sont classés par famille, l'intensité est en haut du panneau.
- Le style « Ciné » s'appelle désormais « Teal & orange ».

## [0.1.0] - 2026-10-28

Première version.

- Édition non destructive en WebGL 2, sans dépendance ni étape de build.
- Styles avec aperçu sur la photo et intensité réglable, correction automatique.
- Réglages, détails, courbes, teinte / saturation / luminance par couleur, virage
  partiel, HDR, lueur, vignette, grain, noir et blanc.
- Recadrage, rotation, miroir et redressement.
- Retouches locales : points à sélectivité couleur, pinceau, dégradé.
- Correcteur avec choix automatique de la zone source.
- Geste de réglage sur la photo, historique, comparaison avec l'original, histogramme,
  zoom, export JPEG, WebP ou PNG en pleine résolution.

[0.2.0]: https://github.com/softpython2884/SinkLink/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/softpython2884/SinkLink/releases/tag/v0.1.0
