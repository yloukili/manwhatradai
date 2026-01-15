
Ce projet permet la **traduction de manhwa / BD asiatiques** à partir d’images, avec un focus fort sur :

- OCR multilingue (coréen, japonais, chinois simplifié, vietnamien)
- Qualité élevée sur le **vietnamien** (diacritiques complexes)
- Correction post-OCR via **Language Model léger (KenLM)**
- Traduction finale via **Mistral (Ollama)**

---

## 1. Architecture générale de l’application

[ Frontend Web ]
  HTML / CSS / Vanilla JS
        |
        |  (images base64)
        v
[ server.js – Node.js / Express ]
        |
        |  HTTP POST /ocr
        v
[ ocr_service.py – Flask ]
        |
        |  PaddleOCR (multi-pass)
        |  Fusion par lignes (bbox conservées)
        |  Correction LM (KenLM)
        v
[ Résultat OCR structuré ]
        |
        |  HTTP POST /translate
        v
[ Ollama / Mistral ]
        |
        v
[ Images traduites finales ]


### Rôle de chaque composant

#### `server.js` (Node.js / Express)

- Gère :
  - upload images / archives
  - orchestration des étapes OCR → correction → traduction
  - persistance temporaire
- **Ne fait pas d’OCR lui-même**
- Consomme le service Python via HTTP

#### `services/ocr_service.py` (Python / Flask)

- Service **OCR spécialisé**
- Responsabilités :
  - prétraitement image
  - OCR PaddleOCR
  - fusion des lignes (bulles / bounding boxes)
  - correction vietnamienne via KenLM
- Retourne :
  - texte
  - bounding boxes
  - confidence

➡️ Séparation volontaire :
- **Python = vision + linguistique**
- **Node = orchestration + web**

---

## 2. Données linguistiques vietnamiennes (LM)

L’amélioration OCR vietnamienne repose sur un **Language Model statistique**, entraîné localement.

### Sources utilisées

- Wikipedia vietnamien
- OpenSubtitles vietnamien
- **C4 Multilingual (Vietnamien)** – source principale

---

## 3. Téléchargement des données C4 vietnamiennes

Source officielle :

- Wikipedia vietnamien
https://dumps.wikimedia.org/viwiki/latest/viwiki-latest-pages-articles.xml.bz2
- OpenSubtitles vietnamien
https://object.pouta.csc.fi/OPUS-OpenSubtitles/v2024/mono/vi.txt.gz
- C4 Multilingual (Vietnamien)
https://huggingface.co/datasets/allenai/c4/resolve/main/multilingual/

Les fichiers nous intéressant :

multilingual/c4-vi.tfrecord-XXXXX-of-01024.json.gz


### Téléchargement (exemple avec `wget`)

```bash
mkdir -p data/vi_raw
cd data/vi_raw

for i in $(seq -w 0 19); do
  wget https://huggingface.co/datasets/allenai/c4/resolve/main/multilingual/c4-vi.tfrecord-000${i}-of-01024.json.gz
done
```
### Décompression :

```bash
gunzip c4-vi.tfrecord-*.json.gz
```

### Extraction du texte :

```bash
jq -r '.text' c4-vi.tfrecord-*.json > c4_vi_raw.txt
```

## 4. Ordre de traitement du corpus

### 4.1 Nettoyage de base

```bash
bash scripts/clean_vi_basic.sh \
  data/vi_raw/c4_vi_raw.txt \
  > data/vi_clean/c4_vi_step1.txt
```

- suppression HTML / URLs
- normalisation Unicode
- suppression bruit évident

### 4.2 Filtrage vietnamien (accents)


```bash
python scripts/filter_vi_accented.py \
  data/vi_clean/c4_vi_step1.txt \
  > data/vi_clean/c4_vi_step2.txt
```

Objectif :

- éliminer faux positifs multilingues
- garder les lignes réellement vietnamiennes

### 4.3 Normalisation OCR-friendly (C4 uniquement)


```bash
python scripts/normalize_vi_ocr.py \
  data/vi_clean/c4_vi_step2.txt \
  > data/vi_clean/c4_vi_normalized.txt
```


Objectif :

- rapprocher le corpus des erreurs OCR réelles
- préparer KenLM à corriger ce que PaddleOCR produit

### 4.4 Concaténation finale


```bash
cat \
  data/vi_clean/c4_vi_normalized.txt \
  data/vi_raw/wiki_vi.txt \
  data/vi_raw/vi.txt \
  > data/vi_clean/vi_lm_corpus.txt
```

➡️ Ce fichier est l’entrée unique de KenLM

## 5. Construction du Language Model (KenLM)
### 5.1 Compilation de KenLM


```bash
git clone https://github.com/kpu/kenlm.git
cd kenlm
mkdir build && cd build
cmake ..
make -j$(nproc)
```

### 5.2 Génération du fichier vi.arpa

⚠️ Étape très consommatrice en RAM / swap

```bash
export TMPDIR=$PWD/tmp
mkdir -p $TMPDIR

kenlm/build/bin/lmplz \
  -o 5 \
  --discount_fallback \
  --skip_symbols \
  < data/vi_clean/vi_lm_corpus.txt \
  > services/ocr/lm/vi.arpa
```

**Alertes importantes**

- --skip_symbols obligatoire (&lt;s>, &lt;unk>)
- swap recommandé : ≥ 8 Go
- utiliser tmux / session stable
- le processus peut être kill si swap saturé

### 5.3 Conversion en binaire (vi.klm)

```bash
kenlm/build/bin/build_binary \
  trie \
  services/ocr/lm/vi.arpa \
  services/ocr/lm/vi.klm
```


➡️ vi.klm est **utilisé en production**

## 6. Utilisation du LM dans l’OCR

- OCR exécuté plusieurs fois (variantes d’image)
- fusion par lignes (bbox conservées)
- KenLM arbitre entre phrases complètes
- aucune correction aveugle caractère par caractère

Exemple :
```bash
Như cu nói
Như cụ nói
Như cậu nói
```

➡️ KenLM choisit :
```bash
Như cậu nói
```

7. État actuel et prochaines étapes

✔ LM fonctionnel
✔ OCR multi-pass
✔ Correction vietnamienne stable
➡️ prochaine étape :

- amélioration du consensus OCR
- meilleure exploitation des confidences PaddleOCR
- passage final vers Mistral avec texte propre