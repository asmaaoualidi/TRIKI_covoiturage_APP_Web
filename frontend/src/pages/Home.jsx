// src/pages/Home.jsx — TRIKI.COV
// Redesign : layout moderne minimaliste, stats réelles depuis /api/analytics,
// carte Leaflet chargée dynamiquement par CDN (sans dépendance bundler) avec vraies routes OSRM

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';

// ── Configuration API autonome pour éviter les erreurs d'import relatif ──────
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
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
    if (!res.ok) throw new Error(`Erreur HTTP: status ${res.status}`);
    const data = await res.json();
    return { data };
  }
};

// ── Liste des Villes Marocaines pour l'Autocomplete ────────────────────────────
const VILLES_MAROC = [
  "Casablanca", "Rabat", "Marrakech", "Fès", "Tanger", 
  "Agadir", "Meknès", "Oujda", "Kenitra", "Tétouan", 
  "Safi", "Mohammedia", "Khouribga", "El Jadida", "Nador"
];

async function fetchOsrmRoute(from, to) {
  const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    if (!data.routes?.[0]) return null;
    const route   = data.routes[0];
    const coords  = route.geometry.coordinates.map(c => [c[1], c[0]]);
    const distKm  = Math.round(route.distance / 1000);
    const durMin  = Math.round(route.duration / 60);
    const hrs     = Math.floor(durMin / 60);
    const mins    = durMin % 60;
    const durStr  = hrs > 0 ? `${hrs}h${mins > 0 ? mins + 'min' : ''}` : `${mins} min`;
    return { coords, distKm, durStr };
  } catch {
    return null;
  }
}

// ── Composant Cartographique Autonome (Chargé via CDN) ───────────────────────
// Affiche TOUS les trajets de la recherche en cours, chacun avec un repère
// qui montre son heure de départ. Le trajet sélectionné (clic sur la carte
// ou sur la liste) est mis en évidence et son itinéraire détaillé (OSRM)
// est tracé.
const fmtHeure = (d) => new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

function TrajetMap({ trajets = [], selectedTrajet, onSelect }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const listMarkersRef = useRef([]);
  const routeLayerRef = useRef({ markers: [], polyline: null });
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);

  // Chargement asynchrone de Leaflet CSS et JS
  useEffect(() => {
    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Ajout du CSS Leaflet
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Ajout du JS Leaflet
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setLeafletLoaded(true);
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  // ── Effet 1 : un repère "heure de départ" pour chaque trajet de la liste ──
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;
    const L = window.L;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([31.7917, -7.0926], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);
    }

    const map = mapInstance.current;

    // Nettoyage des anciens repères
    listMarkersRef.current.forEach(marker => map.removeLayer(marker));
    listMarkersRef.current = [];

    const withCoords = trajets.filter(t => t.lat_depart && t.lng_depart);
    const points = [];

    withCoords.forEach(t => {
      const isSelected = selectedTrajet?.id === t.id;
      const color = isSelected ? '#c51717' : '#9ca3af';
      const heure = fmtHeure(t.date_heure);

      const icon = L.divIcon({
        className: '',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;cursor:pointer;${isSelected ? 'transform:scale(1.15)' : ''}">
            <div style="background:${color};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:9px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.35)">${heure}</div>
            <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:7px solid ${color};margin-top:-1px"></div>
          </div>`,
        iconSize: [56, 34],
        iconAnchor: [28, 34],
      });

      const pos = [Number(t.lat_depart), Number(t.lng_depart)];
      const marker = L.marker(pos, { icon, zIndexOffset: isSelected ? 1000 : 0 })
        .bindPopup(`<strong style="color:#c51717">${t.depart} → ${t.arrivee}</strong><br/><span style="font-size:11px">Départ à ${heure} · ${t.prix} MAD</span>`)
        .on('click', () => onSelect && onSelect(t))
        .addTo(map);

      listMarkersRef.current.push(marker);
      points.push(pos);
    });

    // Tant qu'aucun trajet n'est sélectionné, on cadre la vue sur tous les repères affichés
    if (!selectedTrajet) {
      if (points.length > 0) {
        map.fitBounds(L.latLngBounds(points).pad(0.25));
      } else {
        map.setView([31.7917, -7.0926], 6);
      }
    }
  }, [leafletLoaded, trajets, selectedTrajet, onSelect]);

  // ── Effet 2 : itinéraire détaillé (OSRM) du trajet sélectionné ───────────
  const hasCoords = selectedTrajet?.lat_depart && selectedTrajet?.lng_depart
    && selectedTrajet?.lat_arrivee && selectedTrajet?.lng_arrivee;

  useEffect(() => {
    if (!leafletLoaded || !mapInstance.current) return;
    const L = window.L;
    const map = mapInstance.current;

    if (routeLayerRef.current.polyline) {
      map.removeLayer(routeLayerRef.current.polyline);
      routeLayerRef.current.polyline = null;
    }
    routeLayerRef.current.markers.forEach(m => map.removeLayer(m));
    routeLayerRef.current.markers = [];

    if (!hasCoords) {
      setRouteInfo(null);
      return;
    }

    const from = [Number(selectedTrajet.lat_depart), Number(selectedTrajet.lng_depart)];
    const to   = [Number(selectedTrajet.lat_arrivee), Number(selectedTrajet.lng_arrivee)];

    const endIcon = L.divIcon({
      className: '',
      html: `<div style="width:13px;height:13px;border-radius:50%;background:#555;border:2.5px solid #fff;box-shadow:0 0 0 1.5px #555"></div>`,
      iconSize: [13, 13],
      iconAnchor: [6.5, 6.5],
    });
    const endMarker = L.marker(to, { icon: endIcon })
      .bindPopup(`<strong>${selectedTrajet.arrivee}</strong><br /><span style="font-size: 11px">Destination</span>`)
      .addTo(map);
    routeLayerRef.current.markers.push(endMarker);

    setLoading(true);
    fetchOsrmRoute(from, to).then(result => {
      const coords = result ? result.coords : [from, to];
      routeLayerRef.current.polyline = L.polyline(coords, { color: '#c51717', weight: 4, opacity: 0.85 }).addTo(map);
      setRouteInfo(result ? { distKm: result.distKm, durStr: result.durStr } : null);
      map.fitBounds(L.latLngBounds(coords).pad(0.18));
      setLoading(false);
    });
  }, [leafletLoaded, selectedTrajet?.id, hasCoords]);

  const visibleCount = trajets.filter(t => t.lat_depart && t.lng_depart).length;

  return (
    <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
      <div ref={mapRef} className="w-full h-full min-h-[400px]" />

      {!leafletLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <span className="text-sm text-gray-400">Chargement de la carte...</span>
        </div>
      )}

      {selectedTrajet ? (
        <div className="absolute top-3 left-3 z-[1000] bg-white rounded-xl px-3 py-2 shadow border border-gray-100 max-w-[200px]">
          <p className="text-[10px] text-gray-400 font-medium">Trajet sélectionné</p>
          <p className="text-xs font-semibold text-gray-800 truncate">
            {selectedTrajet.depart} → {selectedTrajet.arrivee}
          </p>
        </div>
      ) : visibleCount > 0 && (
        <div className="absolute top-3 left-3 z-[1000] bg-white rounded-xl px-3 py-2 shadow border border-gray-100 max-w-[220px]">
          <p className="text-xs font-semibold text-gray-800">{visibleCount} trajet{visibleCount > 1 ? 's' : ''} affiché{visibleCount > 1 ? 's' : ''}</p>
          <p className="text-[10px] text-gray-400">Cliquez sur une heure pour voir l'itinéraire</p>
        </div>
      )}

      {routeInfo && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white rounded-xl px-3 py-2 shadow border border-gray-100">
          <p className="text-xs font-semibold" style={{ color: '#c51717' }}>
            {routeInfo.distKm} km · {routeInfo.durStr}
          </p>
          <p className="text-[10px] text-gray-400">via route nationale</p>
        </div>
      )}

      {loading && (
        <div className="absolute bottom-3 left-3 z-[1000] bg-white rounded-xl px-3 py-2 shadow border border-gray-100">
          <p className="text-[10px] text-gray-400">Calcul de la route...</p>
        </div>
      )}
    </div>
  );
}

function TrajetCard({ trajet, onSelect, isSelected }) {
  const date    = new Date(trajet.date_heure);
  const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      onClick={() => onSelect(trajet)}
      className="group cursor-pointer bg-white rounded-2xl border-2 p-4 transition-all duration-200 hover:shadow-md"
      style={{ borderColor: isSelected ? '#c51717' : '#db8e8e' }}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          {/* Badge de date avec contraste optimal */}
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[#fdecea] text-[#9b1212] border border-[#f5c4c4]/40">{dateStr}</span>
          <span className="text-xs text-gray-400">{timeStr}</span>
        </div>
        <div className="text-right">
          <span className="text-xl font-black text-gray-900">{trajet.prix}</span>
          <span className="text-xs text-gray-400 ml-1">MAD</span>
        </div>
      </div>

      <div className="flex items-center gap-2 my-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#c51717' }} />
          <div className="w-0.5 h-5 bg-gray-200" />
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <span className="text-sm font-bold text-gray-800 truncate">{trajet.depart}</span>
          <span className="text-sm font-semibold text-gray-500 truncate">{trajet.arrivee}</span>
        </div>
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: '#c51717' }}>
            {(trajet.conducteur_prenom?.[0] || '?').toUpperCase()}
          </div>
          <span className="text-xs text-gray-500">
            {trajet.conducteur_prenom} {trajet.conducteur_nom}
            {trajet.note_moyenne ? (
              <span className="ml-1 text-yellow-500">★ {Number(trajet.note_moyenne).toFixed(1)}</span>
            ) : null}
          </span>
        </div>
        <span
          className="text-xs font-bold px-2 py-0.5 rounded-full"
          style={{
            background: trajet.places_disponibles <= 1 ? '#d8c7aa' : '#cd7b72',
            color: trajet.places_disponibles <= 1 ? '#e65100' : '#9b1212',
          }}
        >
          {trajet.places_disponibles} place{trajet.places_disponibles > 1 ? 's' : ''}
        </span>
      </div>

      {/* Bouton Réserver visible en permanence avec texte noir lisible */}
      <Link
        to={`/trajets/${trajet.id}`}
        onClick={e => e.stopPropagation()}
        className="mt-3 block w-full text-center py-2.5 rounded-xl text-sm font-bold text-black transition-all bg-[#c51717] hover:bg-[#a41313] hover:text-white"
      >
        Réserver →
      </Link>
    </div>
  );
}

function Home() {
  const navigate = useNavigate();
  const [depart,        setDepart]        = useState('');
  const [arrivee,       setArrivee]       = useState('');
  const [date,          setDate]          = useState('');
  const [trajets,       setTrajets]       = useState([]);
  const [selectedTrajet,setSelectedTrajet]= useState(null);
  const [loadingTrajets,setLoadingTrajets]= useState(false);
  const [error,         setError]         = useState('');
  const [stats,         setStats]         = useState(null);
  const [loadingStats,  setLoadingStats]  = useState(true);

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  useEffect(() => {
    API.get('/analytics/public')
      .then(res => setStats(res.data.data || null))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, []);

  const fetchTrajets = useCallback(async (params = {}) => {
    setLoadingTrajets(true);
    setError('');
    try {
      const res  = await API.get('/trajets', { params });
      const data = res.data.data || res.data.trajets || res.data || [];
      setTrajets(data);
      // Pas de présélection : la carte affiche d'abord TOUS les trajets
      // trouvés (avec leur heure de départ), l'utilisateur choisit ensuite.
      setSelectedTrajet(null);
    } catch (err) {
      const message = err?.message || 'Impossible de charger les trajets.';
      setError(`Impossible de charger les trajets. ${message}`);
    } finally {
      setLoadingTrajets(false);
    }
  }, []);

  useEffect(() => { 
    fetchTrajets(); 
  }, [fetchTrajets]);

  const handleSearch = e => {
    e.preventDefault();
    const params = {};
    if (depart)  params.depart  = depart;
    if (arrivee) params.arrivee = arrivee;
    if (date)    params.date    = date;
    fetchTrajets(params);
  };

  const fmt = n => n == null ? '—' : Number(n).toLocaleString('fr-FR');
  const activeTrips = loadingStats ? '…' : fmt(stats?.total_trajets_actifs || stats?.trajets_actifs );
  const usersCount  = loadingStats ? '…' : fmt(stats?.total_utilisateurs || stats?.utilisateurs );
  const rating      = loadingStats ? '…' : fmt(stats?.note_moyenne || stats?.note );
  return (
    <div className="min-h-screen flex flex-col bg-app">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 flex flex-col gap-4 lg:flex-row items-start lg:items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl font-black tracking-tight" style={{ color: '#c51717' }}>TRIKI</span>
          <span className="text-xl font-black text-gray-800 tracking-tight">.COV</span>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
          <Link to="/" className="font-semibold text-gray-800 hover:text-gray-700">Trajets</Link>
          <a href="#comment" className="hover:text-gray-700">Comment ça marche</a>
          {user ? (
            <Link to="/dashboard" className="inline-flex px-4 py-2 rounded-full bg-[#c51717] text-white font-semibold hover:bg-[#a41313]">
              Mon espace
            </Link>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex px-4 py-2 rounded-full border border-gray-200 text-gray-700 hover:bg-gray-50">Connexion</Link>
              <Link to="/register" className="inline-flex px-4 py-2 rounded-full bg-[#c51717] text-white font-semibold hover:bg-[#a41313]">S'inscrire</Link>
            </>
          )}
        </div>
      </nav>

      <main className="flex-1 px-4 py-8 max-w-7xl mx-auto w-full">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-[32px] bg-white p-7 shadow-sm border border-gray-100">
            <span className="inline-flex items-center gap-2 rounded-full bg-[#fdecea] px-4 py-2 text-xs font-semibold text-[#9b1212] mb-5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c51717]" />
              Covoiturage au Maroc
            </span>

            <div className="space-y-5">
              <div>
                <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-gray-800 leading-tight">
                  Voyagez <span className="text-[#c51717]">plus intelligemment</span>, ensemble.
                </h1>
                <p className="mt-4 max-w-xl text-sm text-gray-500">
                  Trouvez ou proposez un trajet en quelques secondes. Simple, économique et écologique.
                </p>
              </div>

              <div className="rounded-[28px] bg-[#f8fafc] p-5 border border-gray-100">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
                      Départ
                      <input
                        type="text"
                        placeholder="Casablanca"
                        value={depart}
                        onChange={e => setDepart(e.target.value)}
                        list="villes-depart"
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#c51717] focus:ring-2 focus:ring-[#c51717]/20"
                      />
                      <datalist id="villes-depart">
                        {VILLES_MAROC.map((ville, idx) => (
                          <option key={idx} value={ville} />
                        ))}
                      </datalist>
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
                      Arrivée
                      <input
                        type="text"
                        placeholder="Marrakech"
                        value={arrivee}
                        onChange={e => setArrivee(e.target.value)}
                        list="villes-arrivee"
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#c51717] focus:ring-2 focus:ring-[#c51717]/20"
                      />
                      <datalist id="villes-arrivee">
                        {VILLES_MAROC.map((ville, idx) => (
                          <option key={idx} value={ville} />
                        ))}
                      </datalist>
                    </label>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-xs font-semibold uppercase tracking-[0.15em] text-gray-400">
                      Date
                      <input
                        type="date"
                        value={date}
                        onChange={e => setDate(e.target.value)}
                        className="mt-2 w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-800 outline-none focus:border-[#c51717] focus:ring-2 focus:ring-[#c51717]/20"
                      />
                    </label>
                    <button
                      type="submit"
                      className="mt-2 w-full rounded-2xl bg-[#c51717] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#a41313]"
                    >
                      Rechercher un trajet
                    </button>
                  </div>
                </form>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500">Trajets actifs</p>
                  <p className="mt-3 text-2xl font-black text-gray-800">{activeTrips}</p>
                </div>
                <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500">Utilisateurs</p>
                  <p className="mt-3 text-2xl font-black text-gray-800">{usersCount}</p>
                </div>
                <div className="rounded-3xl bg-white p-5 border border-gray-100 shadow-sm">
                  <p className="text-sm text-gray-500">Satisfaction</p>
                  <p className="mt-3 text-2xl font-black text-gray-800">{rating} ★</p>
                </div>
              </div>

              <div id="comment" className="grid gap-4 sm:grid-cols-3 mt-6">
                <div className="rounded-3xl bg-[#f8fafc] p-5 border border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Paiement sécurisé</p>
                  <p className="mt-2 text-sm text-gray-500">Stripe ou espèces — choisissez selon vos préférences.</p>
                </div>
                <div className="rounded-3xl bg-[#f8fafc] p-5 border border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Messagerie intégrée</p>
                  <p className="mt-2 text-sm text-gray-500">Communiquez directement avec conducteurs et passagers.</p>
                </div>
                <div className="rounded-3xl bg-[#f8fafc] p-5 border border-gray-100">
                  <p className="text-sm font-semibold text-gray-800">Assistant IA</p>
                  <p className="mt-2 text-sm text-gray-500">Un chatbot disponible 24/7 pour un trajet en toute sérénité.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[32px] overflow-hidden bg-white shadow-sm border border-gray-100">
              <TrajetMap trajets={trajets} selectedTrajet={selectedTrajet} onSelect={setSelectedTrajet} />
            </div>

            <div className="rounded-[32px] bg-white p-6 border border-gray-100 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-black text-gray-800">Trajets disponibles</h2>
                  {!loadingTrajets && !error && (
                    <p className="text-sm text-gray-500">{trajets.length} trajet{trajets.length > 1 ? 's' : ''} trouvé{trajets.length > 1 ? 's' : ''}</p>
                  )}
                </div>
                {user?.role === 'conducteur' && (
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center rounded-full bg-[#c51717] px-5 py-2 text-sm font-bold text-white hover:bg-[#a41313]"
                  >
                    + Publier
                  </Link>
                )}
              </div>

              {loadingTrajets && (
                <div className="rounded-3xl bg-[#f8fafc] p-10 text-center border border-gray-100">
                  <div className="inline-flex h-10 w-10 animate-spin rounded-full border-4 border-[#c51717]/25 border-t-[#c51717]"></div>
                </div>
              )}

              {error && (
                <div className="rounded-3xl bg-[#fdecea] p-6 text-center text-sm text-[#9b1212] border border-[#f5c4c4]">
                  {error}
                </div>
              )}

              {!loadingTrajets && !error && trajets.length === 0 && (
                <div className="rounded-3xl bg-white p-10 text-center border border-gray-100">
                  <div className="text-5xl mb-3">🚗</div>
                  <p className="text-gray-500 font-medium">Aucun trajet trouvé.</p>
                  <p className="text-sm text-gray-400 mt-1">Essayez une autre recherche !</p>
                </div>
              )}

              <div className="grid gap-4">
                {!loadingTrajets && trajets.map(trajet => (
                  <TrajetCard
                    key={trajet.id}
                    trajet={trajet}
                    onSelect={setSelectedTrajet}
                    isSelected={selectedTrajet?.id === trajet.id}
                  />
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        © {new Date().getFullYear()} TRIKI.COV — Covoiturage au Maroc. 
      </footer>
    </div>
  );
}

export default Home;