const db = require('../config/db');

// 1. إرسال رسالة (POST /api/chat/envoyer)
exports.envoyerMessage = async (req, res) => {
    try {
        const { trajet_id, receveur_id, destinataire_id, message } = req.body;
        const expediteur_id = req.user.id; // مأخوذ من الـ Token
        const destId = destinataire_id || receveur_id;

        if (!destId) {
            return res.status(400).json({ success: false, message: 'destinataire_id (ou receveur_id) manquant.' });
        }

        if (!trajet_id) {
            return res.status(400).json({ success: false, message: 'trajet_id manquant.' });
        }

        const query = `INSERT INTO messages (trajet_id, expediteur_id, destinataire_id, contenu) VALUES (?, ?, ?, ?)`;
        const [result] = await db.query(query, [trajet_id, expediteur_id, destId, message]);

        console.log(`[Chat] Message envoyé - ID: ${result.insertId}, de: ${expediteur_id}, à: ${destId}, trajet: ${trajet_id}`);
        res.status(201).json({ success: true, message: "Message envoyé avec succès", data: { id: result.insertId } });
    } catch (error) {
        console.error('[ChatError - envoyerMessage]', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

// 2. جلب رسائل شات معين (GET /api/chat/:trajet_id)
exports.obtenirDiscussion = async (req, res) => {
    try {
        const { trajet_id } = req.params;
        const user_id = req.user.id;

        console.log(`[Chat - obtenirDiscussion] trajet_id=${trajet_id}, user_id=${user_id}`);

        // Récupère TOUS les messages du trajet (pas de filtre par user pour le moment)
        const query = `
            SELECT m.*, m.created_at AS date_envoi, 
                   u.nom as nom_expediteur, u.prenom as prenom_expediteur
            FROM messages m
            LEFT JOIN utilisateurs u ON m.expediteur_id = u.id
            WHERE m.trajet_id = ?
            ORDER BY m.created_at ASC`;

        const [messages] = await db.query(query, [trajet_id]);
        
        console.log(`[Chat - obtenirDiscussion] Messages trouvés: ${messages.length}`);
        messages.forEach(m => {
            console.log(`  - Message ${m.id}: de ${m.expediteur_id} à ${m.destinataire_id}: "${m.contenu}"`);
        });

        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('[ChatError - obtenirDiscussion]', error);
        res.status(500).json({ success: false, error: error.message });
    }
};