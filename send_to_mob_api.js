const fs = require('fs');
const request = require('request');

// Token récupéré via l'authentification de l'utilisateur admin_fonctionnel
const API_TOKEN = "XX"
// Fichier csv source des aides, utilise le caractère "µ" comme séparateur. 
// Chaque ligne d'aide doit se terminer par µµ (le plus simple est d'ajouter des colonnes avant l'export)
const CSV_FILENAME = "exemple.csv"
// URL de l'API moB
const API_URL = "http://.../v1/incentives"
// En cas d'invalidité du lien de souscription, un lien par défaut peut-être utilisé
const DEFAULT_SUBSCRIPTION_LINK = "http://..."
// Affiche les erreurs de formatage des aides
const STOP_ON_INVALID_INPUT = true
// Lance le script en mode test, les API ne seront pas appelées
const TEST_RUN_DO_NOT_SEND_TO_API = true

// Correspondance entre les colonnes de l'excel avec le nom des champs de l'API
const colMatch = {
    'Cible': "",
    "Nom de l'aide": "title",
    "Proposition de valeur de l'aide": "description",
    'Nom du territoire': "territoryName",
    'Type de financeur': "incentiveType",
    'Nom du financeur': "funderName",
    "Conditions d'obtention (d'éligibilités)": "conditions",
    "Conditions d'obtention": "conditions",
    'Où et comment en bénéficier?': "",
    'Modalités de versement': "paymentMethod",
    'Montant': "allocatedAmount",
    "Montant minimum de l'aide": "minAmount",
    "Montant min / max de l'aide": "minAmount",
    'Mode de transport': "transportList",
    'Justificatifs': "",
    'Bon à savoir ': "additionalInfos",
    'Contact ': "contact",
    'Durée de validité': "validityDuration",
    // 'Date de fin de validité': "validityDate",
    'Souscription via MCM ?': "isMCMStaff",
    'Lien de souscription externe': "subscriptionLink",
    "Source de l'information": "",
    'Commentaires': ""
}

// Correspondance entre les types de transport de l'excel et les catégories acceptées par l'API
// l'API accepte les catégories suivantes: transportsCommun, velo, voiture, libreService, electrique, autopartage, covoiturage
const transportMatch = {
    "Transports en commun": "transportsCommun",
    "Transport en commun": "transportsCommun",
    "Réseaux urbain et non urbain": "transportsCommun",
    "Vélo": "velo",
    "Vélo classique non électrique": "velo",
    "Covoiturage": "covoiturage",
    "VAE": "electrique",
    "Vélo à assistance électrique": "electrique",
    "Vélo à assistance électrique ou Vélo classique": "electrique",
    "quadricycle électrique": "electrique",
    "Vélo électrique": "electrique",
    "Vél": "velo",
    "Bus": "transportsCommun",
    "bus": "transportsCommun",
    "2, 3 roues ou quadricycle électrique": "electrique",
    "2-roues electriques": "electrique",
    "Voiture": "voiture",
    "véhicules thermiques": "voiture",
    "Camionnette": "voiture",
    "2 ou 3 roues motorisé ou quadricycle électrique": "electrique",
    // "Transport scolaire adapté": "",
    // "Voiture adaptée": "",
    // "Service de transport à la demande": "",
    // "TAD": "",

}
// Correspondance sur le type d'aide
const incentiveMatch = {
    "Aide nationale": "AideNationale",
    "Aide de mon territoire": "AideTerritoire",
    "Aide de mon employeur": "AideEmployeur"
}

// Fonctions de conversions entre cellules excel et format compatible avec l'API
// Par exemple, la liste des transports transforme "vélo ; Transports en commun" en ["velo", "transportsCommun"]
const convert = {
    'incentiveType': (e => {
        if (incentiveMatch[e]) return incentiveMatch[e]
        if (STOP_ON_INVALID_INPUT) throw new Error("incentiveType invalide: " + e?.toString())
        return ""
    }),
    'transportList': (e => {
        const tlist = (e ? e.replace('"', '').split(/;|\n|,/).map(f => transportMatch[f.trim()] || (f.indexOf("liO") > -1 ? "transportsCommun" : "")).filter(f => f !== ""): [])
        if (STOP_ON_INVALID_INPUT && tlist.length === 0 ) {
            throw new Error("Aucune correspondance de transport trouvée ou champ vide: " + e?.toString())
        }
        return tlist
    }),
    'isMCMStaff': (e => e === "Oui"),
    'subscriptionLink': (e => {
        if (e && e.trim().match(/^(?:http(s)?:\/\/)[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)*\+,;=.]+$/)) return e 
        if (STOP_ON_INVALID_INPUT) throw new Error("subscriptionLink invalide (pas un lien) ou vide: " + e?.toString())
        return DEFAULT_SUBSCRIPTION_LINK
    }),
    'minAmount': (e => {
        if (e) return e
        if (STOP_ON_INVALID_INPUT) throw new Error("minAmount invalide ou vide: " + e?.toString())
        return "NA"
    }),
    'paymentMethod': (e => {
        if (e) return e
        if (STOP_ON_INVALID_INPUT) throw new Error("paymentMethod invalide ou vide: " + e?.toString())
        return "NA"
    }),
    'title': (e => {
        if (e) return e
        if (STOP_ON_INVALID_INPUT) throw new Error("title invalide ou vide: " + e?.toString())
        return ""
    })
}

// Lecture du fichier csv
fs.readFile(CSV_FILENAME, 'utf8', (err, data) => {
    if (err) {
        console.error(err);
        return;
    }
    // Le fichier initial contenant des retours à la ligne ('\n') dans les cellules, 
    // on utilise la répétition du délimiteur "µ" suivi du retour à la ligne pour séparer les aides
    // On sépare ensuite les 21 premières colonnes
    let parsed_data = data.split(/µµ\n/).map(e => e.split("µ").slice(0,21))
    let incentives = []
    // La première ligne de header est ignorée
    for (var i = 1; i < parsed_data.length; i += 1) {
        incentives.push({})
        for (var j = 0; j < parsed_data[i].length; j += 1) {
            // Pour chaque aide, on lit la ligne de header pour convertir le nom de colonne en champ API
            let col = colMatch[parsed_data[0][j]]
            // Si la correspondance existe, on ajoute le champ au dictionnaire
            if (col)
                incentives[incentives.length -1][col] = parsed_data[i][j].replace("-", "")
        }
    }
    // Une fois toutes les aides ajoutées, on convertit les champs au bon format pour l'API via les fonctions de conversions
    incentives = incentives.map(incentive => {
        try {
            incentive.incentiveType = convert.incentiveType(incentive.incentiveType)
            incentive.transportList = convert.transportList(incentive.transportList)
            incentive.isMCMStaff = convert.isMCMStaff(incentive.isMCMStaff)
            incentive.minAmount = convert.minAmount(incentive.minAmount)
            incentive.paymentMethod = convert.paymentMethod(incentive.paymentMethod)
            incentive.title = convert.title(incentive.title)
            incentive.subscriptionLink = convert.subscriptionLink(incentive.subscriptionLink)
        } catch (error) {
            // Note: cette erreur ne s'affiche que si la variable STOP_ON_INVALID_INPUT est vraie
            console.error("Echec de la conversion de l'aide " + incentive.title + ", " + error)
            incentive.title = ""
        } finally {
            return incentive
        }
    })

    // Les aides sans titres sont invalides, cela ne sert à rien de les envoyer
    incentives = incentives.filter(e => e.title !== "")
    if (!TEST_RUN_DO_NOT_SEND_TO_API) {
        for (var i = 0; i < incentives.length; i++) {
            // Chaque aide est envoyée à l'API
            sendReq(incentives[i])
        }
    }
});

// Simple appel à l'API
function sendReq(data) {
    var options = {
        'method': 'POST',
        'url': API_URL,
        'headers': {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': 'Bearer ' + API_TOKEN
        },
        body: JSON.stringify(data)
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        console.log(response.body);
    });
}
