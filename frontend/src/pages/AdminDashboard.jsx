// src/pages/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import API from '../api';

function StatCard({ label, value, icon, color }) {
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm flex items-center gap-5">
      <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-3xl font-black text-gray-900">{value ?? '—'}</p>
        <p className="text-sm text-gray-500 font-medium mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const [stats, setStats] = useState(null);
  const [trajets, setTrajets] = useState([]);
  const [users, setUsers] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('stats');

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/');
  };

  useEffect(() => {
    if (!user || user.role !== 'admin') {
      navigate('/');
      return;
    }

    const fetchAdminData = async () => {
      try {
        const [statsRes, trajetsRes, usersRes, reservationsRes] = await Promise.all([
          API.get('/analytics'),
          API.get('/admin/trajets?limit=20'),
          API.get('/admin/users?limit=20'),
          API.get('/admin/reservations?limit=20'),
        ]);

        setStats(statsRes.data.data);
        setTrajets(trajetsRes.data.data || []);
        setUsers(usersRes.data.data || []);
        setReservations(reservationsRes.data.data || []);
      } catch (err) {
        console.error('Admin fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminData();
  }, [navigate, user]);

  const handleCancelTrajet = async (id) => {
    if (!window.confirm('Annuler ce trajet ?')) return;
    try {
      await API.delete(`/trajets/${id}`);
      setTrajets(prev => prev.map(t => t.id === id ? { ...t, statut: 'annule' } : t));
    } catch (err) {
      alert(err.response?.data?.message || 'Erreur');
    }
  };

  const statusColor = {
    confirme: 'bg-green-100 text-green-700',
    en_attente: 'bg-yellow-100 text-yellow-700',
    annule: 'bg-triki-50 text-triki-600',
    actif: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-black text-triki">TRIKI<span className="text-gray-800">.COV</span></Link>
        <div className="flex items-center gap-4">
          <span className="text-sm font-semibold text-gray-700">🛡️ Admin — {user?.prenom} {user?.nom}</span>
          <button onClick={logout} className="text-sm text-triki hover:text-triki-600 font-medium">Déconnexion</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Tableau de bord Admin</h1>
            <p className="text-sm text-gray-500 mt-1">Gestion des statistiques, trajets, utilisateurs et réservations.</p>
          </div>
          <div className="flex flex-wrap gap-2 admin-tabs">
            {['stats', 'trajets', 'users', 'reservations'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                  activeTab === tab ? 'bg-triki text-white shadow-sm' : 'bg-white text-gray-800 border border-gray-200 hover:border-triki-400 hover:text-gray-900'
                }`}
              >
                {tab === 'stats'
                  ? '📊 Statistiques'
                  : tab === 'trajets'
                    ? '🚗 Trajets'
                    : tab === 'users'
                      ? '👥 Utilisateurs'
                      : '🎟️ Réservations'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-triki-600" />
          </div>
        ) : (
          <>
            {activeTab === 'stats' && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard label="Utilisateurs inscrits" value={stats?.total_utilisateurs?.toLocaleString()} icon="👥" color="bg-blue-50" />
                  <StatCard label="Trajets actifs" value={stats?.total_trajets_actifs?.toLocaleString()} icon="🚗" color="bg-green-50" />
                  <StatCard label="Chiffre d'affaires (MAD)" value={Number(stats?.chiffre_affaires_mad || 0).toLocaleString('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })} icon="💰" color="bg-yellow-50" />
                </div>

                <div className="bg-white p-6 rounded-2xl border shadow-sm">
                  <h2 className="font-bold text-gray-800 mb-4">Vue d'ensemble</h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    {[
                      { label: 'Utilisateurs', value: stats?.total_utilisateurs || 0, color: 'bg-blue-500' },
                      { label: 'Trajets actifs', value: stats?.total_trajets_actifs || 0, color: 'bg-green-500' },
                    ].map(item => (
                      <div key={item.label} className="space-y-3">
                        <div className="flex justify-between text-sm font-medium text-gray-700">
                          <span>{item.label}</span>
                          <span>{item.value}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          <div className={`${item.color} h-3 rounded-full`} style={{ width: `${Math.min((item.value / Math.max(item.value, 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'trajets' && (
              <div className="space-y-4">
                {trajets.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">Aucun trajet trouvé.</div>
                ) : (
                  <div className="grid gap-4">
                    {trajets.map(t => (
                      <div key={t.id} className="bg-white p-5 rounded-2xl border shadow-sm flex flex-col md:flex-row md:justify-between gap-4">
                        <div>
                          <div className="font-bold text-gray-800">{t.depart} <span className="text-blue-500">→</span> {t.arrivee}</div>
                          <div className="text-xs text-gray-500 mt-2">Conducteur #{t.conducteur_id} — {new Date(t.date_heure).toLocaleDateString('fr-FR')}</div>
                          <div className="text-xs text-gray-600 mt-1">{t.prix} MAD — {t.places_disponibles}/{t.places_total} places — {t.vehicule_modele || 'Véhicule non renseigné'}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full ${statusColor[t.statut] || 'bg-gray-100'}`}>{t.statut}</span>
                          {t.statut === 'actif' && (
                            <button onClick={() => handleCancelTrajet(t.id)} className="text-xs text-triki border border-triki-200 px-3 py-1 rounded-lg hover:bg-triki-50 font-semibold transition">Annuler</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h2 className="font-bold text-gray-800 mb-4">Utilisateurs</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-gray-600">
                    <thead className="border-b text-xs uppercase text-gray-500">
                      <tr>
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Nom</th>
                        <th className="py-3 px-3">Email</th>
                        <th className="py-3 px-3">Téléphone</th>
                        <th className="py-3 px-3">Rôle</th>
                        <th className="py-3 px-3">Inscrit le</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3 font-semibold text-gray-700">{u.id}</td>
                          <td className="py-3 px-3">{u.prenom} {u.nom}</td>
                          <td className="py-3 px-3">{u.email}</td>
                          <td className="py-3 px-3">{u.telephone || '—'}</td>
                          <td className="py-3 px-3 capitalize">{u.role}</td>
                          <td className="py-3 px-3">{new Date(u.created_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'reservations' && (
              <div className="bg-white p-6 rounded-2xl border shadow-sm">
                <h2 className="font-bold text-gray-800 mb-4">Réservations récentes</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm text-gray-600">
                    <thead className="border-b text-xs uppercase text-gray-500">
                      <tr>
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">Passager</th>
                        <th className="py-3 px-3">Trajet</th>
                        <th className="py-3 px-3">Places</th>
                        <th className="py-3 px-3">Montant</th>
                        <th className="py-3 px-3">Statut</th>
                        <th className="py-3 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reservations.map(r => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="py-3 px-3 font-semibold text-gray-700">{r.id}</td>
                          <td className="py-3 px-3">{r.passager_prenom} {r.passager_nom}</td>
                          <td className="py-3 px-3">{r.depart} → {r.arrivee}</td>
                          <td className="py-3 px-3">{r.nb_places}</td>
                          <td className="py-3 px-3">{Number(r.montant_total).toLocaleString('fr-FR', { style: 'currency', currency: 'MAD' })}</td>
                          <td className="py-3 px-3"><span className={`text-xs font-semibold px-2 py-1 rounded-full ${statusColor[r.statut] || 'bg-gray-100'}`}>{r.statut}</span></td>
                          <td className="py-3 px-3">{new Date(r.created_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
