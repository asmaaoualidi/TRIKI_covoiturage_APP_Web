// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import TrajetDetail from './pages/TrajetDetail';
import ChatPage from './pages/ChatPage';
import ProtectedRoute from './components/ProtectedRoute';
import ChatbotWidget from './components/ChatbotWidget';

function App() {
  return (
    <Router>
      <Routes>
        {/* Pages publiques */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/trajets/:id" element={<TrajetDetail />} />

        {/* Dashboard conducteur / passager */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['passager', 'conducteur']}>
            <Dashboard />
          </ProtectedRoute>
        } />

        {/* Chat d'un trajet */}
        <Route path="/chat/:trajet_id" element={
          <ProtectedRoute>
            <ChatPage />
          </ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Chatbot widget flottant (disponible sur toutes les pages) */}
      <ChatbotWidget />
    </Router>
  );
}

export default App;
