# API Webhook Airtable vers Goom

## Description
Cette API permet de synchroniser les données d'Airtable avec le CRM Goom de Voltalia. Elle envoie automatiquement un webhook vers Goom lorsque le champ "Contrat abonnement signe" n'est plus vide.

## Installation
```bash
npm install
```

## Configuration

1. Copiez le fichier `.env.example` vers `.env`
2. Configurez les variables d'environnement :

```bash
# Token fourni par Goom (obligatoire)
GOOM_GATEWAY_TOKEN=votre_token_ici

# Secret webhook Airtable (optionnel, pour sécuriser)
AIRTABLE_WEBHOOK_SECRET=votre_secret_ici

# Port du serveur (optionnel, défaut: 3000)
PORT=3000
```

## Utilisation

### Démarrage du serveur
```bash
# Mode développement
npm run dev

# Mode production
npm start
```

### Configuration du webhook Airtable

1. Dans votre base Airtable, allez dans "Automations"
2. Créez une nouvelle automation avec le trigger "When record matches conditions"
3. Configurez la condition : `Contrat abonnement signe` n'est pas vide
4. Ajoutez une action "Send webhook" avec :
   - URL : `https://votre-domaine.com/webhook/airtable`
   - Méthode : POST
   - Headers (optionnel) : `x-airtable-webhook-secret: votre_secret`

## Endpoints

### POST /webhook/airtable
Endpoint principal pour recevoir les webhooks d'Airtable.

**Headers requis :**
- `Content-Type: application/json`
- `x-airtable-webhook-secret: votre_secret` (optionnel)

**Payload Airtable attendu :**
```json
{
  "changedRecords": [
    {
      "id": "recXXXXXXXXXXXXXX",
      "changedFields": {
        "Contrat abonnement signe": "valeur_non_vide"
      },
      "current": {
        "fields": {
          "Email": "client@example.com",
          "Contrat abonnement signe": "valeur_non_vide"
        }
      }
    }
  ]
}
```

### GET /health
Vérification de l'état du serveur.

**Réponse :**
```json
{
  "status": "OK",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "goomConfigured": true
}
```

### POST /test/goom
Endpoint de test pour vérifier l'envoi vers Goom.

**Payload :**
```json
{
  "email": "test@example.com"
}
```

## Fonctionnement

1. **Réception du webhook** : L'API reçoit un webhook d'Airtable sur `/webhook/airtable`
2. **Validation** : Vérification du secret webhook (si configuré)
3. **Traitement** : Pour chaque enregistrement modifié :
   - Vérifie si le champ "Contrat abonnement signe" n'est plus vide
   - Récupère l'email associé
   - Envoie un webhook vers Goom avec le payload requis
4. **Réponse** : Retourne un résumé des traitements effectués

## Payload envoyé vers Goom

```json
{
  "email": "client@example.com",
  "action": "validate_quote"
}
```

**Headers envoyés vers Goom :**
- `Content-Type: application/json`
- `x-gateway-token: votre_token_goom`

## Logs

L'application génère des logs détaillés pour faciliter le débogage :
- 📥 Réception des webhooks Airtable
- 🔍 Traitement des enregistrements
- 📤 Envoi vers Goom
- ✅ Succès des opérations
- ❌ Erreurs rencontrées

## Sécurité

- Validation optionnelle du secret webhook Airtable
- Token d'authentification pour Goom
- Limitation de la taille des payloads (10MB)
- Headers de sécurité avec Helmet.js

## Déploiement

L'application peut être déployée sur n'importe quelle plateforme supportant Node.js :
- Heroku
- Vercel
- Railway
- VPS avec PM2

Assurez-vous de configurer les variables d'environnement sur votre plateforme de déploiement.