# Sécurité — EchoRoom

## TwiML — Toujours utiliser le SDK

Toute génération de réponse TwiML (Twilio Markup Language) **doit** passer par le SDK officiel Twilio, jamais par concaténation de chaînes XML.

✅ **Correct :**
```typescript
const VoiceResponse = twilio.twiml.VoiceResponse;
const twiml = new VoiceResponse();
twiml.say({ voice: 'alice', language: 'fr-FR' }, 'Bonjour');
twiml.gather({ input: ['speech'], action: '/handle-input' });
```

❌ **Incorrect :**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice" language="fr-FR">Bonjour</Say>
  <Gather input="speech" action="/handle-input"/>
</Response>
```

Le SDK officiel :
- Échappe automatiquement les entrées utilisateur (prévient les injections XML/SSRF)
- Valide la structure avant envoi
- Garantit la conformité avec l'API Twilio

## Variables d'environnement requises

Consultez le fichier [`.env.example`](echoroom-web/.env.example) à la racine du projet `echoroom-web` pour la liste complète des variables d'environnement nécessaires.

**Points d'attention :**
- `PHONE_ENCRYPTION_KEY` : clé de 256 bits (32 caractères minimum) pour le chiffrement AES-256-GCM des numéros de téléphone
- `TWILIO_TOKEN_SECRET` : secret HMAC (16 caractères minimum) pour la signature des tokens d'accès internes
- `NEXTAUTH_SECRET` : secret JWT (32 caractères minimum) — **ne pas utiliser la valeur par défaut en production**
