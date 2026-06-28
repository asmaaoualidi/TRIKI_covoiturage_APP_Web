// src/pages/ChatPage.jsx — TRIKI.COV
// CORRECTION : les routes API utilisaient /trajets/:id/messages (inexistantes)
// → corrigées vers /chat/:trajet_id (chatController existant)
// AMÉLIORATION : Design de messagerie moderne avec bulles, avatar, polling
import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import API from '../api';

// ─── Bulle de message ─────────────────────────────────────────────────────────
function MessageBubble({ msg, isOwn }) {
  const time = msg.date_envoi || msg.created_at
    ? new Date(msg.date_envoi || msg.created_at).toLocaleTimeString('fr-FR', {
        hour: '2-digit', minute: '2-digit'
      })
    : '';

  return (
    <div className={`flex gap-2 mb-3 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar initiales */}
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-auto">
          {(msg.prenom_expediteur?.[0] || msg.nom_expediteur?.[0] || '?').toUpperCase()}
        </div>
      )}

      <div className={`max-w-[70%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
        {/* Nom (uniquement pour les messages reçus) */}
        {!isOwn && (
          <span className="text-[11px] text-gray-400 font-medium mb-1 px-1">
            {msg.prenom_expediteur} {msg.nom_expediteur}
          </span>
        )}

        {/* Bulle */}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isOwn
            ? 'bg-triki text-white rounded-tr-sm'
            : 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'}`}>
          {msg.contenu}
        </div>

        {/* Heure */}
        <span className="text-[10px] text-gray-400 mt-1 px-1">{time}</span>
      </div>
    </div>
  );
}

// ─── Page principale Chat ─────────────────────────────────────────────────────
function ChatPage() {
  const { trajet_id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [trajet, setTrajet] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [receveurId, setReceveurId] = useState(null);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const pollingRef = useRef(null);

  // Charge les infos du trajet + messages initiaux
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const init = async () => {
      try {
        // 1. Récupérer le trajet
        const trajetRes = await API.get(`/trajets/${trajet_id}`);
        const t = trajetRes.data.data || trajetRes.data;
        setTrajet(t);

        // 2. Récupérer les messages via /api/chat/:trajet_id (route correcte)
        const msgRes = await API.get(`/chat/${trajet_id}`);
        const fetchedMessages = msgRes.data.data || [];
        setMessages(fetchedMessages);

        // 3. Déterminer le destinataire
        // Si je suis passager → je parle au conducteur
        if (user.id !== t.conducteur_id) {
          setReceveurId(t.conducteur_id);
        } else {
          // Je suis conducteur → je dois trouver l'ID du passager
          // Vérifier d'abord dans les messages
          let destinataire = fetchedMessages.find(msg => msg.expediteur_id !== user.id);
          if (destinataire) {
            setReceveurId(destinataire.expediteur_id);
          } else {
            // Si pas de message, chercher les passagers du trajet via les réservations
            try {
              const resRes = await API.get(`/reservations?trajet_id=${trajet_id}`);
              const reservations = resRes.data.data || [];
              if (reservations.length > 0) {
                // Prendre le premier passager
                setReceveurId(reservations[0].passager_id);
              }
            } catch (e) {
              console.warn('Impossible de charger les réservations:', e);
            }
          }
        }
      } catch (err) {
        console.error('Erreur init chat:', err);
        setError('Impossible de charger la conversation.');
      } finally {
        setLoading(false);
      }
    };

    init();

    // Polling toutes les 5s pour simuler le temps réel
    pollingRef.current = setInterval(async () => {
      try {
        const res = await API.get(`/chat/${trajet_id}`);
        setMessages(res.data.data || []);
      } catch {}
    }, 5000);

    return () => clearInterval(pollingRef.current);
  }, [trajet_id]);

  // Auto-scroll au dernier message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMsg.trim()) return;
    if (!receveurId) {
      setError('Impossible d\'envoyer : destinataire non identifié.');
      return;
    }

    setSending(true);
    const msgText = newMsg.trim();
    setNewMsg(''); // Vider immédiatement pour une meilleure UX

    try {
      // POST vers /api/chat/envoyer (route correcte du chatController)
      await API.post('/chat/envoyer', {
        trajet_id: parseInt(trajet_id),
        destinataire_id: receveurId,
        message: msgText,
      });
      // Rafraîchir les messages
      const res = await API.get(`/chat/${trajet_id}`);
      setMessages(res.data.data || []);
      inputRef.current?.focus();
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de l\'envoi.');
      setNewMsg(msgText); // Restaurer si erreur
    } finally {
      setSending(false);
    }
  };

  // Affichage du séparateur de date entre les messages
  const getDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Aujourd\'hui';
    if (d.toDateString() === yesterday.toDateString()) return 'Hier';
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-triki-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Navbar ────────────────────────────────────────────────────────── */}
      <nav className="bg-gray-900 px-4 py-0 flex justify-between items-stretch h-14 shrink-0 z-50">
        <Link to="/" className="flex items-center gap-2 py-3">
          <span className="text-xl font-black tracking-tight">
            <span className="text-triki">TRIKI</span><span className="text-white">.COV</span>
          </span>
        </Link>
        <Link to="/dashboard" className="flex items-center text-sm text-white/60 hover:text-white font-medium transition">
          ← Mon espace
        </Link>
      </nav>

      {/* ── En-tête conversation ──────────────────────────────────────────── */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-triki to-triki-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
          💬
        </div>
        <div>
          <h1 className="text-sm font-bold text-gray-900">
            {trajet ? `${trajet.depart} → ${trajet.arrivee}` : `Trajet #${trajet_id}`}
          </h1>
          <p className="text-xs text-gray-400">
            {trajet
              ? `${new Date(trajet.date_heure).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · ${trajet.prix} MAD`
              : 'Chargement...'}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
          <span className="text-xs text-gray-400">En ligne</span>
        </div>
      </div>

      {/* ── Zone de messages ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4" style={{ background: '#f0f2f5' }}>
        {error && (
          <div className="text-center mb-4">
            <span className="text-xs text-triki-600 bg-triki-50 px-3 py-1 rounded-full border border-triki-200">
              {error}
            </span>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <div className="text-4xl mb-3">👋</div>
            <p className="text-gray-500 font-medium text-sm">Démarrez la conversation !</p>
            <p className="text-gray-400 text-xs mt-1">Envoyez un message au conducteur.</p>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const prevMsg = messages[idx - 1];
              const currDate = new Date(msg.date_envoi || msg.created_at).toDateString();
              const prevDate = prevMsg
                ? new Date(prevMsg.date_envoi || prevMsg.created_at).toDateString()
                : null;
              const showDateSep = !prevDate || currDate !== prevDate;

              return (
                <React.Fragment key={msg.id || idx}>
                  {/* Séparateur de date */}
                  {showDateSep && (
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-gray-200"></div>
                      <span className="text-[11px] font-medium text-gray-400 shrink-0">
                        {getDateLabel(msg.date_envoi || msg.created_at)}
                      </span>
                      <div className="flex-1 h-px bg-gray-200"></div>
                    </div>
                  )}
                  <MessageBubble
                    msg={msg}
                    isOwn={msg.expediteur_id === user.id}
                  />
                </React.Fragment>
              );
            })}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Zone de saisie ────────────────────────────────────────────────── */}
      <div className="bg-white border-t px-4 py-3 shrink-0 shadow-lg">
        {!receveurId && trajet && user.id === trajet.conducteur_id && (
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mb-2 border border-amber-200">
            ⚠️ En attente d'un premier message d'un passager pour initier la conversation.
          </p>
        )}
        <form onSubmit={sendMessage} className="flex items-center gap-2">
            <input
            ref={inputRef}
            type="text"
            value={newMsg}
            onChange={e => setNewMsg(e.target.value)}
            placeholder="Écrire un message..."
            disabled={sending}
              className="flex-1 px-4 py-3 bg-gray-100 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-triki-400 focus:bg-white transition"
          />
          <button
            type="submit"
            disabled={sending || !newMsg.trim()}
            className="w-11 h-11 rounded-full bg-triki hover:bg-triki-600 disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center transition shrink-0"
          >
            {sending
              ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
              : <svg className="w-5 h-5 rotate-45 -ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
            }
          </button>
        </form>
      </div>
    </div>
  );
}

export default ChatPage;