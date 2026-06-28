// controllers/reservationController.js
const db = require('../config/db');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// [TRIKI.COV] : création automatique de la table `avis` si elle n'existe pas encore.
// Évite d'avoir à exécuter manuellement migration_avis.sql.
(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS avis (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        reservation_id  INT NOT NULL UNIQUE,
        passager_id     INT NOT NULL,
        conducteur_id   INT NOT NULL,
        note            TINYINT NOT NULL,
        commentaire     TEXT,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE CASCADE,
        FOREIGN KEY (passager_id)    REFERENCES utilisateurs(id) ON DELETE CASCADE,
        FOREIGN KEY (conducteur_id)  REFERENCES utilisateurs(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error('[reservationController] Impossible de créer la table avis:', err.message);
  }
})();

// ─────────────────────────────────────────────
// POST /api/reservations
// Flow: validate → Stripe PaymentIntent → insert reservation
// ─────────────────────────────────────────────
const createReservation = async (req, res) => {
  const passager_id = req.user.id;
  const { trajet_id, nb_places = 1, payment_method = 'stripe' } = req.body;
  const allowedMethods = ['stripe', 'cash'];

  if (!trajet_id) {
    return res.status(400).json({ success: false, message: 'trajet_id est obligatoire.' });
  }
  if (!allowedMethods.includes(payment_method)) {
    return res.status(400).json({ success: false, message: 'Méthode de paiement invalide.' });
  }
  if (Number(nb_places) < 1) {
    return res.status(400).json({ success: false, message: 'nb_places doit être au moins 1.' });
  }

  try {
    // ── 1. Fetch and validate the ride ────────
    const [trajets] = await db.query(
      'SELECT * FROM trajets WHERE id = ? AND statut = "actif"',
      [trajet_id]
    );

    if (trajets.length === 0) {
      return res.status(404).json({ success: false, message: 'Trajet introuvable ou non actif.' });
    }

    const trajet = trajets[0];

    if (trajet.conducteur_id === passager_id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas réserver votre propre trajet.' });
    }

    if (trajet.places_disponibles < Number(nb_places)) {
      return res.status(400).json({
        success: false,
        message: `Places insuffisantes. Disponibles : ${trajet.places_disponibles}, demandées : ${nb_places}.`,
      });
    }

    // ── 2. Check for duplicate reservation ────
    const [existing] = await db.query(
      'SELECT id FROM reservations WHERE passager_id = ? AND trajet_id = ?',
      [passager_id, trajet_id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà une réservation pour ce trajet.' });
    }

    // ── 3. Compute amount (MAD → centimes) ────
    const montant_total = (trajet.prix * Number(nb_places)).toFixed(2);
    const amountInCentimes = Math.round(montant_total * 100);   // Stripe uses smallest currency unit

    let reservationStatus = 'en_attente';
    let clientSecret = null;
    let paymentIntentId = null;

    if (payment_method === 'stripe') {
      if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_stripe_key_here')) {
        return res.status(500).json({
          success: false,
          message: 'Stripe n’est pas configuré. Choisissez le paiement en espèces ou configurez STRIPE_SECRET_KEY.',
        });
      }

      // ── 4. Create Stripe PaymentIntent ────────
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCentimes,
        currency: 'mad',
        metadata: {
          passager_id: String(passager_id),
          trajet_id: String(trajet_id),
          nb_places: String(nb_places),
        },
        description: `TRIKI.COV: ${trajet.depart} → ${trajet.arrivee}`,
      });

      clientSecret = paymentIntent.client_secret;
      paymentIntentId = paymentIntent.id;
      reservationStatus = 'en_attente';
    } else {
      reservationStatus = 'confirme';
    }

    // ── 5. Insert reservation ────────────────
    const [result] = await db.query(
      `INSERT INTO reservations
         (passager_id, trajet_id, nb_places, statut, montant_total)
       VALUES (?, ?, ?, ?, ?)`,
      [passager_id, trajet_id, nb_places, reservationStatus, montant_total]
    );

    return res.status(201).json({
      success: true,
      message: payment_method === 'cash'
        ? 'Réservation confirmée. Payez en espèces après le trajet.'
        : 'Réservation créée. Procédez au paiement.',
      data: {
        reservation_id: result.insertId,
        montant_total,
        status: reservationStatus,
        payment_method,
        clientSecret,
        payment_intent_id: paymentIntentId,
      },
    });
  } catch (err) {
    console.error('[createReservation]', err);

    // Surface Stripe-specific errors clearly
    if (err.type && err.type.startsWith('Stripe')) {
      return res.status(402).json({ success: false, message: `Erreur paiement Stripe : ${err.message}` });
    }

    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la réservation.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/reservations/webhook
// Stripe calls this to confirm or fail a payment
// ─────────────────────────────────────────────
const stripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripeWebhook] Signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const { passager_id, trajet_id, nb_places } = pi.metadata;

      // Confirm the reservation → trigger fires and decrements seats
      await db.query(
        `UPDATE reservations
         SET statut = 'confirme'
         WHERE passager_id = ? AND trajet_id = ? AND statut = 'en_attente'`,
        [passager_id, trajet_id]
      );

      // Notify the passenger
      await db.query(
        `INSERT INTO notifications (utilisateur_id, type, contenu)
         VALUES (?, 'reservation_confirmee', ?)`,
        [
          passager_id,
          `Votre réservation de ${nb_places} place(s) sur le trajet #${trajet_id} est confirmée.`,
        ]
      );
    }

    if (event.type === 'payment_intent.payment_failed') {
      const pi = event.data.object;
      const { passager_id, trajet_id } = pi.metadata;

      await db.query(
        `UPDATE reservations
         SET statut = 'annule'
         WHERE passager_id = ? AND trajet_id = ? AND statut = 'en_attente'`,
        [passager_id, trajet_id]
      );
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('[stripeWebhook] Traitement:', err);
    return res.status(500).json({ success: false, message: 'Erreur traitement webhook.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/reservations/mes-reservations
// ─────────────────────────────────────────────
const getMesReservations = async (req, res) => {
  try {
    // [TRIKI.COV] : on ne retourne que les réservations dont le trajet est
    // dans le futur ET dont le statut est pertinent (pas annulé).
    // CONVERT_TZ assure la comparaison en heure du Maroc (UTC+1) même si
    // le serveur MySQL tourne en UTC.
    const [rows] = await db.query(
      `SELECT
         r.*,
         t.depart, t.arrivee, t.date_heure, t.prix, t.conducteur_id,
         u.nom AS conducteur_nom, u.prenom AS conducteur_prenom
       FROM reservations r
       JOIN trajets t ON r.trajet_id = t.id
       JOIN utilisateurs u ON t.conducteur_id = u.id
       WHERE r.passager_id = ?
         AND t.date_heure > CONVERT_TZ(NOW(), @@session.time_zone, '+00:00')
         AND r.statut != 'annule'
       ORDER BY t.date_heure ASC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getMesReservations]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/reservations/historique
// Réservations passées du passager (pour pouvoir noter le conducteur)
// ─────────────────────────────────────────────
const getMesReservationsPassees = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         r.*,
         t.depart, t.arrivee, t.date_heure, t.prix, t.conducteur_id,
         u.nom AS conducteur_nom, u.prenom AS conducteur_prenom
       FROM reservations r
       JOIN trajets t ON r.trajet_id = t.id
       JOIN utilisateurs u ON t.conducteur_id = u.id
       WHERE r.passager_id = ?
         AND t.date_heure <= NOW()
         AND r.statut = 'confirme'
       ORDER BY t.date_heure DESC
       LIMIT 20`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getMesReservationsPassees]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─────────────────────────────────────────────
// POST /api/reservations/:id/avis
// Passager laisse un avis sur le conducteur après le trajet
// ─────────────────────────────────────────────
const soumettreAvis = async (req, res) => {
  try {
    const { id } = req.params;
    const passager_id = req.user.id;
    const { note, commentaire } = req.body;

    if (!note || note < 1 || note > 5) {
      return res.status(400).json({ success: false, message: 'La note doit être entre 1 et 5.' });
    }

    // Vérifier que la réservation appartient au passager et que le trajet est passé
    const [rows] = await db.query(
      `SELECT r.*, t.conducteur_id, t.date_heure
       FROM reservations r
       JOIN trajets t ON r.trajet_id = t.id
       WHERE r.id = ? AND r.passager_id = ? AND r.statut = 'confirme' AND t.date_heure <= NOW()`,
      [id, passager_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Réservation introuvable ou trajet non terminé.' });
    }

    const reservation = rows[0];

    // Vérifier qu'un avis n'a pas déjà été soumis
    const [existing] = await db.query(
      'SELECT id FROM avis WHERE reservation_id = ?',
      [id]
    );
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Vous avez déjà soumis un avis pour ce trajet.' });
    }

    // Insérer l'avis
    await db.query(
      `INSERT INTO avis (reservation_id, passager_id, conducteur_id, note, commentaire)
       VALUES (?, ?, ?, ?, ?)`,
      [id, passager_id, reservation.conducteur_id, note, commentaire || null]
    );

    return res.status(201).json({ success: true, message: 'Merci pour votre avis !' });
  } catch (err) {
    console.error('[soumettreAvis]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la soumission de l\'avis.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/reservations/recues
// Réservations reçues par le conducteur connecté sur ses propres trajets
// [AJOUT TRIKI.COV] : nécessaire pour que le conducteur voie ses passagers
// dans l'onglet Chat (la route globale GET /reservations n'existait pas).
// ─────────────────────────────────────────────
const getReservationsRecues = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         r.*,
         t.depart, t.arrivee, t.date_heure, t.prix, t.conducteur_id,
         u.nom AS passager_nom, u.prenom AS passager_prenom
       FROM reservations r
       JOIN trajets t ON r.trajet_id = t.id
       JOIN utilisateurs u ON r.passager_id = u.id
       WHERE t.conducteur_id = ?
       ORDER BY r.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (err) {
    console.error('[getReservationsRecues]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/reservations/:id  (cancel by passenger)
// ─────────────────────────────────────────────
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await db.query('SELECT * FROM reservations WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Réservation introuvable.' });
    }

    const reservation = rows[0];

    if (reservation.passager_id !== userId) {
      return res.status(403).json({ success: false, message: 'Non autorisé.' });
    }

    if (reservation.statut === 'annule') {
      return res.status(400).json({ success: false, message: 'Cette réservation est déjà annulée.' });
    }

    // Trigger after_reservation_update will restore seats if status was 'confirme'
    await db.query('UPDATE reservations SET statut = "annule" WHERE id = ?', [id]);

    return res.status(200).json({ success: true, message: 'Réservation annulée avec succès.' });
  } catch (err) {
    console.error('[cancelReservation]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

module.exports = {
  createReservation,
  stripeWebhook,
  getMesReservations,
  getMesReservationsPassees,
  soumettreAvis,
  getReservationsRecues,
  cancelReservation,
};
