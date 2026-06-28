require('dotenv').config();
const db = require('../config/db');

async function test() {
  try {
    console.log('🔍 Test de récupération des messages (simulation de /api/chat/:trajet_id)\n');

    // Récupérer les messages du trajet 2 (comme le ferait l'API)
    const trajet_id = 2;
    const user_id = 6; // L'utilisateur qui consulte

    console.log(`Test: récupération messages du trajet ${trajet_id} pour l'utilisateur ${user_id}\n`);

    const query = `
      SELECT m.*, m.created_at AS date_envoi, 
             u.nom as nom_expediteur, u.prenom as prenom_expediteur
      FROM messages m
      LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
      WHERE m.trajet_id = ? AND (m.expediteur_id = ? OR m.destinataire_id = ?)
      ORDER BY m.created_at ASC`;

    const [messages] = await db.query(query, [trajet_id, user_id, user_id]);

    console.log(`📨 Messages trouvés: ${messages.length}\n`);
    
    if (messages.length === 0) {
      console.log('⚠️  Aucun message trouvé pour cet utilisateur et ce trajet');
    } else {
      messages.forEach((msg, idx) => {
        console.log(`Message ${idx + 1}:`);
        console.log(`  ID: ${msg.id}`);
        console.log(`  De: ${msg.nom_expediteur} ${msg.prenom_expediteur} (ID: ${msg.expediteur_id})`);
        console.log(`  À: ID ${msg.destinataire_id}`);
        console.log(`  Trajet: ${msg.trajet_id}`);
        console.log(`  Contenu: "${msg.contenu}"`);
        console.log(`  Date: ${msg.date_envoi}`);
        console.log('');
      });
    }

    // Test direct: vérifier la même requête que dans obtenirDiscussion
    console.log('✅ Si tu vois les messages ci-dessus, la requête fonctionne!');
    console.log('❌ Si aucun message, c\'est parce que user_id ne correspond pas à expediteur_id ou destinataire_id');

    process.exit(0);
  } catch (err) {
    console.error('❌ Erreur:', err.message);
    process.exit(1);
  }
}

test();
