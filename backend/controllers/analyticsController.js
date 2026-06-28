// controllers/analyticsController.js
const db = require('../config/db');

exports.getGlobalStats = async (req, res) => {
  try {
    // 1. حساب عدد المستخدمين الإجمالي
    const [[{ total_users }]] = await db.query("SELECT COUNT(*) as total_users FROM utilisateurs");
    
    // 2. حساب عدد الرحلات النشطة
    const [[{ total_trajets }]] = await db.query("SELECT COUNT(*) as total_trajets FROM trajets WHERE statut = 'actif'");
    
    // 3. حساب إجمالي الأرباح من الحجوزات المؤكدة
    const [[{ total_revenus }]] = await db.query("SELECT SUM(montant_total) as total_revenus FROM reservations WHERE statut = 'confirme'");

    return res.status(200).json({
      success: true,
      data: {
        total_utilisateurs: total_users,
        total_trajets_actifs: total_trajets,
        chiffre_affaires_mad: total_revenus || 0
      }
    });
  } catch (err) {
    console.error('[AnalyticsControllerError]', err);
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de la récupération des statistiques.' 
    });
  }
};

// ── Statistiques publiques (page d'accueil) ──────────────────────────────
// Volontairement sans le chiffre d'affaires : ces chiffres sont affichés à
// tout le monde (visiteur non connecté), donc on ne renvoie que ce qui est
// sans risque à montrer publiquement, y compris la note moyenne (absente
// de getGlobalStats jusqu'ici).
exports.getPublicStats = async (req, res) => {
  try {
    const [[{ total_users }]] = await db.query("SELECT COUNT(*) as total_users FROM utilisateurs");
    const [[{ total_trajets }]] = await db.query("SELECT COUNT(*) as total_trajets FROM trajets WHERE statut = 'actif'");
    const [[{ note_moyenne }]] = await db.query("SELECT ROUND(AVG(note), 1) as note_moyenne FROM avis");

    return res.status(200).json({
      success: true,
      data: {
        total_utilisateurs: total_users,
        total_trajets_actifs: total_trajets,
        note_moyenne: note_moyenne || 0
      }
    });
  } catch (err) {
    console.error('[AnalyticsControllerError]', err);
    return res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la récupération des statistiques.'
    });
  }
};