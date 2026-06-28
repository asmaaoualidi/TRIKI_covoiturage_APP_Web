const db = require('../config/db');

exports.getUsers = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const [users] = await db.query(
      `SELECT id, nom, prenom, email, telephone, role, created_at FROM utilisateurs ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
    return res.status(200).json({ success: true, data: users });
  } catch (err) {
    console.error('[AdminController:getUsers]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des utilisateurs.' });
  }
};

exports.getReservations = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const [reservations] = await db.query(
      `SELECT
         r.id,
         r.passager_id,
         r.trajet_id,
         r.nb_places,
         r.statut,
         r.montant_total,
         r.created_at,
         u.nom AS passager_nom,
         u.prenom AS passager_prenom,
         t.depart,
         t.arrivee,
         t.date_heure,
         t.prix AS prix_trajet
       FROM reservations r
       JOIN utilisateurs u ON r.passager_id = u.id
       JOIN trajets t ON r.trajet_id = t.id
       ORDER BY r.created_at DESC
       LIMIT ?`,
      [limit]
    );

    return res.status(200).json({ success: true, data: reservations });
  } catch (err) {
    console.error('[AdminController:getReservations]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des réservations.' });
  }
};

exports.getAllTrajets = async (req, res) => {
  try {
    const limit = Number(req.query.limit || 100);
    const [trajets] = await db.query(
      `SELECT
         t.id,
         t.conducteur_id,
         t.depart,
         t.arrivee,
         t.date_heure,
         t.prix,
         t.places_total,
         t.places_disponibles,
         t.statut,
         t.created_at,
         u.nom AS conducteur_nom,
         u.prenom AS conducteur_prenom,
         v.modele AS vehicule_modele,
         v.couleur AS vehicule_couleur
       FROM trajets t
       JOIN utilisateurs u ON t.conducteur_id = u.id
       LEFT JOIN vehicules v ON t.vehicule_id = v.id
       ORDER BY t.date_heure DESC
       LIMIT ?`,
      [limit]
    );

    return res.status(200).json({ success: true, data: trajets });
  } catch (err) {
    console.error('[AdminController:getAllTrajets]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des trajets.' });
  }
};
