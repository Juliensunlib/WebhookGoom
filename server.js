const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const axios = require('axios');

// Charger les variables d'environnement
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration des middlewares
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Configuration Goom
const GOOM_WEBHOOK_URL = 'https://voltalia.pixlebiz.com/custom/goom/api/project_webhook.php';
const GOOM_GATEWAY_TOKEN = process.env.GOOM_GATEWAY_TOKEN;
const GOOM_TIMEOUT = parseInt(process.env.GOOM_TIMEOUT) || 30000;

// Middleware de validation du token Airtable (optionnel)
const validateAirtableWebhook = (req, res, next) => {
  const webhookSecret = process.env.AIRTABLE_WEBHOOK_SECRET;
  
  if (webhookSecret) {
    const receivedSecret = req.headers['x-airtable-webhook-secret'];
    if (receivedSecret !== webhookSecret) {
      console.log('❌ Token Airtable invalide');
      return res.status(401).json({ error: 'Token invalide' });
    }
  }
  
  next();
};

// Fonction pour envoyer le webhook vers Goom
async function sendToGoom(email) {
  try {
    console.log(`📤 Envoi du webhook vers Goom pour l'email: ${email}`);
    
    const payload = {
      email: email,
      action: "validate_quote"
    };

    const response = await axios.post(GOOM_WEBHOOK_URL, payload, {
      headers: {
        'Content-Type': 'application/json',
        'x-gateway-token': GOOM_GATEWAY_TOKEN
      },
      timeout: GOOM_TIMEOUT
    });

    console.log('✅ Webhook Goom envoyé avec succès:', response.status);
    return { success: true, status: response.status, data: response.data };
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du webhook Goom:', error.message);
    
    if (error.response) {
      console.error('Statut de réponse:', error.response.status);
      console.error('Données de réponse:', error.response.data);
    }
    
    return { 
      success: false, 
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}

// Route principale pour recevoir les webhooks d'Airtable
app.post('/webhook/airtable', validateAirtableWebhook, async (req, res) => {
  try {
    console.log('📥 Webhook Airtable reçu');
    console.log('Headers:', req.headers);
    console.log('Body:', JSON.stringify(req.body, null, 2));

    // Vérifier que le token Goom est configuré
    if (!GOOM_GATEWAY_TOKEN) {
      console.error('❌ GOOM_GATEWAY_TOKEN non configuré');
      return res.status(500).json({
        error: 'Configuration manquante: GOOM_GATEWAY_TOKEN'
      });
    }

    // Support de deux formats: script Airtable simple ou webhook natif Airtable
    let emailToProcess = null;

    // Format 1: Script Airtable personnalisé qui envoie directement { email: "xxx" }
    if (req.body.email && typeof req.body.email === 'string') {
      console.log('📝 Format script Airtable détecté');
      emailToProcess = req.body.email;

      // Envoyer le webhook vers Goom
      const goomResult = await sendToGoom(emailToProcess);

      return res.status(200).json({
        message: 'Webhook traité avec succès',
        email: emailToProcess,
        goomResult: goomResult
      });
    }

    // Format 2: Webhook natif Airtable avec changedRecords
    const changedRecords = req.body.changedRecords || [];
    const results = [];

    for (const record of changedRecords) {
      console.log(`🔍 Traitement de l'enregistrement: ${record.id}`);

      // Vérifier si le champ "Contrat abonnement signe" a été modifié et n'est plus vide
      const contractField = record.changedFields?.['Contrat abonnement signe'];
      const emailField = record.current?.fields?.['Email'];

      if (contractField !== undefined && contractField !== null && contractField !== '') {
        console.log(`✅ Contrat signé détecté pour l'enregistrement ${record.id}`);

        if (emailField) {
          console.log(`📧 Email trouvé: ${emailField}`);

          // Envoyer le webhook vers Goom
          const goomResult = await sendToGoom(emailField);

          results.push({
            recordId: record.id,
            email: emailField,
            goomResult: goomResult
          });
        } else {
          console.log(`⚠️ Pas d'email trouvé pour l'enregistrement ${record.id}`);
          results.push({
            recordId: record.id,
            error: 'Email manquant'
          });
        }
      } else {
        console.log(`ℹ️ Contrat non signé ou vide pour l'enregistrement ${record.id}`);
      }
    }

    // Réponse à Airtable
    res.status(200).json({
      message: 'Webhook traité avec succès',
      processedRecords: results.length,
      results: results
    });

  } catch (error) {
    console.error('❌ Erreur lors du traitement du webhook:', error);
    res.status(500).json({
      error: 'Erreur interne du serveur',
      details: error.message
    });
  }
});

// Route de test pour vérifier que l'API fonctionne
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    goomConfigured: !!GOOM_GATEWAY_TOKEN
  });
});

// Route pour gérer les requêtes favicon (éviter les logs 404)
app.get('/favicon.ico', (req, res) => res.status(204).end());
app.get('/favicon.png', (req, res) => res.status(204).end());

// Route de test pour tester l'envoi vers Goom
app.post('/test/goom', async (req, res) => {
  const { email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email requis' });
  }

  const result = await sendToGoom(email);
  res.json(result);
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('❌ Erreur non gérée:', err);
  res.status(500).json({ 
    error: 'Erreur interne du serveur',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Route 404
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur le port ${PORT}`);
  console.log(`📍 URL du webhook: http://localhost:${PORT}/webhook/airtable`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test Goom: http://localhost:${PORT}/test/goom`);
  
  if (!GOOM_GATEWAY_TOKEN) {
    console.warn('⚠️  ATTENTION: GOOM_GATEWAY_TOKEN non configuré!');
  }
});

module.exports = app;