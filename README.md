# Script d'ajout d'aides automatique au compte mobilité (moB) à partir d'un csv

## Installation

Utilise node v16.10.0

```
npm install
```

## Configuration

Les variables suivantes sont à configurer dans le script `send_to_mob_api.js`

* `API_TOKEN`: Token récupéré via l'authentication de l'utilisateur admin_fonctionnel
* `CSV_FILENAME`: Fichier csv source des aides, utilise le caractère "µ" comme séparateur. Chaque ligne d'aide doit se terminer par µµ (le plus simple est d'ajouter des colonnes avant l'export). Le fichier exemple.csv peut servir de référence. Le séparateur 'µ' est utilisé car le fichier d'aide initial peut contenir tout les caratères de délimitation habituels (,;\t)
* `API_URL`: URL de l'API moB (:3000 sur les instances de dev)
* `DEFAULT_SUBSCRIPTION_LINK`: En cas d'invalidité du lien de souscription, un lien par défaut peut-être utilisé
* `STOP_ON_INVALID_INPUT`: Affiche les erreurs de formattage des aides, lorsqu'un champ obligatoire est manquant par exemple
* `TEST_RUN_DO_NOT_SEND_TO_API`: Lance le script en mode test, les API ne seront pas appelées. Utile pour vérifier la validité des champs avant envoi vers l'API


## Démarrage

```
node send_to_mob_api.js
```

## Risques d'usage et bugs identifiés

Ce repo utilise les [issues](https://github.com/fabmob/script_ajout_aides_mob/issues) pour référencer les problèmes et risques liés à l'utilisation du script.

