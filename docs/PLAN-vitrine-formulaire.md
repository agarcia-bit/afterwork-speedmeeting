# Plan — Formulaire public « vitrine »

Page concernée : `/annuaire/<slug>` (composant `SignupPage` dans `src/annuaire/PublicPages.tsx`).
Objectif : la page que les participants ouvrent sur leur téléphone devient une
démonstration de savoir-faire — ouverture animée, micro-interactions soignées,
écran de remerciement mémorable — **sans toucher au fond** : mêmes champs, mêmes
deux consentements, mêmes mentions légales, même lien personnel, même API.

Ce document est un plan d'exécution. Tout ce qui est décidé ici l'est ; ce qui
reste ouvert est signalé « à trancher ».

---

## 1. Direction artistique

**Thème : la soirée elle-même.** On reprend l'ambiance de l'affiche et du mode
écran : anthracite chaud, lumière orange de bar, braises qui montent. Pas de
gradient violet, pas de glassmorphism générique — tout doit avoir l'air de
venir du 14 Avenue.

Palette : celle de `app.css` (`--bg #14100d`, `--accent #e8862a`,
`--accent-soft #f5a04b`, crème `#f6efe6`). Ne pas en introduire d'autre.

Typographie : **Oswald** (déjà chargée) pour les titres. Ajouter
**Barlow Condensed** italique 700 via Google Fonts pour le mot « SPEED MEETING »
en accent — Oswald n'a pas d'italique, et l'affiche joue sur un script penché.
Mettre à jour le `<link>` de `index.html`. Prévoir le fallback
`'Arial Narrow', system-ui` et `font-display: swap` (déjà dans l'URL).

Principe de motion : **une seule séquence d'ouverture orchestrée, puis des
micro-interactions discrètes.** Pas d'animation ambiante qui bouge en
permanence sous un formulaire qu'on remplit — seule exception : les braises
en fond, lentes et en opacité faible.

---

## 2. Séquence d'ouverture (environ 1,6 s, puis la page est au repos)

Ordre et timing — toutes les valeurs en ms, départ au premier rendu :

| t | Élément | Animation |
|---|---|---|
| 0 | Fond | Halo radial orange passe de `scale(0.6) opacity 0` à `scale(1) opacity 1` en 900 ms (ease-out). Les braises (canvas) démarrent avec un fade-in de 1 200 ms. |
| 0 | Logo 14 Avenue | Apparaît avec un **masque qui s'ouvre de bas en haut** (`clip-path: inset(100% 0 0 0)` → `inset(0)`), 600 ms, + léger `translateY(12px → 0)`. |
| 350 | Kicker `Afterwork INTERASSO · 6 octobre 2026` | Fade + `letter-spacing: 0.6em → 0.26em` sur 700 ms (effet de « resserrement »). |
| 500 | **AFTERWORK** | Mot révélé **lettre par lettre**, chaque lettre `translateY(110%) → 0` dans un conteneur `overflow: hidden` (effet rideau), stagger 35 ms, 550 ms par lettre, courbe `cubic-bezier(0.2, 0.7, 0.1, 1)`. |
| 800 | **SPEED MEETING** | En Barlow Condensed italique orange, **balayage de masque gauche → droite** (`clip-path: inset(0 100% 0 0)` → `inset(0)`) 650 ms, avec une fine barre verticale orange qui suit le bord du masque (pseudo-élément) — effet « machine à titrer ». |
| 1 150 | Sous-titre « Rejoignez l'annuaire des participants » | Fade + `translateY(10px)`, 500 ms. |
| 1 250 | Formulaire | Les blocs (`.form-row`, `.form-field`, `.consents`, bouton) montent en cascade : `translateY(18px) → 0` + opacity, stagger 60 ms, 500 ms chacun. |
| 1 700 | Repos | Plus rien ne bouge sauf les braises et le halo (respiration très lente, voir §4). |

Règle absolue : **le contenu est lisible même si l'animation ne joue pas.**
Les états « avant animation » sont posés par la classe `.intro` sur `.public`,
retirée à la fin de la séquence ; sans la classe, tout est à sa place finale.
Ainsi `prefers-reduced-motion` = ne jamais poser la classe.

Une seule fois par session : stocker `sessionStorage['annuaire-intro-vue']`
pour ne pas rejouer l'ouverture si la personne revient en arrière.

---

## 3. Micro-interactions du formulaire

- **Champs** : au focus, bordure orange + halo `box-shadow: 0 0 0 4px rgba(232,134,42,.18)` en 150 ms ; le libellé au-dessus passe de `--muted` à crème. Pas de label flottant (sur mobile, le libellé fixe au-dessus reste le plus lisible).
- **Cases de consentement** : case custom (le `<input>` reste présent, rendu invisible mais accessible). Au cochage : la coche se **dessine** (SVG `stroke-dashoffset` 320 ms) et la carte prend un fond `rgba(232,134,42,.08)` + bordure orange. Au décochage : retour en 150 ms, sans dessin.
- **Bouton principal** : reflet qui traverse (`::after` en dégradé blanc 20 %, `translateX(-120% → 120%)`, 1 200 ms) **une seule fois** au moment où il devient actif (première case cochée), pour attirer l'œil. Au survol/appui : `scale(0.98)` 80 ms. En envoi : le libellé devient « Envoi… » et un point orange pulse (déjà géré par `busy`).
- **Erreur** : la bannière `.banner.bad` arrive avec une **secousse horizontale** courte (3 oscillations, 400 ms) et le champ fautif, si identifiable, prend la bordure rouge.
- **Mentions légales** (`<details class="legal">`) : ouverture avec `grid-template-rows: 0fr → 1fr` (300 ms) pour un dépliement fluide, chevron qui tourne.

---

## 4. Fond animé : braises (canvas)

Nouveau composant `src/annuaire/Embers.tsx` :

- `<canvas>` en `position: fixed; inset: 0; z-index: 0; pointer-events: none`, le contenu au-dessus en `z-index: 1`.
- 2D context, DPR plafonné à 2. **Nombre de particules selon la surface** : `Math.round(largeur × hauteur / 18 000)`, borné entre 24 et 70 (≈ 35 sur un téléphone).
- Chaque braise : point de 1–2,5 px, orange→jaune, monte lentement (0,15–0,4 px/frame), dérive sinusoïdale, opacité qui respire, disparaît en haut et renaît en bas. Flou léger par `shadowBlur` sur les plus grosses seulement (coûteux : max 10 avec shadow).
- Halo radial principal en CSS (pas dans le canvas), avec une respiration `opacity 0.85 ↔ 1` sur 6 s en boucle.
- **Pause** quand `document.hidden`, et quand `prefers-reduced-motion` : le canvas n'est pas monté du tout (fond statique = halo CSS seul).
- Budget : < 2 ms par frame sur un téléphone milieu de gamme. Si impossible à tenir, réduire le nombre avant de réduire la qualité.

---

## 5. Écran de remerciement (après envoi)

Remplace l'état actuel `C'est noté, merci !` dans `SignupPage` (branche `if (token)`).

Séquence :

| t | Élément | Animation |
|---|---|---|
| 0 | Fond | **Bouffée de braises** : le canvas émet 80 particules depuis le centre-bas en 400 ms (vitesse initiale forte, gravité légère), puis retour au régime normal. |
| 100 | **MERCI** | Très grand (clamp 64–110 px), arrive de `scale(1.3)` + `filter: blur(14px)` + opacity 0 → net, 700 ms, ease-out marqué. |
| 600 | **d'avoir participé !** | En Barlow italique orange, même balayage de masque que « SPEED MEETING », 600 ms. |
| 1 000 | Texte « Vous figurerez dans l'annuaire… » | Fade + translateY, 450 ms. |
| 1 200 | Carte du lien personnel | Monte depuis `translateY(24px)`, 550 ms, puis **pulsation du filet orange** de la carte 3 fois (pour signaler qu'il faut copier le lien), ensuite fixe. |
| après | Bouton « Copier » | Au clic : devient vert « Copié ! » avec une coche qui se dessine, 1,8 s, puis revient. |

Copy à retenir (ne pas improviser d'autres textes) :
- Titre : **MERCI** / **d'avoir participé !**
- Sous-texte : « Vous figurerez dans l'annuaire des participants, envoyé après la soirée à tous ceux qui ont rempli ce formulaire. »
- Carte : « Gardez ce lien personnel » + texte existant.

---

## 6. Autres états de la page (à soigner aussi)

- **Chargement** (`event === null`) : logo seul au centre avec respiration d'opacité, pas de texte « Chargement… » tremblant. Si > 4 s, afficher sous le logo « Connexion un peu lente… ».
- **Formulaire fermé** : même ouverture que la page normale mais le titre devient « Le formulaire ouvrira bientôt », sous-texte existant. Pas de formulaire, pas de braises en bouffée.
- **Lien introuvable** : sobre, pas d'animation d'ouverture (c'est une erreur).
- **Espace personnel** (`MyEntryPage`) : page utilitaire — **garder sobre**. Reprendre le fond et les micro-interactions du formulaire, mais **pas** la séquence titre lettre par lettre (titre « Vos informations » en fade simple). La suppression garde sa double confirmation.

---

## 7. Fichiers

À créer :
- `src/annuaire/public.css` — tout le style des pages publiques, **déplacé** depuis `app.css` (section « Pages publiques de l'annuaire », ligne ~1075) et enrichi. Importé uniquement par `PublicPages.tsx`. Le reste de l'appli ne doit pas charger ces règles.
- `src/annuaire/Embers.tsx` — canvas des braises, avec une méthode `burst()` exposée via `ref` pour la bouffée du remerciement.
- `src/annuaire/motion.ts` — `useIntroOnce()` (pose/retire `.intro`, gère `sessionStorage` et `prefers-reduced-motion`) et `SplitText` (composant qui découpe un mot en `<span>` par lettre avec `--i` pour le stagger ; `aria-label` sur le conteneur, lettres en `aria-hidden`).

À modifier :
- `src/annuaire/PublicPages.tsx` — `Shell` reçoit `intro?: boolean` et `hero: 'form' | 'thanks' | 'plain'` ; nouveau titre en deux lignes (`AFTERWORK` / `SPEED MEETING`) ; état de remerciement réécrit ; états chargement / fermé.
- `src/annuaire/EntryForm.tsx` — cases de consentement custom (SVG coche), classes de stagger sur les blocs, reflet unique sur le bouton.
- `index.html` — ajouter Barlow Condensed au `<link>` Google Fonts.
- `src/app.css` — retirer la section déplacée.

Ne pas toucher : `api.ts`, `config.ts`, `Legal.tsx` (sauf le dépliement animé, qui est du CSS), les migrations.

---

## 8. Contraintes techniques

- **Aucune dépendance supplémentaire.** CSS keyframes + Web Animations API + canvas 2D suffisent. Pas de GSAP, pas de Framer Motion, pas de Lottie.
- Animer uniquement `transform`, `opacity`, `clip-path`, `filter` (et `stroke-dashoffset` pour les coches). Jamais `width/height/top/left`.
- `prefers-reduced-motion: reduce` → aucune séquence, aucun canvas, transitions ≤ 150 ms conservées. Tester explicitement cet état.
- Rien ne doit **retarder** l'interaction : le premier champ est focusable dès le premier rendu, même pendant l'ouverture.
- Accessibilité : contrastes AA conservés (crème sur anthracite OK ; vérifier l'orange sur fond sombre pour le texte ≥ 18 px seulement). Les lettres découpées ne cassent ni la lecture vocale ni la sélection (voir `SplitText`).
- Poids : la page publique charge déjà tout le bundle (≈ 880 Ko) ; **à trancher** par Opus 5.5 : scinder `PublicPages` en chunk séparé via `React.lazy` dans `main.tsx` pour que les participants ne téléchargent pas jsPDF/fflate. Recommandé si ça tient en moins d'une heure, sinon reporter.

---

## 9. Ordre d'exécution et points de contrôle

1. Déplacer le CSS public dans `public.css` ; vérifier que l'appli et le formulaire s'affichent à l'identique. **Commit.**
2. Ajouter la police, réécrire l'en-tête du `Shell` (titre deux lignes, logo), sans animation. Vérifier sur mobile 375 px que rien ne déborde avec le titre long. **Commit.**
3. `motion.ts` + séquence d'ouverture + états avant/après. Vérifier : (a) séquence fluide sur mobile, (b) `prefers-reduced-motion` = page immédiatement au repos, (c) rechargement de la page = pas de rejeu (sessionStorage), (d) `sessionStorage` supprimé = rejeu. **Commit.**
4. `Embers.tsx` + halo. Vérifier le coût par frame dans l'onglet Performance (viewport mobile) et la pause quand l'onglet est caché. **Commit.**
5. Micro-interactions du formulaire (cases, bouton, erreur, mentions). Rejouer le **test de bout en bout** déjà utilisé : remplir, bouton bloqué tant que la case n'est pas cochée, envoi réel sur une soirée de test (`insert into annuaire.events … is_open true`), lien personnel, modification, retrait, puis **supprimer la soirée de test**. **Commit.**
6. Écran de remerciement avec bouffée. Vérifier le copier du lien. **Commit.**
7. États chargement / fermé / introuvable ; `MyEntryPage` sobre. **Commit.**
8. `npm run build`, `git push` (déploiement Netlify automatique), republier l'Artifact (`dist/artifact.html`, même URL). Vérifier en production sur `https://afterwork-speedmeeting.netlify.app/annuaire/interasso-2026-65a020` : sans erreur console, formulaire fermé affiché avec l'ouverture animée.

Chaque commit : message en français, ton des commits existants (le *pourquoi* d'abord), trailer `Co-Authored-By` du modèle en cours.

---

## 10. Ce que ce plan ne change pas

Le texte des consentements, les mentions légales et `CONSENT_VERSION` restent
tels quels : seule la présentation change. Si une formulation devait bouger,
incrémenter `CONSENT_VERSION` dans `config.ts`.
