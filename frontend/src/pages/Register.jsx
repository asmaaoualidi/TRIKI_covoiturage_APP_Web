// src/pages/Register.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';

function Register() {
  const [formData, setFormData] = useState({ nom: '', prenom: '', email: '', password: '', telephone: '', role: 'passager' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await API.post('/auth/register', {
        nom: formData.nom,
        prenom: formData.prenom,
        email: formData.email,
        mot_de_passe: formData.password,
        telephone: formData.telephone,
        role: formData.role
      });
      navigate('/login');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Erreur lors de l'inscription. Vérifiez que le serveur backend est démarré sur le port 5000.";
      setError(msg);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center text-triki mb-6">Inscription</h2>
        {error && <div className="p-3 mb-4 text-sm text-triki-600 bg-triki-50 rounded-lg">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-600">Nom</label>
              <input type="text" onChange={(e) => setFormData({...formData, nom: e.target.value})} required className="w-full px-3 py-2 border rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-600">Prénom</label>
              <input type="text" onChange={(e) => setFormData({...formData, prenom: e.target.value})} required className="w-full px-3 py-2 border rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600">Email</label>
            <input type="email" onChange={(e) => setFormData({...formData, email: e.target.value})} required className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600">Mot de passe</label>
            <input type="password" onChange={(e) => setFormData({...formData, password: e.target.value})} required className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600">Téléphone</label>
            <input type="text" onChange={(e) => setFormData({...formData, telephone: e.target.value})} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600">Je suis un :</label>
            <select value={formData.role} onChange={(e) => setFormData({...formData, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg bg-white">
              <option value="passager">Passager (Je cherche un trajet)</option>
              <option value="conducteur">Conducteur (Je propose un trajet)</option>
            </select>
          </div>
          <button type="submit" className="w-full py-2 text-white bg-triki rounded-lg font-bold hover:bg-triki-600 transition">
            Créer mon compte
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          Déjà un compte ? <Link to="/login" className="text-triki font-semibold hover:underline">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}

export default Register;