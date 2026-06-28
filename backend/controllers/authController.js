// controllers/authController.js
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// ── 1. Inscription (Register) ──────────────────────────
const register = async (req, res) => {
  try {
    const { nom, prenom, email, mot_de_passe, telephone, role } = req.body;

    if (!nom || !prenom || !email || !mot_de_passe) {
      return res.status(400).json({ success: false, message: 'Champs obligatoires manquants.' });
    }

    const [userExists] = await db.query("SELECT id FROM utilisateurs WHERE email = ?", [email]);
    if (userExists.length > 0) {
      return res.status(400).json({ success: false, message: "Cet email est déjà utilisé." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPass = await bcrypt.hash(mot_de_passe, salt);

    await db.query(
      "INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role) VALUES (?, ?, ?, ?, ?, ?)",
      [nom, prenom, email, hashedPass, telephone || null, role || 'passager']
    );

    return res.status(201).json({ success: true, message: "Compte créé avec succès !" });
  } catch (err) {
    console.error('[RegisterError]', err);
    const msg = process.env.NODE_ENV !== 'production'
      ? err.message
      : 'Erreur serveur lors de l\'inscription.';
    return res.status(500).json({ success: false, message: msg });
  }
};

// ── 2. Connexion (Login) ───────────────────────────────
const login = async (req, res) => {
  try {
    const { email, mot_de_passe } = req.body;

    if (!email || !mot_de_passe) {
      return res.status(400).json({ success: false, message: 'Veuillez fournir un email et un mot de passe.' });
    }

    const [users] = await db.query("SELECT * FROM utilisateurs WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.status(400).json({ success: false, message: "Identifiants incorrects." });
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(mot_de_passe, user.mot_de_passe);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Identifiants incorrects." });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      token,
      user: { id: user.id, nom: user.nom, prenom: user.prenom, role: user.role }
    });
  } catch (err) {
    console.error('[LoginError]', err);
    const msg = process.env.NODE_ENV !== 'production' ? err.message : 'Erreur serveur lors de la connexion.';
    return res.status(500).json({ success: false, message: msg });
  }
};

// ── 3. Admin Analytics (Dashboard) ─────────────────────
const getGlobalStats = async (req, res) => {
  try {
    // التحقق من دور المسؤول
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Accès refusé. Réservé aux administrateurs." });
    }

    const [[{ total_users }]] = await db.query("SELECT COUNT(*) as total_users FROM utilisateurs");
    const [[{ total_trajets }]] = await db.query("SELECT COUNT(*) as total_trajets FROM trajets WHERE statut = 'actif'");
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
    console.error('[AnalyticsError]', err);
    return res.status(500).json({ success: false, message: 'Erreur serveur lors de la récupération des statistiques.' });
  }
};

// التصدير الجماعي كـ Object يحتوي على دالات (Functions)
module.exports = { register, login, getGlobalStats };