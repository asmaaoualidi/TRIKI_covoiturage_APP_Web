require('dotenv').config();
const db = require('../config/db');

async function test() {
  try {
    console.log('🔍 Test de la table messages...\n');

    // 1. Vérifier que la table existe
    const [tables] = await db.query("SELECT * FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages'", [process.env.DB_NAME]);
    if (tables.length === 0) {
      console.error('❌ Table messages n\'existe pas !');
      process.exit(1);
    }
    console.log('✅ Table messages existe');

    // 2. Compter les messages existants
    const [[{ count }]] = await db.query("SELECT COUNT(*) as count FROM messages");
    console.log(`📊 Nombre de messages en base: ${count}`);

    // 3. Afficher les 5 derniers messages
    const [messages] = await db.query(`
      SELECT m.id, m.trajet_id, m.expediteur_id, m.destinataire_id, m.contenu, m.created_at,
             u.prenom, u.nom
      FROM messages m
      LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
      ORDER BY m.created_at DESC
      LIMIT 5
    `);
    
    if (messages.length === 0) {
      console.log('⚠️  Aucun message en base');
    } else {
      console.log('\n📨 5 derniers messages:');
      messages.forEach((msg, idx) => {
        console.log(`${idx + 1}. [Trajet ${msg.trajet_id}] ${msg.prenom} ${msg.nom} (ID:${msg.expediteur_id}) → ${msg.destinataire_id}`);
        console.log(`   Message: "${msg.contenu.substring(0, 50)}..."`);
        console.log(`   Date: ${msg.created_at}`);
      });
    }

    // 4. Tester l'insertion
    console.log('\n🧪 Test d\'insertion d\'un message test...');
    const [result] = await db.query(
      'INSERT INTO messages (trajet_id, expediteur_id, destinataire_id, contenu) VALUES (?, ?, ?, ?)',
      [1, 1, 2, 'Message de test']
    );
    console.log(`✅ Message inséré avec l'ID: ${result.insertId}`);

    // 5. Récupérer le message qu'on vient d'insérer
    const [retrieved] = await db.query(
      'SELECT * FROM messages WHERE id = ?',
      [result.insertId]
    );
    console.log('✅ Message récupéré:', retrieved[0]);

    console.log('\n✅ Tous les tests passed!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

test();
