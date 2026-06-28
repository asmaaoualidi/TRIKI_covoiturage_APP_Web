// controllers/chatbotController.js

// ─────────────────────────────────────────────
// Knowledge base: FAQ intent → answer
// ─────────────────────────────────────────────
const FAQ = [
  {
    intent: 'publier_trajet',
    keywords: ['publier', 'créer trajet', 'ajouter trajet', 'proposer', 'offrir trajet', 'conducteur'],
    answer: `Pour publier un trajet, vous devez :
1. Avoir un compte avec le rôle "conducteur".
2. Vous connecter et accéder à la section "Publier un trajet".
3. Renseigner le départ, l'arrivée, la date, l'heure, le nombre de places et le prix.
4. Associer votre véhicule (optionnel mais recommandé).
5. Valider — votre trajet sera visible immédiatement par les passagers.`,
  },
  {
    intent: 'reserver_trajet',
    keywords: ['réserver', 'booking', 'book', 'reserver', 'prendre une place', 'passager', 'comment réserver'],
    answer: `Pour réserver un trajet :
1. Connectez-vous à votre compte.
2. Recherchez un trajet en entrant votre ville de départ, d'arrivée et la date.
3. Cliquez sur le trajet de votre choix puis sur "Réserver".
4. Choisissez le nombre de places souhaitées.
5. Procédez au paiement sécurisé via Stripe.
6. Vous recevrez une notification de confirmation.`,
  },
  {
    intent: 'paiement',
    keywords: ['paiement', 'payer', 'prix', 'tarif', 'coût', 'stripe', 'carte', 'frais', 'remboursement'],
    answer: `Les paiements sur notre plateforme sont traités de façon sécurisée via Stripe.
- Le montant total = prix du trajet × nombre de places réservées.
- Votre carte n'est débitée qu'après confirmation du conducteur.
- En cas d'annulation avant le départ, un remboursement peut être déclenché selon notre politique.
- Devises acceptées : MAD (Dirham marocain).`,
  },
  {
    intent: 'annuler_reservation',
    keywords: ['annuler réservation', 'annulation', 'annuler ma place', 'supprimer réservation'],
    answer: `Pour annuler une réservation :
1. Rendez-vous dans votre espace "Mes réservations".
2. Sélectionnez la réservation concernée et cliquez sur "Annuler".
3. Les places sont automatiquement restituées au conducteur.
Notez que les politiques de remboursement dépendent du délai d'annulation avant le départ.`,
  },
  {
    intent: 'annuler_trajet',
    keywords: ['annuler trajet', 'supprimer trajet', 'annuler mon trajet'],
    answer: `En tant que conducteur, vous pouvez annuler un trajet depuis votre tableau de bord "Mes trajets". Cliquez sur le trajet concerné et sélectionnez "Annuler". Les passagers ayant une réservation en attente seront automatiquement notifiés.`,
  },
  {
    intent: 'inscription',
    keywords: ['inscription', 's\'inscrire', 'créer compte', 'register', 'signup', 'comment s\'inscrire'],
    answer: `Pour créer un compte :
1. Cliquez sur "S'inscrire" sur la page d'accueil.
2. Renseignez votre nom, prénom, email et mot de passe.
3. Choisissez votre rôle : "Passager" pour réserver, ou "Conducteur" pour aussi proposer des trajets.
4. Validez votre inscription — vous êtes prêt !`,
  },
  {
    intent: 'connexion',
    keywords: ['connexion', 'se connecter', 'login', 'mot de passe oublié', 'oublié mot de passe'],
    answer: `Pour vous connecter, utilisez votre email et mot de passe sur la page de connexion. Si vous avez oublié votre mot de passe, utilisez la fonction "Mot de passe oublié" pour recevoir un lien de réinitialisation par email.`,
  },
  {
    intent: 'vehicule',
    keywords: ['véhicule', 'voiture', 'ajouter véhicule', 'immatriculation', 'ajouter ma voiture'],
    answer: `Pour ajouter un véhicule :
1. Accédez à votre profil puis "Mes véhicules".
2. Cliquez sur "Ajouter un véhicule".
3. Saisissez le modèle, la couleur, l'immatriculation et le nombre de places.
4. Sauvegardez. Vous pouvez ensuite associer ce véhicule lors de la création d'un trajet.`,
  },
  {
    intent: 'avis_notation',
    keywords: ['avis', 'notation', 'note', 'évaluation', 'laisser avis', 'commentaire'],
    answer: `Après chaque trajet, vous pouvez laisser un avis sur le conducteur ou le passager. La note (de 1 à 5 étoiles) et le commentaire permettent de construire la confiance sur la plateforme. La note moyenne de chaque utilisateur est visible sur son profil.`,
  },
  {
    intent: 'messagerie',
    keywords: ['message', 'contacter', 'envoyer message', 'chat', 'communiquer', 'conducteur contact'],
    answer: `La messagerie intégrée vous permet de contacter directement le conducteur ou le passager depuis la page du trajet. Vos messages sont visibles dans la section "Messages" de votre espace personnel.`,
  },
  {
    intent: 'securite',
    keywords: ['sécurité', 'confiance', 'sûr', 'fiable', 'vérification', 'arnaque'],
    answer: `La sécurité est notre priorité :
- Les comptes sont vérifiés par email.
- Le système de notation et d'avis assure la transparence.
- Les paiements transitent par Stripe, certifié PCI-DSS.
- Les coordonnées des utilisateurs ne sont partagées qu'après confirmation de réservation.`,
  },
  {
    intent: 'salutation',
    keywords: ['bonjour', 'salut', 'hello', 'bonsoir', 'hi', 'salam', 'hey'],
    answer: `Bonjour ! Je suis l'assistant virtuel de TRIKI.COV. Je peux vous aider sur :
- La publication ou la réservation d'un trajet
- Le paiement et les annulations
- La gestion de votre compte et véhicules
- Et bien plus encore !
Que puis-je faire pour vous ?`,
  },
  {
    intent: 'contact_support',
    keywords: ['support', 'aide', 'assistance', 'contacter équipe', 'problème', 'bug'],
    answer: `Pour contacter notre équipe de support, envoyez un email à support@triki.cov ou utilisez le formulaire de contact sur notre site TRIKI.COV. Notre équipe vous répond sous 24h ouvrées.`,
  },
];

// ─────────────────────────────────────────────
// Rule-based matcher
// ─────────────────────────────────────────────
const findAnswer = (message) => {
  const lower = message.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let bestMatch = null;
  let bestScore = 0;

  for (const item of FAQ) {
    let score = 0;
    for (const kw of item.keywords) {
      if (lower.includes(kw.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
        score += 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestScore > 0 ? bestMatch.answer : null;
};

// ─────────────────────────────────────────────
// POST /api/chatbot
// ─────────────────────────────────────────────
const chatbot = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Le champ "message" est requis.',
    });
  }

  if (message.trim().length > 500) {
    return res.status(400).json({
      success: false,
      message: 'Le message ne peut pas dépasser 500 caractères.',
    });
  }

  try {
    // ── Try rule-based first (fast, free, no latency) ──
    const ruleAnswer = findAnswer(message.trim());

    if (ruleAnswer) {
      return res.status(200).json({
        success: true,
        source: 'faq',
        response: ruleAnswer,
      });
    }

    // ── Fallback: Claude API (if key is configured) ──────
    if (process.env.ANTHROPIC_API_KEY) {
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const aiMessage = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 400,
        system: `Tu es un assistant virtuel pour une plateforme de covoiturage marocaine appelée TRIKI.COV.
Tu réponds uniquement aux questions concernant la plateforme : réservations, publications de trajets, paiements Stripe en MAD, annulations, gestion de compte, véhicules, avis et messagerie.
Si la question ne concerne pas la plateforme, réponds poliment que tu ne peux traiter que les questions liées à TRIKI.COV.
Réponds toujours en français, de façon concise et professionnelle.`,
        messages: [{ role: 'user', content: message.trim() }],
      });

      return res.status(200).json({
        success: true,
        source: 'ai',
        response: aiMessage.content[0].text,
      });
    }

    // ── Final fallback ────────────────────────────────────
    return res.status(200).json({
      success: true,
      source: 'fallback',
      response: `Je n'ai pas bien compris votre question. Voici ce sur quoi je peux vous aider :
- Publier ou réserver un trajet
- Gérer vos réservations et annulations
- Questions sur le paiement
- Créer et gérer votre compte
- Ajouter un véhicule
Reformulez votre question ou contactez notre support à support@covoiturage.ma.`,
    });
  } catch (err) {
    console.error('[chatbot]', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors du traitement de votre message.',
    });
  }
};

module.exports = { chatbot };
