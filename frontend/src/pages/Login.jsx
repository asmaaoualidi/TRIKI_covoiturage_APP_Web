// src/pages/Login.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import API from '../api';

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await API.post('/auth/login', { email, mot_de_passe: password });
      if (response.data.success) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        // التوجيه على حسب الـ Role
        if (response.data.user.role === 'admin') navigate('/admin');
        else navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Identifiants incorrects');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-md p-8 bg-white rounded-2xl shadow-xl">
        <h2 className="text-3xl font-bold text-center text-triki mb-6">Connexion</h2>
        {error && <div className="p-3 mb-4 text-sm text-triki-600 bg-triki-50 rounded-lg">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-600">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full px-4 py-2 mt-1 border rounded-lg focus:ring-2 focus:ring-triki-400 focus:outline-none" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-600">Mot de passe</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full px-4 py-2 mt-1 border rounded-lg focus:ring-2 focus:ring-triki-400 focus:outline-none" />
          </div>
          <button type="submit" className="w-full py-2 text-white bg-triki rounded-lg font-bold hover:bg-triki-600 transition">
            Se connecter
          </button>
        </form>
        <p className="mt-4 text-sm text-center text-gray-500">
          Pas encore de compte ? <Link to="/register" className="text-triki font-semibold hover:underline">S'inscrire</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;