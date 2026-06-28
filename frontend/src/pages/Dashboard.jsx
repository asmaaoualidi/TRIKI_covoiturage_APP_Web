// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// ── Configuration API autonome (Simulation Axios pour assurer la compatibilité) ──
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

// [CORRECTION TRIKI.COV] : auparavant, en cas d'erreur HTTP, le helper ne lisait
// jamais le corps JSON de la réponse (message d'erreur du backend) — il levait
// une Error générique "Erreur HTTP: status XXX". Tout le code qui lisait
// err.response?.data?.message recevait donc toujours undefined et affichait des
// messages d'erreur génériques/trompeurs (ex: "vérifiez la connexion au serveur backend"
// alors que le backend répondait correctement avec un message précis, ex: 404 de route).
const buildApiError = async (res) => {
  let data = null;
  try { data = await res.json(); } catch { /* corps non-JSON ou vide */ }
  const err = new Error(data?.message || `Erreur HTTP: status ${res.status}`);
  err.response = { status: res.status, data };
  return err;
};

const API = {
  get: async (endpoint, options = {}) => {
    let url = `${API_URL}${endpoint}`;
    if (options.params) {
      const query = new URLSearchParams(options.params).toString();
      url += `?${query}`;
    }
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      }
    });
    if (!res.ok) throw await buildApiError(res);
    const json = await res.json();
    return { data: json };
  },
  post: async (endpoint, body) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw await buildApiError(res);
    const json = await res.json();
    return { data: json };
  },
  delete: async (endpoint) => {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      }
    });
    if (!res.ok) throw await buildApiError(res);
    const json = await res.json();
    return { data: json };
  }
};

// [AJOUT TRIKI.COV] : coordonnées approximatives des principales villes marocaines.
// Nécessaire car le formulaire de publication ne demandait que les noms de villes
// (texte libre) sans jamais envoyer lat_depart/lng_depart/lat_arrivee/lng_arrivee
// au backend — la carte du trajet sélectionné restait donc toujours vide.
const COORDS_VILLES = {
  'casablanca':   { lat: 33.5731, lng: -7.5898 },
  'rabat':        { lat: 34.0209, lng: -6.8416 },
  'marrakech':    { lat: 31.6295, lng: -7.9811 },
  'fès':          { lat: 34.0331, lng: -5.0003 },
  'fes':          { lat: 34.0331, lng: -5.0003 },
  'tanger':       { lat: 35.7595, lng: -5.8340 },
  'agadir':       { lat: 30.4278, lng: -9.5981 },
  'meknès':       { lat: 33.8935, lng: -5.5547 },
  'meknes':       { lat: 33.8935, lng: -5.5547 },
  'oujda':        { lat: 34.6814, lng: -1.9086 },
  'kenitra':      { lat: 34.2610, lng: -6.5802 },
  'kénitra':      { lat: 34.2610, lng: -6.5802 },
  'tétouan':      { lat: 35.5785, lng: -5.3684 },
  'tetouan':      { lat: 35.5785, lng: -5.3684 },
  'safi':         { lat: 32.2994, lng: -9.2372 },
  'mohammedia':   { lat: 33.6861, lng: -7.3829 },
  'khouribga':    { lat: 32.8811, lng: -6.9063 },
  'el jadida':    { lat: 33.2316, lng: -8.5007 },
  'nador':        { lat: 35.1681, lng: -2.9287 },
};

const VILLES_MAROC = ['Casablanca', 'Rabat', 'Marrakech', 'Fès', 'Tanger', 'Agadir', 'Meknès', 'Oujda', 'Kenitra', 'Tétouan', 'Safi', 'Mohammedia', 'Khouribga', 'El Jadida', 'Nador'];

// Recherche tolérante (insensible aux accents/majuscules) dans le dictionnaire ci-dessus.
const geocodeVille = (nom) => {
  if (!nom) return null;
  const clean = nom.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // retire les accents
  for (const [ville, coords] of Object.entries(COORDS_VILLES)) {
    const villeClean = ville.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (villeClean === clean) return coords;
  }
  return null;
};


const callGemini = async (prompt, systemInstruction = "") => {
  const apiKey = ""; // Injectée dynamiquement au runtime
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  
  const payload = {
    contents: [{ parts: [{ text: prompt }] }]
  };
  if (systemInstruction) {
    payload.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  let delay = 1000;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text || "";
      }
    } catch (e) {
      // Ignorer l'erreur dans la console pour respecter les consignes de discrétion
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw new Error("Impossible de se connecter à l'intelligence artificielle. Veuillez réessayer.");
};

// ── UTILS POUR NETTOYER ET LIRE LES MESSAGES DU BACKEND ──────────────────────────
const getMessageText = (msg) => {
  if (!msg) return '';
  if (typeof msg === 'string') return msg;
  const val = msg.message || msg.message_text || msg.text || msg.content || msg.contenu;
  if (typeof val === 'object' && val !== null) {
    return JSON.stringify(val);
  }
  return val || '';
};

const getMessageTime = (msg) => {
  if (!msg) return '';
  const dateVal = msg.date_heure || msg.created_at || msg.date || msg.timestamp;
  if (!dateVal) return '';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

// ── COMPOSANT CARTOGRAPHIQUE AUTONOME (Leaflet via CDN) ─────────────────────
function AutonomousMap({ start, end }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const uniqueId = useRef(`map-${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    if (!document.getElementById('leaflet-css-dashboard')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-dashboard';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = window.L;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const center = start ? [start.lat, start.lng] : [31.7917, -7.0926];
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView(center, 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

    const points = [];
    const makeIcon = (color) => L.divIcon({
      className: '',
      html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px ${color}"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5],
    });

    if (start && start.lat && start.lng) {
      L.marker([start.lat, start.lng], { icon: makeIcon('#c51717') }).addTo(mapInstance.current);
      points.push([start.lat, start.lng]);
    }

    if (end && end.lat && end.lng) {
      L.marker([end.lat, end.lng], { icon: makeIcon('#555') }).addTo(mapInstance.current);
      points.push([end.lat, end.lng]);
    }

    if (points.length === 2) {
      L.polyline(points, { color: '#c51717', weight: 3, opacity: 0.8 }).addTo(mapInstance.current);
      mapInstance.current.fitBounds(L.latLngBounds(points).pad(0.2));
    }
  }, [leafletLoaded, start, end]);

  return (
    <div className="relative w-full h-24 rounded-lg overflow-hidden border border-gray-100 shadow-inner">
      <div ref={mapRef} id={uniqueId.current} className="w-full h-full" />
      {!leafletLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">
          Chargement de l'aperçu...
        </div>
      )}
    </div>
  );
}

// ── COMPOSANT MODAL DE CARTE AGRANDIE AUTONOME ──────────────────────────────
function AutonomousMapModal({ open, onClose, start, end, title }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    if (!document.getElementById('leaflet-css-dashboard')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css-dashboard';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);
  }, [open]);

  useEffect(() => {
    if (!open || !leafletLoaded || !mapRef.current) return;
    const L = window.L;

    if (mapInstance.current) {
      mapInstance.current.remove();
      mapInstance.current = null;
    }

    const center = start ? [start.lat, start.lng] : [31.7917, -7.0926];
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false
    }).setView(center, 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

    const points = [];
    const makeIcon = (color) => L.divIcon({
      className: '',
      html: `<div style="width:14px;height:14px;border-radius:50%;background:${color};border:2.5px solid #fff;box-shadow:0 0 0 1.5px ${color}"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });

    if (start && start.lat && start.lng) {
      L.marker([start.lat, start.lng], { icon: makeIcon('#c51717') }).bindPopup("Départ").addTo(mapInstance.current);
      points.push([start.lat, start.lng]);
    }

    if (end && end.lat && end.lng) {
      L.marker([end.lat, end.lng], { icon: makeIcon('#555') }).bindPopup("Destination").addTo(mapInstance.current);
      points.push([end.lat, end.lng]);
    }

    if (points.length === 2) {
      L.polyline(points, { color: '#c51717', weight: 4, opacity: 0.85 }).addTo(mapInstance.current);
      mapInstance.current.fitBounds(L.latLngBounds(points).pad(0.2));
    }
  }, [leafletLoaded, open, start, end]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-gray-100 flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wider">{title || 'Aperçu du trajet'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-lg">×</button>
        </div>
        <div className="flex-1 min-h-[350px] relative">
          <div ref={mapRef} className="w-full h-full min-h-[350px]" />
          {!leafletLoaded && (
            <div className="absolute inset-0 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
              Chargement de la carte...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── COMPOSANT DASHBOARD PRINCIPAL ───────────────────────────────────────────
const TABS = {
  passager: ['reservations', 'chat'],
  conducteur: ['mes_trajets', 'publier', 'chat'],
};

function Dashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const tabs = TABS[user?.role] || TABS['passager'];
  const [activeTab, setActiveTab] = useState(tabs[0]);

  // Data states
  const [reservations, setReservations] = useState([]);
  const [historique, setHistorique] = useState([]);
  const [mesTrajets, setMesTrajets] = useState([]);
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [mapModalData, setMapModalData] = useState({ start: null, end: null, title: '' });
  const [loadingData, setLoadingData] = useState(false);

  // MESSAGERIE CENTRALISÉE
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const chatEndRef = useRef(null);

  // ÉTATS DES FONCTIONNALITÉS GEMINI ✨
  const [generatingDesc, setGeneratingDesc] = useState(false);
  const [generatingIcebreakers, setGeneratingIcebreakers] = useState(false);
  const [icebreakers, setIcebreakers] = useState([]);

  // ÉTATS DE DIALOGUES & MODAUX DE CONFIRMATION PERSONNALISÉS (Pas de window.confirm ou d'alert)
  const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '', type: 'info' });
  const [confirmModal, setConfirmModal] = useState({ open: false, title: '', message: '', onConfirm: null });

  // MODAL AVIS CONDUCTEUR
  const [avisModal, setAvisModal] = useState({ open: false, reservation: null });
  const [avisNote, setAvisNote] = useState(0);
  const [avisCommentaire, setAvisCommentaire] = useState('');
  const [avisDejaEnvoyes, setAvisDejaEnvoyes] = useState(new Set()); // IDs des réservations déjà notées
  const [submittingAvis, setSubmittingAvis] = useState(false);
  const [form, setForm] = useState({
    depart: '', arrivee: '', date_heure: '', prix: '', places_total: '', description: ''
  });
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState('');
  const [publishError, setPublishError] = useState('');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  const showAlert = (title, message, type = 'info') => {
    setAlertModal({ open: true, title, message, type });
  };

  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({ open: true, title, message, onConfirm });
  };

  // 🤖 GÉNÉRATION DE LA DESCRIPTION DU TRAJET PAR GEMINI API ✨
  const generateDescWithAI = async () => {
    if (!form.depart || !form.arrivee) {
      showAlert("Oups !", "Veuillez remplir au moins la ville de départ et de destination avant d'utiliser l'IA.", "warning");
      return;
    }
    setGeneratingDesc(true);
    const systemPrompt = "Tu es un assistant virtuel de voyage de l'application de covoiturage marocaine TRIKI.COV. Ton but est d'écrire une description sympathique et attractive pour un trajet.";
    const userPrompt = `Rédige une description de covoiturage chaleureuse et engageante en français de 3 à 4 phrases pour un voyage de ${form.depart} à ${form.arrivee}. Mentionne la courtoisie, le confort, le prix abordable (${form.prix || 'raisonnable'} MAD) et propose de s'accorder sur les bagages et la playlist durant le trajet. Utilise un ton accueillant typique de l'hospitalité marocaine.`;
    
    try {
      const generatedText = await callGemini(userPrompt, systemPrompt);
      setForm(prev => ({ ...prev, description: generatedText.trim() }));
      showAlert("Succès ✨", "Votre description de trajet premium a été générée avec succès par l'IA !", "success");
    } catch (err) {
      showAlert("Erreur IA", "Impossible de générer la description automatique pour le moment. Vous pouvez l'écrire manuellement.", "error");
    } finally {
      setGeneratingDesc(false);
    }
  };

  // 🤖 GÉNÉRATION DE QUESTIONS BRISE-GLACE PAR GEMINI API ✨
  const generateIcebreakersWithAI = async () => {
    if (!activeThread) return;
    setGeneratingIcebreakers(true);
    setIcebreakers([]);
    const systemPrompt = "Tu es un coach social spécialisé dans les interactions amicales de covoiturage au Maroc.";
    const userPrompt = `Donne-moi 3 idées de phrases simples, amicales et amusantes (mélange de français et de Darija marocaine légère) pour briser la glace entre un chauffeur et un passager voyageant de ${activeThread.depart} à ${activeThread.arrivee}. Renvoie uniquement les 3 propositions séparées par des retours à la ligne, sans introduction ni numérotation compliquée.`;

    try {
      const result = await callGemini(userPrompt, systemPrompt);
      const list = result.split('\n').map(item => item.replace(/^[-\*\d\.\s]+/, '').trim()).filter(item => item.length > 0);
      setIcebreakers(list);
    } catch (err) {
      showAlert("Désolé", "Impossible de générer des suggestions brise-glace pour le moment.", "error");
    } finally {
      setGeneratingIcebreakers(false);
    }
  };

  // Chargement des données selon l'onglet actif
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    if (activeTab === 'reservations') {
      setLoadingData(true);
      Promise.all([
        API.get('/reservations/mes-reservations'),
        API.get('/reservations/historique').catch(() => ({ data: { data: [] } })),
      ])
        .then(([resActives, resHisto]) => {
          // [TRIKI.COV NETTOYAGE] : MySQL retourne date_heure sans 'Z' (ex: "2026-07-01T10:00:00")
          // → JavaScript l'interprète comme heure locale au lieu de UTC, ce qui fausse la comparaison.
          // On force le parsing UTC en ajoutant 'Z' si absent, puis on compare correctement.
          const now = new Date();
          const toDate = (str) => {
            if (!str) return new Date(0);
            return new Date(str.includes('Z') || str.includes('+') ? str : str.replace(' ', 'T') + 'Z');
          };
          const futures = (resActives.data.data || []).filter(r => toDate(r.date_heure) > now);
          setReservations(futures);
          setHistorique(resHisto.data.data || []);
        })
        .catch(console.error)
        .finally(() => setLoadingData(false));
    }

    if (activeTab === 'mes_trajets') {
      setLoadingData(true);
      API.get('/trajets?page=1&limit=20')
        .then(res => {
          const all = res.data.data || [];
          setMesTrajets(all.filter(t => t.conducteur_id === user.id));
        })
        .catch(console.error)
        .finally(() => setLoadingData(false));
    }

    if (activeTab === 'chat') {
      loadChatThreads();
    }
  }, [activeTab]);

  // Génération automatique des discussions basées sur les réservations
  const loadChatThreads = async () => {
    setLoadingData(true);
    try {
      let mergedList = [];

      // 1. Charger les réservations en tant que passager
      try {
        const resPassager = await API.get('/reservations/mes-reservations');
        mergedList = [...(resPassager.data?.data || resPassager.data || [])];
      } catch (err) {
        console.error("Erreur passager threads:", err);
      }

      // 2. Si conducteur, charger aussi les réservations reçues sur ses propres trajets
      // [CORRECTION TRIKI.COV] : la route GET /reservations n'existait pas (404 systématique).
      // → utilisation de la route correcte /reservations/recues
      if (user?.role === 'conducteur') {
        try {
          const resRecues = await API.get('/reservations/recues');
          const allData = resRecues.data?.data || resRecues.data || [];
          allData.forEach(r => {
            if (!mergedList.some(existing => existing.id === r.id)) {
              mergedList.push(r);
            }
          });
        } catch (err) {
          console.log("Impossible de charger les réservations reçues", err);
        }
      }

      const activeThreads = mergedList.map(r => {
        const isDriver = user.id === r.conducteur_id;
        const interlocuteurNom = isDriver
          ? `${r.passager_prenom || ''} ${r.passager_nom || 'Passager'}`
          : `${r.conducteur_prenom || ''} ${r.conducteur_nom || 'Conducteur'}`;
        // [AJOUT TRIKI.COV] : ID du destinataire, nécessaire pour POST /chat/envoyer
        const interlocuteurId = isDriver ? r.passager_id : r.conducteur_id;

        return {
          id: r.id,
          trajet_id: r.trajet_id,
          depart: r.depart,
          arrivee: r.arrivee,
          date_heure: r.date_heure,
          interlocuteur: interlocuteurNom,
          interlocuteur_id: interlocuteurId,
          statut: r.statut
        };
      });

      setThreads(activeThreads);
      if (activeThreads.length > 0 && !activeThread) {
        setActiveThread(activeThreads[0]);
      }
    } catch (err) {
      console.error("Erreur globale lors de la génération des fils de discussion :", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Charger les messages du fil de discussion actif
  const loadChatMessages = async (thread) => {
    if (!thread) return;
    try {
      // [CORRECTION TRIKI.COV] : seule route réelle = GET /api/chat/:trajet_id
      const res = await API.get(`/chat/${thread.trajet_id}`);
      setChatMessages(res.data?.data || res.data || []);
    } catch (err) {
      console.error("Impossible de charger les messages depuis /chat", err);
    }
  };

  // Effet pour recharger les messages et scroller vers le bas
  useEffect(() => {
    if (activeThread && activeTab === 'chat') {
      setLoadingChat(true);
      loadChatMessages(activeThread).finally(() => setLoadingChat(false));
      setIcebreakers([]); // Reset des suggestions brise-glace

      const interval = setInterval(() => {
        loadChatMessages(activeThread);
      }, 4000);

      return () => clearInterval(interval);
    }
  }, [activeThread, activeTab]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeThread || sendingMessage) return;

    if (!activeThread.interlocuteur_id) {
      showAlert("Erreur", "Destinataire introuvable pour cette discussion. Impossible d'envoyer le message.", "error");
      return;
    }

    setSendingMessage(true);

    // [CORRECTION TRIKI.COV] : la route réelle est POST /api/chat/envoyer
    // (le chatController attend trajet_id, destinataire_id, message)
    const payload = {
      trajet_id: activeThread.trajet_id,
      destinataire_id: activeThread.interlocuteur_id,
      message: newMessage,
    };

    try {
      await API.post('/chat/envoyer', payload);
      setNewMessage('');
      await loadChatMessages(activeThread);
    } catch (err) {
      console.error("Erreur d'envoi du message :", err);
      showAlert("Erreur", err.response?.data?.message || "Le message n'a pas pu être envoyé. Veuillez vérifier la connexion au serveur backend.", "error");
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    setPublishing(true);
    setPublishMsg('');
    setPublishError('');
    try {
      // [AJOUT TRIKI.COV] : résolution des coordonnées à partir des noms de villes
      // pour que la carte du trajet (Home) puisse afficher l'itinéraire.
      const departCoords  = geocodeVille(form.depart);
      const arriveeCoords = geocodeVille(form.arrivee);
      const payload = {
        ...form,
        lat_depart:  departCoords?.lat  ?? null,
        lng_depart:  departCoords?.lng  ?? null,
        lat_arrivee: arriveeCoords?.lat ?? null,
        lng_arrivee: arriveeCoords?.lng ?? null,
      };
      await API.post('/trajets', payload);
      setPublishMsg('✅ Trajet publié avec succès !');
      setForm({ depart: '', arrivee: '', date_heure: '', prix: '', places_total: '', description: '' });
    } catch (err) {
      setPublishError(err.response?.data?.message || 'Erreur lors de la publication.');
    } finally {
      setPublishing(false);
    }
  };

  const handleCancelTrajet = async (id) => {
    showConfirm(
      "Annuler le trajet ?",
      "Êtes-vous sûr de vouloir annuler ce trajet ? Tous les passagers inscrits seront automatiquement informés de l'annulation.",
      async () => {
        try {
          await API.delete(`/trajets/${id}`);
          setMesTrajets(prev => prev.filter(t => t.id !== id));
          showAlert("Succès", "Votre trajet a été annulé avec succès.", "success");
        } catch (err) {
          showAlert("Erreur", err.response?.data?.message || "Erreur lors de l'annulation.", "error");
        }
      }
    );
  };

  const handleCancelReservation = async (id) => {
    showConfirm(
      "Annuler la réservation ?",
      "Souhaitez-vous vraiment annuler votre réservation pour ce trajet ?",
      async () => {
        try {
          await API.delete(`/reservations/${id}`);
          setReservations(prev => prev.filter(r => r.id !== id));
          showAlert("Annulation validée", "Votre réservation a été annulée.", "success");
        } catch (err) {
          showAlert("Erreur", err.response?.data?.message || "Impossible d'annuler la réservation.", "error");
        }
      }
    );
  };

  // [AJOUT TRIKI.COV] : soumission d'un avis sur le conducteur après trajet terminé
  const handleSubmitAvis = async () => {
    if (!avisNote || avisNote < 1) {
      showAlert("Note manquante", "Veuillez choisir une note entre 1 et 5 étoiles.", "error");
      return;
    }
    setSubmittingAvis(true);
    try {
      await API.post(`/reservations/${avisModal.reservation.id}/avis`, {
        note: avisNote,
        commentaire: avisCommentaire.trim() || undefined,
      });
      setAvisDejaEnvoyes(prev => new Set([...prev, avisModal.reservation.id]));
      setAvisModal({ open: false, reservation: null });
      setAvisNote(0);
      setAvisCommentaire('');
      showAlert("Merci !", "Votre avis a été envoyé avec succès.", "success");
    } catch (err) {
      showAlert("Erreur", err.response?.data?.message || "Impossible d'envoyer l'avis.", "error");
    } finally {
      setSubmittingAvis(false);
    }
  };

  const tabLabels = {
    reservations: '🎟️ Mes réservations',
    mes_trajets: '🚗 Mes trajets',
    publier: '➕ Publier un trajet',
    chat: '💬 Messages',
  };

  const statusColor = {
    confirme: 'bg-green-100 text-green-700',
    en_attente: 'bg-yellow-100 text-yellow-700',
    annule: 'bg-triki-50 text-triki-600',
    actif: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center shrink-0">
        <Link to="/" className="text-2xl font-black text-triki">TRIKI<span className="text-gray-800">.COV</span></Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 font-medium">
            👋 {user?.prenom} {user?.nom}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${
              user?.role === 'conducteur' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
            }`}>{user?.role}</span>
          </span>
          <button onClick={logout} className="text-sm text-triki hover:text-triki-600 font-medium">
            Déconnexion
          </button>
        </div>
      </nav>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 py-8 flex-1 w-full flex flex-col min-h-0">
        <h1 className="text-2xl font-bold text-gray-800 mb-6 shrink-0">Mon espace</h1>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap shrink-0">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab !== 'chat') {
                  setActiveThread(null);
                  setChatMessages([]);
                }
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-triki text-white shadow-sm'
                  : 'bg-white text-gray-600 border hover:border-triki-400 hover:text-triki'
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="flex-1 min-h-0">
          {/* RESERVATIONS */}
          {activeTab === 'reservations' && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg">Mes réservations</h2>
              {loadingData && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-triki-600"></div></div>}
              {!loadingData && reservations.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Aucune réservation pour le moment.
                  <br />
                  <Link to="/" className="mt-3 inline-block text-triki font-semibold hover:underline">Trouver un trajet →</Link>
                </div>
              )}
              {reservations.map(r => (
                <div key={r.id} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex gap-4 items-start w-full md:w-auto flex-1">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-lg">{r.depart} → {r.arrivee}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(r.date_heure).toLocaleString('fr-FR')} — Conducteur : {r.conducteur_prenom} {r.conducteur_nom}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">{r.nb_places} place(s) — {r.montant_total} MAD</div>
                    </div>
                    {/* Intégration de la mini-carte autonome */}
                    {(r.lat_depart || r.lat_arrivee) && (
                      <div className="w-48 ml-2 shrink-0 hidden sm:block">
                        <AutonomousMap
                          start={r.lat_depart && r.lng_depart ? { lat: Number(r.lat_depart), lng: Number(r.lng_depart) } : null}
                          end={r.lat_arrivee && r.lng_arrivee ? { lat: Number(r.lat_arrivee), lng: Number(r.lng_arrivee) } : null}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => { setMapModalData({ start: r.lat_depart && r.lng_depart ? { lat: Number(r.lat_depart), lng: Number(r.lng_depart) } : null, end: r.lat_arrivee && r.lng_arrivee ? { lat: Number(r.lat_arrivee), lng: Number(r.lng_arrivee) } : null, title: `${r.depart} → ${r.arrivee}` }); setMapModalOpen(true); }}
                              className="text-xs px-2 py-1 bg-triki text-white rounded-lg hover:bg-triki-600"
                          >Agrandir</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[r.statut] || 'bg-gray-100 text-gray-600'}`}>
                      {r.statut}
                    </span>
                    {r.statut !== 'annule' && (
                      <button
                        onClick={() => handleCancelReservation(r.id)}
                        className="text-xs text-triki hover:text-triki-600 font-semibold border border-triki-200 px-3 py-1 rounded-lg hover:bg-triki-50 transition"
                      >
                        Annuler
                      </button>
                    )}
                    
                    {/* Raccourci vers le chat unifié */}
                    <button
                      onClick={() => {
                        setActiveThread({
                          id: r.id,
                          trajet_id: r.trajet_id,
                          depart: r.depart,
                          arrivee: r.arrivee,
                          date_heure: r.date_heure,
                          interlocuteur: `${r.conducteur_prenom || ''} ${r.conducteur_nom || 'Conducteur'}`,
                          statut: r.statut
                        });
                        setActiveTab('chat');
                      }}
                      className="text-xs text-white bg-triki hover:bg-triki-600 font-semibold px-3 py-1 rounded-lg transition"
                    >
                      💬 Chat
                    </button>
                    <Link to={`/trajets/${r.trajet_id}`} className="text-xs text-triki font-semibold hover:underline">Voir trajet</Link>
                  </div>
                </div>
              ))}

              {/* [AJOUT TRIKI.COV] : Section historique — trajets passés + notation conducteur */}
              {historique.length > 0 && (
                <div className="mt-8">
                  <h3 className="font-semibold text-gray-500 text-sm uppercase tracking-wide mb-3 border-t pt-4">
                    📋 Trajets effectués
                  </h3>
                  <div className="space-y-3">
                    {historique.map(r => (
                      <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 opacity-80">
                        <div className="flex-1">
                          <div className="font-semibold text-gray-700">{r.depart} → {r.arrivee}</div>
                          <div className="text-xs text-gray-400 mt-0.5">
                            {new Date(r.date_heure).toLocaleString('fr-FR')} — {r.conducteur_prenom} {r.conducteur_nom}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5">{r.nb_places} place(s) — {r.montant_total} MAD</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">Terminé</span>
                          {avisDejaEnvoyes.has(r.id) ? (
                            <span className="text-xs text-green-600 font-semibold">✓ Avis envoyé</span>
                          ) : (
                            <button
                              onClick={() => {
                                setAvisModal({ open: true, reservation: r });
                                setAvisNote(0);
                                setAvisCommentaire('');
                              }}
                              className="text-xs px-3 py-1 bg-amber-500 text-white rounded-lg hover:bg-amber-600 font-semibold transition"
                            >
                              ⭐ Noter le conducteur
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MES TRAJETS (conducteur) */}
          {activeTab === 'mes_trajets' && (
            <div className="space-y-4">
              <h2 className="font-bold text-gray-700 text-lg">Mes trajets publiés</h2>
              {loadingData && <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>}
              {!loadingData && mesTrajets.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  Aucun trajet publié.
                  <br />
                  <button onClick={() => setActiveTab('publier')} className="mt-3 inline-block text-triki font-semibold hover:underline">
                    Publier mon premier trajet →
                  </button>
                </div>
              )}
              {mesTrajets.map(t => (
                <div key={t.id} className="bg-white p-5 rounded-xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="flex gap-4 items-start w-full md:w-auto flex-1">
                    <div className="flex-1">
                      <div className="font-bold text-gray-800 text-lg">{t.depart} → {t.arrivee}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {new Date(t.date_heure).toLocaleString('fr-FR')}
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        {t.prix} MAD — {t.places_disponibles}/{t.places_total} place(s) libre(s)
                      </div>
                    </div>
                    {/* Intégration de la mini-carte autonome */}
                    {(t.lat_depart || t.lat_arrivee) && (
                      <div className="w-48 ml-2 shrink-0 hidden sm:block">
                        <AutonomousMap
                          start={t.lat_depart && t.lng_depart ? { lat: Number(t.lat_depart), lng: Number(t.lng_depart) } : null}
                          end={t.lat_arrivee && t.lng_arrivee ? { lat: Number(t.lat_arrivee), lng: Number(t.lng_arrivee) } : null}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={() => { setMapModalData({ start: t.lat_depart && t.lng_depart ? { lat: Number(t.lat_depart), lng: Number(t.lng_depart) } : null, end: t.lat_arrivee && t.lng_arrivee ? { lat: Number(t.lat_arrivee), lng: Number(t.lng_arrivee) } : null, title: `${t.depart} → ${t.arrivee}` }); setMapModalOpen(true); }}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          >Agrandir</button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[t.statut] || 'bg-gray-100 text-gray-600'}`}>
                      {t.statut}
                    </span>
                    {t.statut === 'actif' && (
                      <button
                        onClick={() => handleCancelTrajet(t.id)}
                        className="text-xs text-triki hover:text-triki-600 font-semibold border border-triki-200 px-3 py-1 rounded-lg hover:bg-triki-50 transition"
                      >
                        Annuler
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PUBLIER UN TRAJET */}
          {activeTab === 'publier' && (
            <div className="max-w-lg">
              <h2 className="font-bold text-gray-700 text-lg mb-4">Publier un nouveau trajet</h2>
              {publishMsg && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-800 rounded-lg text-sm">{publishMsg}</div>}
              {publishError && <div className="mb-4 p-3 bg-triki-50 border border-triki-200 text-triki-600 rounded-lg text-sm">{publishError}</div>} 
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <form onSubmit={handlePublish} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">Ville de départ</label>
                      <input type="text" value={form.depart} onChange={e => setForm({...form, depart: e.target.value})} required
                        placeholder="Ex: Casablanca" list="villes-depart-dashboard"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                      <datalist id="villes-depart-dashboard">
                        {VILLES_MAROC.map((v, i) => <option key={i} value={v} />)}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">Ville d'arrivée</label>
                      <input type="text" value={form.arrivee} onChange={e => setForm({...form, arrivee: e.target.value})} required
                        placeholder="Ex: Marrakech" list="villes-arrivee-dashboard"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                      <datalist id="villes-arrivee-dashboard">
                        {VILLES_MAROC.map((v, i) => <option key={i} value={v} />)}
                      </datalist>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-600 mb-1">Date et heure de départ</label>
                    <input type="datetime-local" value={form.date_heure} onChange={e => setForm({...form, date_heure: e.target.value})} required
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">Prix par place (MAD)</label>
                      <input type="number" min="1" value={form.prix} onChange={e => setForm({...form, prix: e.target.value})} required
                        placeholder="Ex: 80"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre de places</label>
                      <input type="number" min="1" max="8" value={form.places_total} onChange={e => setForm({...form, places_total: e.target.value})} required
                        placeholder="Ex: 3"
                        className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-sm font-semibold text-gray-600">Description (optionnel)</label>
                      {/* BOUTON GEMINI POUR GÉNÉRER LA DESCRIPTION ✨ */}
                      <button
                        type="button"
                        onClick={generateDescWithAI}
                        disabled={generatingDesc}
                        className="text-xs bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-700 hover:to-amber-700 text-white font-bold px-2.5 py-1 rounded-full shadow-sm transition flex items-center gap-1 disabled:opacity-50"
                      >
                        {generatingDesc ? 'Génération... ✨' : 'Générer avec IA ✨'}
                      </button>
                    </div>
                    <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                      rows={3} placeholder="Bagages autorisés, animaux, point de rendez-vous..."
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none resize-none" />
                  </div>
                  <button type="submit" disabled={publishing}
                    className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-60">
                    {publishing ? 'Publication en cours...' : 'Publier le trajet'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* CHAT CENTRALISÉ (Avec intégration des suggestions Gemini) */}
          {activeTab === 'chat' && (
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-[280px_1fr] h-[550px]">
              
              {/* Volet de gauche : Liste des discussions actives */}
              <div className="border-r border-gray-200 flex flex-col h-full bg-gray-50/50">
                <div className="p-4 border-b border-gray-100 bg-white">
                  <h3 className="font-bold text-gray-800 text-sm">Discussions de voyage</h3>
                  <p className="text-[10px] text-gray-400 mt-0.5">Automatique depuis vos réservations</p>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                  {loadingData && threads.length === 0 ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-triki"></div></div>
                  ) : threads.length === 0 ? (
                    <div className="p-6 text-center text-xs text-gray-400">
                      Aucune discussion disponible. Réservez un trajet pour commencer à chatter !
                    </div>
                  ) : (
                    threads.map(thread => (
                      <div
                        key={thread.id}
                        onClick={() => setActiveThread(thread)}
                        className={`p-4 cursor-pointer text-left transition-all ${
                          activeThread?.id === thread.id 
                            ? 'bg-triki-50 border-l-4 border-triki' 
                            : 'hover:bg-white bg-transparent'
                        }`}
                      >
                        <p className="text-xs font-bold text-gray-800 truncate">{thread.depart} ➔ {thread.arrivee}</p>
                        <p className="text-[11px] text-gray-500 font-semibold mt-1">Interlocuteur : {thread.interlocuteur}</p>
                        <div className="flex justify-between items-center mt-2 text-[10px] text-gray-400">
                          <span>{new Date(thread.date_heure).toLocaleDateString('fr-FR')}</span>
                          <span className={`px-1.5 py-0.5 rounded-full font-bold uppercase text-[8px] ${
                            thread.statut === 'confirme' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {thread.statut}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Volet de droite : Fenêtre de discussion */}
              <div className="flex flex-col h-full bg-white overflow-hidden">
                {activeThread ? (
                  <>
                    {/* Header du Chat */}
                    <div className="p-4 bg-gray-50/30 border-b border-gray-100 flex justify-between items-center shrink-0">
                      <div className="text-left">
                        <h4 className="text-xs font-black text-triki uppercase tracking-wider">
                          {activeThread.depart} ➔ {activeThread.arrivee}
                        </h4>
                        <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
                          En discussion avec : {activeThread.interlocuteur}
                        </p>
                      </div>
                      <button 
                        onClick={() => loadChatMessages(activeThread)}
                        className="text-xs text-triki hover:underline font-bold"
                      >
                        Rafraîchir
                      </button>
                    </div>

                    {/* Zone des suggestions de brise-glace Gemini ✨ */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-red-50 to-amber-50 border-b border-red-100 flex flex-col gap-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-red-800 uppercase tracking-wider flex items-center gap-1">
                          💡 Besoin d'idées pour lancer la conversation ?
                        </span>
                        <button
                          onClick={generateIcebreakersWithAI}
                          disabled={generatingIcebreakers}
                          className="text-[9px] bg-red-600 hover:bg-red-700 text-white font-bold px-2 py-0.5 rounded-full transition"
                        >
                          {generatingIcebreakers ? 'Génération... ✨' : 'Suggérer des Brise-Glace ✨'}
                        </button>
                      </div>

                      {icebreakers.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {icebreakers.map((ice, index) => (
                            <button
                              key={index}
                              onClick={() => setNewMessage(ice)}
                              className="text-[10px] text-gray-700 bg-white border border-red-200/60 hover:bg-red-100/50 px-2.5 py-1 rounded-xl transition text-left leading-tight max-w-full truncate"
                              title="Cliquez pour insérer ce message"
                            >
                              💬 "{ice}"
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Zone des messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/20">
                      {loadingChat && chatMessages.length === 0 ? (
                        <div className="text-center py-10 text-xs text-gray-400">Chargement de la conversation...</div>
                      ) : chatMessages.length === 0 ? (
                        <div className="text-center py-16 text-xs text-gray-400">
                          Aucun message dans ce fil. Envoyez votre premier message pour lancer la discussion ! 👋
                        </div>
                      ) : (
                        chatMessages.map((msg, index) => {
                          const isMe = msg.expediteur_id === user.id || msg.sender_id === user.id;
                          const senderName = msg.expediteur_prenom || msg.prenom || (isMe ? 'Moi' : 'Interlocuteur');
                          const messageText = getMessageText(msg);
                          const timeStr = getMessageTime(msg);

                          return (
                            <div key={index} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                              <span className="text-[9px] text-gray-400 font-bold mb-0.5">{senderName}</span>
                              <div
                                className={`max-w-[75%] p-3 rounded-2xl text-xs font-semibold leading-relaxed ${
                                  isMe 
                                    ? 'bg-triki text-white rounded-tr-none' 
                                    : 'bg-white text-gray-800 border rounded-tl-none shadow-sm'
                                }`}
                              >
                                {messageText}
                              </div>
                              {timeStr && (
                                <span className="text-[8px] text-gray-300 mt-1">
                                  {timeStr}
                                </span>
                              )}
                            </div>
                          );
                        })
                      )}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Formulaire d'envoi */}
                    <form onSubmit={handleSendChat} className="p-3 bg-white border-t border-gray-100 flex gap-2 shrink-0">
                      <input
                        type="text"
                        placeholder="Tapez votre message ici..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        className="flex-1 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:bg-white focus:border-triki"
                      />
                      <button
                        type="submit"
                        disabled={sendingMessage || !newMessage.trim()}
                        className="bg-triki hover:bg-triki-600 disabled:opacity-40 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition"
                      >
                        {sendingMessage ? 'Envoi...' : 'Envoyer'}
                      </button>
                    </form>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50/20">
                    <div className="text-5xl mb-4">💬</div>
                    <p className="font-bold text-gray-700 text-sm mb-1">Sélectionnez une discussion de voyage</p>
                    <p className="text-xs text-gray-400 max-w-sm leading-relaxed">
                      Vos fils de chat sont générés automatiquement depuis vos trajets actifs de réservation sur TRIKI.COV. Cliquez sur un trajet à gauche pour commencer à discuter.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <AutonomousMapModal open={mapModalOpen} onClose={() => setMapModalOpen(false)} start={mapModalData.start} end={mapModalData.end} title={mapModalData.title} />

      {/* ── MODAL D'ALERTE PERSONNALISÉ (Remplacement de alert) ── */}
      {alertModal.open && (
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 text-center animate-scale-up">
            <div className="text-4xl mb-3">
              {alertModal.type === 'success' ? '✅' : alertModal.type === 'warning' ? '⚠️' : alertModal.type === 'error' ? '❌' : 'ℹ️'}
            </div>
            <h3 className="text-lg font-black text-gray-800 mb-2">{alertModal.title}</h3>
            <p className="text-xs text-gray-500 mb-5 leading-relaxed">{alertModal.message}</p>
            <button
              onClick={() => setAlertModal({ ...alertModal, open: false })}
              className="w-full bg-gray-300 hover:bg-gray-500 text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              D'accord
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMATION PERSONNALISÉ (Remplacement de confirm) ── */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/60 z-[99999] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl border border-gray-100 text-left animate-scale-up">
            <h3 className="text-lg font-black text-gray-800 mb-2">{confirmModal.title}</h3>
            <p className="text-xs text-gray-500 mb-6 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  setConfirmModal({ ...confirmModal, open: false });
                }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [AJOUT TRIKI.COV] : Modal avis conducteur */}
      {avisModal.open && avisModal.reservation && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-black text-gray-800 mb-1">⭐ Noter le conducteur</h3>
            <p className="text-xs text-gray-500 mb-4">
              {avisModal.reservation.conducteur_prenom} {avisModal.reservation.conducteur_nom} —{' '}
              {avisModal.reservation.depart} → {avisModal.reservation.arrivee}
            </p>

            {/* Étoiles interactives */}
            <div className="flex gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setAvisNote(star)}
                  className={`text-3xl transition-transform hover:scale-110 ${star <= avisNote ? 'text-amber-400' : 'text-gray-300'}`}
                >
                  ★
                </button>
              ))}
            </div>
            {avisNote > 0 && (
              <p className="text-center text-xs text-gray-500 mb-3">
                {['', 'Très mauvais', 'Mauvais', 'Correct', 'Bien', 'Excellent !'][avisNote]}
              </p>
            )}

            <textarea
              value={avisCommentaire}
              onChange={e => setAvisCommentaire(e.target.value)}
              placeholder="Un commentaire (optionnel)..."
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={() => setAvisModal({ open: false, reservation: null })}
                className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-xs hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                onClick={handleSubmitAvis}
                disabled={submittingAvis || !avisNote}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                {submittingAvis ? 'Envoi...' : 'Envoyer mon avis'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;