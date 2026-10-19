# homographic_detect

# IDN watch

Extension Firefox qui repère les noms de domaine homographes (caractères
cyrilliques, grecs, arméniens glissés dans un label latin) et agit avant
que la page ne charge.

- **Rouge** — mélange de scripts à sosies dans un même label, ou caractère
  invisible / override bidi : la requête est **bloquée** et remplacée par
  une page d'avertissement (aucun octet envoyé). Barre d'adresse et badge
  en rouge si tu continues quand même.
- **Jaune** — label entièrement dans un script confusable (ex. tout
  cyrillique) ou mélange inhabituel : pas de blocage, barre d'adresse et
  badge en orange.
- **Vert** — rien à signaler. Les combinaisons CJK légitimes
  (Han + kana, Han + hangul…) ne déclenchent rien.

## Fichiers

    manifest.json   permissions, page d'avertissement exposée
    bg.js           décodage punycode, classification par script, thème, blocage
    warn.html       page d'interstitiel
    warn.js         bouton « continuer quand même »

## Installation temporaire (dev)

1. `about:debugging` → « Ce Firefox » → « Charger un module complémentaire temporaire ».
2. Sélectionner `manifest.json`.
3. L'extension disparaît à la fermeture de Firefox ; recharger à chaque redémarrage.

## Installation permanente

Firefox exige une signature. Deux options :

- **Firefox Developer Edition / Nightly** : `about:config` →
  `xpinstall.signatures.required` = `false`, puis zipper le *contenu* du
  dossier (pas le dossier) en `idn-watch.xpi` et l'ouvrir dans Firefox.
- **Firefox stable** : soumettre le zip sur addons.mozilla.org en
  « auto-distribution » pour obtenir un `.xpi` signé.

## Permissions à vérifier

En MV3, Firefox n'accorde **pas** `host_permissions` à l'installation.
Si rien ne bloque : `about:addons` → IDN watch → onglet Permissions →
activer « Accéder à vos données pour tous les sites web ». En chargement
temporaire c'est normalement déjà accordé.

## Tester

Dans la console de l'extension (`about:debugging` → Inspecter) :

    inspect("xn--pple-43d.com")    // аpple → rouge (Cyrillic + Latin)
    inspect("xn--maana-pta.com")   // mañana → vert (tout latin)

Ou naviguer directement sur `http://xn--pple-43d.com/` pour voir
l'interstitiel.

## Limites connues

- Le **whole-script confusable** (toutes les lettres remplacées par des
  sosies, ex. `аррӏе.com` 100 % cyrillique) passe en jaune, pas en rouge :
  sans mélange, rien ne le distingue d'un vrai domaine russe. Le
  distinguer demande la table de confusables Unicode (TR39).
- Le thème est par fenêtre, pas par onglet ; le badge, lui, est par onglet.
- Aucune API ne voit ce que tu tapes dans la barre d'adresse : la
  détection ne peut pas précéder la validation de l'URL.
- Les typosquats purement ASCII (`rn` pour `m`) sont hors périmètre.
