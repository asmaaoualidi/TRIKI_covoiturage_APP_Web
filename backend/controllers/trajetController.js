// controllers/trajetController.js
const db = require('../config/db');

// [AJOUT TRIKI.COV] : coordonnées approximatives des principales villes marocaines.
// Sert de filet de sécurité côté serveur : si le frontend ne fournit pas
// lat_depart/lng_depart/lat_arrivee/lng_arrivee (ancien formulaire, ancien client,
// ancienne donnée), le backend résout quand même les coordonnées à partir du nom
// de la ville pour que la carte du trajet ne reste jamais vide.
const COORDS_VILLES = {
  'casablanca':   { lat: 33.5731, lng: -7.5898 },
  'rabat':        { lat: 34.0209, lng: -6.8416 },
  'marrakech':    { lat: 31.6295, lng: -7.9811 },
  'fes':          { lat: 34.0331, lng: -5.0003 },
  'tanger':       { lat: 35.7595, lng: -5.8340 },
  'agadir':       { lat: 30.4278, lng: -9.5981 },
  'meknes':       { lat: 33.8935, lng: -5.5547 },
  'oujda':        { lat: 34.6814, lng: -1.9086 },
  'kenitra':      { lat: 34.2610, lng: -6.5802 },
  'tetouan':      { lat: 35.5785, lng: -5.3684 },
  'safi':         { lat: 32.2994, lng: -9.2372 },
  'mohammedia':   { lat: 33.6861, lng: -7.3829 },
  'khouribga':    { lat: 32.8811, lng: -6.9063 },
  'el jadida':    { lat: 33.2316, lng: -8.5007 },
  'nador':        { lat: 35.1681, lng: -2.9287 },
};

const geocodeVille = (nom) => {
  if (!nom) return null;
  const clean = nom.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return COORDS_VILLES[clean] || null;
};

// ─────────────────────────────────────────────
// POST /api/trajets  (conducteur only)
// ─────────────────────────────────────────────
const createTrajet = async (req, res) => {
  const conducteur_id = req.user.id;
  const {
    vehicule_id,
    depart,
    arrivee,
    date_heure,
    prix,
    places_total,
    description,
    lat_depart,    // خط العرض لنقطة الانطلاق
    lng_depart,    // خط الطول لنقطة الانطلاق
    lat_arrivee,   // خط العرض لنقطة الوصول
    lng_arrivee    // خط الطول لنقطة الوصول
  } = req.body;

  // ── 1. Validation ──────────────────────────────
  if (!depart || !arrivee || !date_heure || !prix || !places_total) {
    return res.status(400).json({
      success: false,
      message: 'Champs obligatoires manquants : depart, arrivee, date_heure, prix, places_total.',
    });
  }

  if (Number(prix) <= 0 || Number(places_total) <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Le prix et le nombre de places doivent être des valeurs positives.',
    });
  }

  const departureDate = new Date(date_heure);
  if (isNaN(departureDate) || departureDate <= new Date()) {
    return res.status(400).json({
      success: false,
      message: 'La date du trajet doit être dans le futur.',
    });
  }

  // ── 2. Verify vehicle ownership (if provided) ──
  if (vehicule_id) {
    const [vehicles] = await db.query(
      'SELECT id FROM vehicules WHERE id = ? AND utilisateur_id = ?',
      [vehicule_id, conducteur_id]
    );
    if (vehicles.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Véhicule introuvable ou ne vous appartient pas.',
      });
    }
  }

  // ── 3. Insertion into Database with Localization ──
  // [CORRECTION TRIKI.COV] : si le frontend n'a pas envoyé de coordonnées,
  // on les résout côté serveur à partir du nom de ville (filet de sécurité).
  const departCoords  = (lat_depart && lng_depart) ? { lat: lat_depart, lng: lng_depart } : geocodeVille(depart);
  const arriveeCoords = (lat_arrivee && lng_arrivee) ? { lat: lat_arrivee, lng: lng_arrivee } : geocodeVille(arrivee);
  const finalLatDepart  = departCoords?.lat  ?? null;
  const finalLngDepart  = departCoords?.lng  ?? null;
  const finalLatArrivee = arriveeCoords?.lat ?? null;
  const finalLngArrivee = arriveeCoords?.lng ?? null;

  try {
    // Try insert with geo columns; fallback without if columns don't exist yet
    let result;
    try {
      const query = `
        INSERT INTO trajets
          (conducteur_id, vehicule_id, depart, arrivee, date_heure, prix,
           places_total, places_disponibles, description, lat_depart, lng_depart, lat_arrivee, lng_arrivee)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      [result] = await db.query(query, [
        conducteur_id, vehicule_id || null, depart.trim(), arrivee.trim(),
        date_heure, prix, places_total, places_total,
        description || null,
        finalLatDepart, finalLngDepart, finalLatArrivee, finalLngArrivee
      ]);
    } catch (geoErr) {
      // Fallback: insert without geo columns (table not yet migrated)
      const query = `
        INSERT INTO trajets
          (conducteur_id, vehicule_id, depart, arrivee, date_heure, prix,
           places_total, places_disponibles, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
      [result] = await db.query(query, [
        conducteur_id, vehicule_id || null, depart.trim(), arrivee.trim(),
        date_heure, prix, places_total, places_total, description || null
      ]);
    }

    const [newTrajet] = await db.query('SELECT * FROM trajets WHERE id = ?', [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Trajet publié avec succès avec géolocalisation.',
      data: newTrajet[0],
    });
  } catch (err) {
    console.error('[createTrajet]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la création du trajet.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/trajets  (public, with filters)
// ─────────────────────────────────────────────
const getTrajets = async (req, res) => {
  try {
    const { depart, arrivee, date, min_prix, max_prix, page = 1, limit = 10 } = req.query;

    let query = `
      SELECT
        t.*,
        u.nom        AS conducteur_nom,
        u.prenom     AS conducteur_prenom,
        u.note_moyenne,
        u.photo_profil,
        v.modele     AS vehicule_modele,
        v.couleur    AS vehicule_couleur
      FROM trajets t
      JOIN utilisateurs u ON t.conducteur_id = u.id
      LEFT JOIN vehicules v ON t.vehicule_id = v.id
      WHERE t.statut = 'actif'
        AND t.places_disponibles > 0
        AND t.date_heure > NOW()
    `;

    const params = [];

    if (depart) {
      query += ' AND t.depart LIKE ?';
      params.push(`%${depart.trim()}%`);
    }
    if (arrivee) {
      query += ' AND t.arrivee LIKE ?';
      params.push(`%${arrivee.trim()}%`);
    }
    if (date) {
      query += ' AND DATE(t.date_heure) = ?';
      params.push(date);
    }
    if (min_prix) {
      query += ' AND t.prix >= ?';
      params.push(Number(min_prix));
    }
    if (max_prix) {
      query += ' AND t.prix <= ?';
      params.push(Number(max_prix));
    }

    query += ' ORDER BY t.date_heure ASC';

    // Pagination
    const offset = (Number(page) - 1) * Number(limit);
    query += ' LIMIT ? OFFSET ?';
    params.push(Number(limit), offset);

    const [trajets] = await db.query(query, params);

    // Count total for pagination meta
    let countQuery = `
      SELECT COUNT(*) AS total FROM trajets t
      WHERE t.statut = 'actif' AND t.places_disponibles > 0 AND t.date_heure > NOW()
    `;
    const countParams = [];
    if (depart)    { countQuery += ' AND t.depart LIKE ?';        countParams.push(`%${depart.trim()}%`); }
    if (arrivee)   { countQuery += ' AND t.arrivee LIKE ?';       countParams.push(`%${arrivee.trim()}%`); }
    if (date)      { countQuery += ' AND DATE(t.date_heure) = ?'; countParams.push(date); }
    if (min_prix)  { countQuery += ' AND t.prix >= ?';            countParams.push(Number(min_prix)); }
    if (max_prix)  { countQuery += ' AND t.prix <= ?';            countParams.push(Number(max_prix)); }

    const [[{ total }]] = await db.query(countQuery, countParams);

    return res.status(200).json({
      success: true,
      data: trajets,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    console.error('[getTrajets]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des trajets.' });
  }
};

// ─────────────────────────────────────────────
// GET /api/trajets/:id  (public)
// ─────────────────────────────────────────────
const getTrajetById = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         t.*,
         u.nom AS conducteur_nom, u.prenom AS conducteur_prenom,
         u.note_moyenne, u.telephone, u.photo_profil,
         v.modele AS vehicule_modele, v.couleur AS vehicule_couleur, v.nb_places AS vehicule_places
       FROM trajets t
       JOIN utilisateurs u ON t.conducteur_id = u.id
       LEFT JOIN vehicules v ON t.vehicule_id = v.id
       WHERE t.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trajet introuvable.' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[getTrajetById]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur.' });
  }
};

// ─────────────────────────────────────────────
// DELETE /api/trajets/:id  (owner only)
// ─────────────────────────────────────────────
const cancelTrajet = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const [rows] = await db.query('SELECT * FROM trajets WHERE id = ?', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Trajet introuvable.' });
    }

    const trajet = rows[0];

    if (trajet.conducteur_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Vous n\'êtes pas autorisé à annuler ce trajet.',
      });
    }

    if (trajet.statut === 'annule') {
      return res.status(400).json({ success: false, message: 'Ce trajet est déjà annulé.' });
    }

    await db.query('UPDATE trajets SET statut = ? WHERE id = ?', ['annule', id]);
    await db.query(
      'UPDATE reservations SET statut = ? WHERE trajet_id = ? AND statut = ?',
      ['annule', id, 'en_attente']
    );

    return res.status(200).json({
      success: true,
      message: 'Trajet annulé avec succès. Les réservations en attente ont été annulées.',
    });
  } catch (err) {
    console.error('[cancelTrajet]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de l\'annulation du trajet.' });
  }
};

// تصدير الدوال بشكل موحد وصحيح لـ routes/trajetRoutes.js
module.exports = { createTrajet, getTrajets, getTrajetById, cancelTrajet };