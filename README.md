# 🚗 TrikiCov — Plateforme de Covoiturage

**TrikiCov** est une application web de covoiturage permettant à des conducteurs de publier des trajets et à des passagers de les rechercher, les réserver et les payer en ligne. Le projet a été réalisé dans le cadre d'un PFA (Projet de Fin d'Année) par **Dagdag & Oualidi**.

---

## 📋 Sommaire

- [Fonctionnalités](#-fonctionnalités)
- [Stack technique](#-stack-technique)
- [Structure du projet](#-structure-du-projet)
- [Prérequis](#-prérequis)
- [Installation](#-installation)
- [Variables d'environnement](#-variables-denvironnement)
- [Lancer le projet](#-lancer-le-projet)
- [Base de données](#-base-de-données)
- [API — Endpoints principaux](#-api--endpoints-principaux)
- [Paiement (Stripe)](#-paiement-stripe)
- [Sécurité](#-sécurité)
- [Auteurs](#-auteurs)

---

## ✨ Fonctionnalités

### 👤 Passager
- Recherche de trajets (ville de départ, d'arrivée, date) avec carte interactive (Leaflet)
- Réservation de places, paiement par **carte (Stripe)** ou **espèces**
- Historique des réservations + statut en temps réel
- Messagerie intégrée avec le conducteur
- Notation et avis sur les conducteurs après un trajet

### 🚙 Conducteur
- Publication de trajets (départ, arrivée, date/heure, prix, nombre de places, véhicule)
- Gestion des passagers et des places disponibles
- Messagerie intégrée avec les passagers
- Suivi des réservations reçues

### 🛠️ Administrateur
- Tableau de bord avec statistiques globales (utilisateurs, trajets, réservations)
- Gestion des utilisateurs et des trajets
- Suivi des litiges / réservations

### 🤖 Chatbot
- Assistant virtuel basé sur une base de connaissances (FAQ) pour guider les utilisateurs (réservation, paiement, annulation, etc.)

---

## 🧰 Stack technique

| Couche | Technologies |
|---|---|
| **Frontend** | React 19 + Vite, React Router DOM, Tailwind CSS, Leaflet (cartes), Axios, Stripe.js / React Stripe.js |
| **Backend** | Node.js, Express (architecture MVC), JWT, bcryptjs, Helmet, Morgan |
| **Base de données** | MySQL (mysql2), 7 tables relationnelles avec contraintes d'intégrité et triggers |
| **Paiement** | Stripe (PaymentIntent + Webhooks) |
| **Cartographie** | Leaflet + OpenStreetMap, routage OSRM |

---

## 📁 Structure du projet

```
project_fixed/
├── backend/
│   ├── config/            # Connexion à la base de données
│   ├── controllers/       # Logique métier (auth, trajets, réservations, admin, chatbot...)
│   ├── middlewares/        # Authentification JWT, autorisation par rôle
│   ├── routes/            # Définition des routes Express
│   ├── scripts/           # Scripts utilitaires (ex. backfill des coordonnées GPS)
│   ├── server.js          # Point d'entrée de l'API
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/    # Composants réutilisables (Map, MapModal, ProtectedRoute...)
│   │   ├── pages/         # Pages (Home, Dashboard, TrajetDetail, Login...)
│   │   └── api.js         # Client Axios configuré
│   ├── package.json
│   └── .env
├── sqlf.sql                # Script de création de la base de données (schéma + données de test)
└── README.md
```

---

## ✅ Prérequis

- [Node.js](https://nodejs.org/) ≥ 18
- [MySQL](https://www.mysql.com/) ≥ 8 (ou MySQL Workbench)
- Un compte [Stripe](https://dashboard.stripe.com/) (mode test suffit)
- [Stripe CLI](https://docs.stripe.com/stripe-cli) (pour tester les webhooks en local)

---

## ⚙️ Installation

### 1. Cloner le projet
```bash
git clone <url-du-repo>
cd project_fixed
```

### 2. Base de données
```bash
mysql -u root -p < sqlf.sql
```
Ce script crée la base `covoiturage_db`, les 7 tables, les contraintes d'intégrité, les triggers, ainsi que quelques données de test (1 admin, 1 conducteur, 1 passager, 1 trajet).

### 3. Backend
```bash
cd backend
npm install
cp .env.example .env
# → renseigner DB_*, JWT_SECRET, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
```

### 4. Frontend
```bash
cd ../frontend
npm install
# → vérifier/compléter le fichier .env (VITE_API_URL, VITE_STRIPE_PUBLISHABLE_KEY)
```

---

## 🔑 Variables d'environnement

### `backend/.env`
| Variable | Description |
|---|---|
| `PORT` | Port du serveur backend (défaut `5000`) |
| `CLIENT_URL` | URL du frontend (pour CORS) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Connexion MySQL |
| `JWT_SECRET` | Clé secrète pour signer les tokens JWT |
| `JWT_EXPIRES_IN` | Durée de validité des tokens (ex. `7d`) |
| `STRIPE_SECRET_KEY` | Clé secrète Stripe (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Clé de signature du webhook (`whsec_...`) |
| `ANTHROPIC_API_KEY` | *(optionnel)* utilisée comme fallback IA pour le chatbot |

### `frontend/.env`
| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de l'API backend (ex. `http://localhost:5000/api`) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Clé publique Stripe (`pk_test_...`) |

---

## ▶️ Lancer le projet

**Terminal 1 — Backend**
```bash
cd backend
npm run dev
```

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

**Terminal 3 — Webhooks Stripe (obligatoire pour confirmer les paiements en local)**
```bash
stripe listen --forward-to localhost:5000/api/reservations/webhook
```

L'application est ensuite accessible sur `http://localhost:5173` (Vite) et l'API sur `http://localhost:5000/api`.

---

## 🗄️ Base de données

Le schéma compte **7 tables** reliées par des clés étrangères :

`utilisateurs` → `vehicules` → `trajets` → `reservations` / `avis` / `messages` / `notifications`

**Principales contraintes d'intégrité :**
- Clés étrangères avec `ON DELETE CASCADE` (ex. suppression d'un utilisateur → suppression de ses véhicules/trajets) ou `ON DELETE SET NULL` (ex. suppression d'un trajet lié à un avis)
- `UNIQUE (passager_id, trajet_id)` → un passager ne peut réserver qu'une fois le même trajet
- `CHECK (places_disponibles >= 0 AND places_disponibles <= places_total)`
- `CHECK (note BETWEEN 1 AND 5)` sur les avis
- Triggers MySQL pour mettre à jour automatiquement `places_disponibles` (après réservation) et `note_moyenne` (après un avis)

---

## 🔌 API — Endpoints principaux

| Méthode | Endpoint | Description | Accès |
|---|---|---|---|
| POST | `/api/auth/register` | Inscription | Public |
| POST | `/api/auth/login` | Connexion | Public |
| GET | `/api/trajets` | Liste/recherche de trajets | Public |
| GET | `/api/trajets/:id` | Détail d'un trajet | Public |
| POST | `/api/trajets` | Publier un trajet | Conducteur/Admin |
| DELETE | `/api/trajets/:id` | Annuler un trajet | Conducteur (propriétaire) |
| POST | `/api/reservations` | Créer une réservation (+ PaymentIntent Stripe) | Authentifié |
| GET | `/api/reservations/mes-reservations` | Réservations du passager connecté | Authentifié |
| GET | `/api/reservations/recues` | Réservations reçues (conducteur) | Authentifié |
| DELETE | `/api/reservations/:id` | Annuler une réservation | Authentifié |
| POST | `/api/reservations/:id/avis` | Laisser un avis | Authentifié |
| POST | `/api/reservations/webhook` | Webhook Stripe (confirmation paiement) | Stripe |
| POST | `/api/trajets/:trajet_id/messages` | Envoyer un message | Authentifié |
| GET | `/api/trajets/:trajet_id/messages` | Lire une discussion | Authentifié |
| POST | `/api/chatbot` | Interroger le chatbot | Public |
| GET | `/api/analytics` | Statistiques globales | Admin |
| GET | `/api/admin/users` `/trajets` `/reservations` | Gestion admin | Admin |

---

## 💳 Paiement (Stripe)

Le paiement par carte utilise **Stripe** :
1. Le backend crée un `PaymentIntent` à la création d'une réservation → renvoie un `clientSecret`.
2. Le frontend confirme le paiement via Stripe.js (`CardElement` + `confirmCardPayment`).
3. Le webhook Stripe (`payment_intent.succeeded` / `payment_intent.payment_failed`) met à jour le statut de la réservation (`en_attente` → `confirme` / `annule`).

**Carte de test :** `4242 4242 4242 4242` — date future, CVC quelconque.

---

## 🔐 Sécurité

- Authentification par **JWT** (token signé, expiration configurable)
- Mots de passe hashés avec **bcryptjs**
- En-têtes HTTP sécurisés via **Helmet**
- Autorisation par rôle (`passager`, `conducteur`, `admin`) sur les routes sensibles
- Validation des montants/paiements côté serveur (jamais côté client)

---

## 👥 Auteurs

Projet réalisé par **Dagdag** & **Oualidi** — PFA 2025/2026.
