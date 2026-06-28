require('dotenv').config();
const db = require('../config/db');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    const email = 'admin@triki.cov';
    const password = 'Admin@123';
    const prenom = 'Admin';
    const nom = 'TRIKI';
    
    // Hash password
    const motDePasse = await bcrypt.hash(password, 10);
    
    // Insert admin user
    const [result] = await db.query(
      'INSERT INTO utilisateurs (prenom, nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?, ?)',
      [prenom, nom, email, motDePasse, 'admin']
    );
    
    console.log('✅ Admin créé avec succès !');
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Mot de passe: ${password}`);
    console.log(`ID: ${result.insertId}`);
    process.exit(0);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log('⚠️  Cet admin existe déjà. Email: admin@triki.cov');
    } else {
      console.error('❌ Erreur:', err.message);
    }
    process.exit(1);
  }
}

createAdmin();
