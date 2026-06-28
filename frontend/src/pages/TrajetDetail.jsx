// src/pages/TrajetDetail.jsx
import React, { useState, useEffect } from 'react';
import Map from '../components/Map';
import { useParams, useNavigate, Link } from 'react-router-dom';
import API from '../api';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

// Chargé une seule fois pour toute l'app. Si la clé publique n'est pas
// encore configurée dans frontend/.env, on évite de crasher : le paiement
// par carte affichera simplement un message demandant de la configurer.
const pk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
const stripePromise = pk && pk.startsWith('pk_') ? loadStripe(pk) : Promise.resolve(null);

function TrajetDetail() {
  return (
    <Elements stripe={stripePromise}>
      <TrajetDetailInner />
    </Elements>
  );
}

function TrajetDetailInner() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const stripe = useStripe();
  const elements = useElements();
  const [trajet, setTrajet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nbPlaces, setNbPlaces] = useState(1);
  const [reserving, setReserving] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    API.get(`/trajets/${id}`)
      .then(res => setTrajet(res.data.data))
      .catch(() => setError('Trajet introuvable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleReserve = async () => {
    if (!user) return navigate('/login');

    if (paymentMethod === 'stripe' && !pk) {
      setError("Le paiement par carte n'est pas encore configuré (clé Stripe manquante). Choisissez « Espèces » ou configurez VITE_STRIPE_PUBLISHABLE_KEY.");
      return;
    }
    if (paymentMethod === 'stripe' && (!stripe || !elements)) {
      setError('Le module de paiement se charge encore, réessayez dans un instant.');
      return;
    }

    setReserving(true);
    setError('');
    try {
      const res = await API.post('/reservations', { trajet_id: id, nb_places: nbPlaces, payment_method: paymentMethod });
      const { clientSecret } = res.data.data || {};

      // ── Paiement par carte : on confirme le PaymentIntent avec Stripe.js ──
      if (paymentMethod === 'stripe' && clientSecret) {
        const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: [user.prenom, user.nom].filter(Boolean).join(' ') || undefined,
            },
          },
        });

        if (stripeError) {
          setError(stripeError.message || 'Le paiement a été refusé.');
          return;
        }
        if (paymentIntent?.status !== 'succeeded') {
          setError('Le paiement n’a pas pu être confirmé. Réessayez.');
          return;
        }
      }

      const serverMessage = res.data.message || 'Réservation créée.';
      setSuccess(serverMessage);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la réservation.');
    } finally {
      setReserving(false);
    }
  };

  const handleOpenChat = () => {
    if (!user) return navigate('/login');
    navigate(`/chat/${id}`);
  };

  if (loading) return (
      <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-triki-600"></div>
    </div>
  );

  if (!trajet && error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <p className="text-triki-600 text-lg">{error}</p>
      <Link to="/" className="text-triki hover:underline">← Retour à l'accueil</Link>
    </div>
  );

  if (!trajet) return null;

  const departDate = new Date(trajet.date_heure);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white shadow-sm border-b px-6 py-4 flex justify-between items-center">
        <Link to="/" className="text-2xl font-black text-triki">TRIKI<span className="text-gray-800">.COV</span></Link>
        <div className="space-x-3">
          {user ? (
            <Link to="/dashboard" className="px-4 py-2 text-sm font-semibold text-white bg-triki rounded-lg hover:bg-triki-600 transition">
              Mon espace
            </Link>
          ) : (
            <Link to="/login" className="px-4 py-2 text-sm font-semibold text-white bg-triki rounded-lg hover:bg-triki-600 transition">
              Connexion
            </Link>
          )}
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link to="/" className="text-sm text-triki hover:underline flex items-center gap-1 mb-6">
          ← Retour aux trajets
        </Link>

        {/* Card principale */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
          {/* Header trajet */}
          <div className="bg-gradient-to-r from-triki to-triki-600 p-6 text-white">
            <div className="text-3xl font-extrabold flex items-center gap-4">
              <span>{trajet.depart}</span>
              <span className="text-triki-300 text-2xl">➔</span>
              <span>{trajet.arrivee}</span>
            </div>
            <div className="mt-2 text-triki-100 text-sm">
              {departDate.toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' à '}
              {departDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* Infos trajet */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800 text-lg border-b pb-2">Informations du trajet</h2>
              
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-triki-50 rounded-full flex items-center justify-center text-triki font-bold text-lg">
                  {trajet.conducteur_prenom?.[0]}{trajet.conducteur_nom?.[0]}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{trajet.conducteur_prenom} {trajet.conducteur_nom}</p>
                  <p className="text-xs text-gray-500">Conducteur</p>
                  {trajet.note_moyenne && (
                    <p className="text-xs text-yellow-500 font-semibold">★ {Number(trajet.note_moyenne).toFixed(1)}/5</p>
                  )}
                </div>
              </div>

              {trajet.vehicule_modele && (
                <div className="text-sm text-gray-600">
                  🚗 <span className="font-medium">{trajet.vehicule_modele}</span>
                  {trajet.vehicule_couleur && ` — ${trajet.vehicule_couleur}`}
                </div>
              )}

              <div className="text-sm text-gray-600">
                💺 <span className="font-medium">{trajet.places_disponibles} place(s) disponible(s)</span>
                {trajet.vehicule_places && ` sur ${trajet.vehicule_places}`}
              </div>

              {trajet.description && (
                <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
                  <p className="font-semibold text-gray-800 mb-1">Description</p>
                  <p>{trajet.description}</p>
                </div>
              )}

              {/* Map: affiche si coordonnées disponibles */}
              {(trajet.lat_depart && trajet.lng_depart) || (trajet.lat_arrivee && trajet.lng_arrivee) ? (
                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">Carte</h3>
                  <Map
                    start={trajet.lat_depart && trajet.lng_depart ? { lat: Number(trajet.lat_depart), lng: Number(trajet.lng_depart) } : null}
                    end={trajet.lat_arrivee && trajet.lng_arrivee ? { lat: Number(trajet.lat_arrivee), lng: Number(trajet.lng_arrivee) } : null}
                  />
                </div>
              ) : null}
            </div>

            {/* Section réservation */}
            <div className="space-y-4">
              <h2 className="font-bold text-gray-800 text-lg border-b pb-2">Réserver ce trajet</h2>

              <div className="text-3xl font-black text-gray-900">
                {trajet.prix} <span className="text-base font-semibold text-gray-500">MAD / place</span>
              </div>

              {success ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm font-medium">
                  ✅ {success}
                  <div className="mt-3">
                    <Link to="/dashboard" className="text-triki font-semibold hover:underline">
                      Voir mes réservations →
                    </Link>
                  </div>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="p-3 bg-triki-50 border border-triki-200 rounded-lg text-triki-600 text-sm">{error}</div>
                  )}

                  {trajet.places_disponibles > 0 ? (
                    <>
                      <div>
                        <label className="block text-sm font-semibold text-gray-600 mb-1">Nombre de places</label>
                        <select
                          value={nbPlaces}
                          onChange={e => setNbPlaces(Number(e.target.value))}
                          className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-triki-400 focus:outline-none"
                        >
                          {Array.from({ length: trajet.places_disponibles }, (_, i) => i + 1).map(n => (
                            <option key={n} value={n}>{n} place{n > 1 ? 's' : ''}</option>
                          ))}
                        </select>
                      </div>

                        <div className="bg-triki-50 rounded-lg p-3 text-sm">
                        <div className="flex justify-between font-semibold">
                          <span>Total</span>
                          <span className="text-triki-600 text-lg">{(trajet.prix * nbPlaces).toFixed(2)} MAD</span>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-gray-50 rounded-2xl border border-gray-200">
                        <p className="font-semibold text-gray-700">Méthode de paiement</p>

                        <label className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="stripe"
                            checked={paymentMethod === 'stripe'}
                            onChange={() => setPaymentMethod('stripe')}
                            className="h-4 w-4 text-triki"
                          />
                          <span>
                            Carte bancaire via Stripe
                            <span className="text-xs text-gray-500 block">Paiement en ligne immédiat.</span>
                          </span>
                        </label>

                        {paymentMethod === 'stripe' && (
                          <div className="ml-7">
                            {pk ? (
                              <div className="px-3 py-3 bg-white border rounded-lg">
                                <CardElement
                                  options={{
                                    style: {
                                      base: {
                                        fontSize: '14px',
                                        color: '#1f2937',
                                        '::placeholder': { color: '#9ca3af' },
                                      },
                                      invalid: { color: '#dc2626' },
                                    },
                                  }}
                                />
                              </div>
                            ) : (
                              <p className="text-xs text-orange-600">
                                Clé Stripe non configurée — ajoutez VITE_STRIPE_PUBLISHABLE_KEY dans frontend/.env.
                              </p>
                            )}
                          </div>
                        )}

                        <label className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="cash"
                            checked={paymentMethod === 'cash'}
                            onChange={() => setPaymentMethod('cash')}
                            className="h-4 w-4 text-triki"
                          />
                          <span>
                            Espèces après le service
                            <span className="text-xs text-gray-500 block">Réservez maintenant et payez au conducteur à la fin du trajet.</span>
                          </span>
                        </label>
                      </div>

                      <button
                        onClick={handleReserve}
                        disabled={reserving}
                        className="w-full py-3 bg-triki text-white font-bold rounded-xl hover:bg-triki-600 transition disabled:opacity-60"
                      >
                        {reserving
                          ? 'En cours...'
                          : user
                            ? paymentMethod === 'cash'
                              ? 'Réserver (espèces après service)'
                              : 'Réserver maintenant'
                            : 'Se connecter pour réserver'}
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenChat}
                        className="w-full mt-3 py-3 bg-white text-triki border border-triki-200 font-semibold rounded-xl hover:bg-triki-50 transition"
                      >
                        {user ? 'Contacter le conducteur' : 'Se connecter pour discuter'}
                      </button>
                    </>
                  ) : (
                    <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl text-orange-700 text-sm font-medium text-center">
                      Ce trajet est complet.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TrajetDetail;
