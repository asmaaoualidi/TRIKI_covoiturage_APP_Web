-- ============================================
-- PLATEFORME DE COVOITURAGE - MySQL Schema
-- Dagdag & Oualidi - PFA
-- ============================================

CREATE DATABASE IF NOT EXISTS covoiturage_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE covoiturage_db;

-- ============================================
-- TABLE: utilisateurs
-- ============================================
CREATE TABLE utilisateurs (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    nom           VARCHAR(100)        NOT NULL,
    prenom        VARCHAR(100)        NOT NULL,
    email         VARCHAR(150)        NOT NULL UNIQUE,
    mot_de_passe  VARCHAR(255)        NOT NULL,          -- bcrypt hash
    telephone     VARCHAR(20),
    photo_profil  VARCHAR(255),                          -- chemin vers l'image
    role          ENUM('conducteur', 'passager', 'admin') NOT NULL DEFAULT 'passager',
    note_moyenne  DECIMAL(3,2)        DEFAULT 0.00,
    created_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP           DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================
-- TABLE: vehicules
-- ============================================
CREATE TABLE vehicules (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id  INT          NOT NULL,
    modele          VARCHAR(100) NOT NULL,
    immatriculation VARCHAR(20)  NOT NULL UNIQUE,
    couleur         VARCHAR(50),
    nb_places       INT          NOT NULL DEFAULT 4,
    created_at      TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_vehicule_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE
);

-- ============================================
-- TABLE: trajets
-- ============================================
CREATE TABLE trajets (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    conducteur_id       INT             NOT NULL,
    vehicule_id         INT,
    depart              VARCHAR(150)    NOT NULL,
    arrivee             VARCHAR(150)    NOT NULL,
    date_heure          DATETIME        NOT NULL,
    prix                DECIMAL(8,2)    NOT NULL,
    places_total        INT             NOT NULL,
    places_disponibles  INT             NOT NULL,
    statut              ENUM('actif', 'annule', 'termine') DEFAULT 'actif',
    description         TEXT,
    created_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_trajet_conducteur
        FOREIGN KEY (conducteur_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_trajet_vehicule
        FOREIGN KEY (vehicule_id) REFERENCES vehicules(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_places
        CHECK (places_disponibles >= 0 AND places_disponibles <= places_total)
);

-- ============================================
-- TABLE: reservations
-- ============================================
CREATE TABLE reservations (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    passager_id   INT         NOT NULL,
    trajet_id     INT         NOT NULL,
    nb_places     INT         NOT NULL DEFAULT 1,
    statut        ENUM('en_attente', 'confirme', 'annule') DEFAULT 'en_attente',
    montant_total DECIMAL(8,2),
    created_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    CONSTRAINT fk_reservation_passager
        FOREIGN KEY (passager_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reservation_trajet
        FOREIGN KEY (trajet_id) REFERENCES trajets(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_passager_trajet
        UNIQUE (passager_id, trajet_id)
);

-- ============================================
-- TABLE: avis
-- ============================================
CREATE TABLE avis (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    auteur_id   INT         NOT NULL,
    cible_id    INT         NOT NULL,
    trajet_id   INT,
    commentaire TEXT,
    note        INT         NOT NULL,
    created_at  TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_avis_auteur
        FOREIGN KEY (auteur_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_avis_cible
        FOREIGN KEY (cible_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_avis_trajet
        FOREIGN KEY (trajet_id) REFERENCES trajets(id)
        ON DELETE SET NULL,
    CONSTRAINT chk_note
        CHECK (note BETWEEN 1 AND 5),
    CONSTRAINT uq_avis
        UNIQUE (auteur_id, cible_id, trajet_id)
);

-- ============================================
-- TABLE: messages
-- ============================================
CREATE TABLE messages (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    expediteur_id INT        NOT NULL,
    destinataire_id INT      NOT NULL,
    trajet_id    INT,
    contenu      TEXT        NOT NULL,
    lu           BOOLEAN     DEFAULT FALSE,
    created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_expediteur
        FOREIGN KEY (expediteur_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_message_destinataire
        FOREIGN KEY (destinataire_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_message_trajet
        FOREIGN KEY (trajet_id) REFERENCES trajets(id)
        ON DELETE SET NULL
);

-- ============================================
-- TABLE: notifications
-- ============================================
CREATE TABLE notifications (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    utilisateur_id INT       NOT NULL,
    type         ENUM('reservation_confirmee', 'reservation_annulee', 'nouveau_message', 'nouvel_avis') NOT NULL,
    contenu      TEXT        NOT NULL,
    lu           BOOLEAN     DEFAULT FALSE,
    created_at   TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_notif_utilisateur
        FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id)
        ON DELETE CASCADE
);

-- ============================================
-- TRIGGER: màj places_disponibles après réservation confirmée
-- ============================================
DELIMITER $$

CREATE TRIGGER after_reservation_insert
AFTER INSERT ON reservations
FOR EACH ROW
BEGIN
    IF NEW.statut = 'confirme' THEN
        UPDATE trajets
        SET places_disponibles = places_disponibles - NEW.nb_places
        WHERE id = NEW.trajet_id;
    END IF;
END$$

CREATE TRIGGER after_reservation_update
AFTER UPDATE ON reservations
FOR EACH ROW
BEGIN
    -- Si annulée, on restitue les places
    IF NEW.statut = 'annule' AND OLD.statut = 'confirme' THEN
        UPDATE trajets
        SET places_disponibles = places_disponibles + OLD.nb_places
        WHERE id = NEW.trajet_id;
    END IF;
    -- Si nouvellement confirmée
    IF NEW.statut = 'confirme' AND OLD.statut = 'en_attente' THEN
        UPDATE trajets
        SET places_disponibles = places_disponibles - NEW.nb_places
        WHERE id = NEW.trajet_id;
    END IF;
END$$

-- TRIGGER: màj note_moyenne après un avis
CREATE TRIGGER after_avis_insert
AFTER INSERT ON avis
FOR EACH ROW
BEGIN
    UPDATE utilisateurs
    SET note_moyenne = (
        SELECT AVG(note) FROM avis WHERE cible_id = NEW.cible_id
    )
    WHERE id = NEW.cible_id;
END$$

DELIMITER ;


-- ============================================
-- Ajout colonnes géolocalisation (si pas encore présentes)
-- ============================================
ALTER TABLE trajets ADD COLUMN IF NOT EXISTS lat_depart  DECIMAL(10,7) NULL;
ALTER TABLE trajets ADD COLUMN IF NOT EXISTS lng_depart  DECIMAL(10,7) NULL;
ALTER TABLE trajets ADD COLUMN IF NOT EXISTS lat_arrivee DECIMAL(10,7) NULL;
ALTER TABLE trajets ADD COLUMN IF NOT EXISTS lng_arrivee DECIMAL(10,7) NULL;

-- ============================================
-- INDEX pour les recherches fréquentes
-- ============================================
CREATE INDEX idx_trajet_depart    ON trajets(depart);
CREATE INDEX idx_trajet_arrivee   ON trajets(arrivee);
CREATE INDEX idx_trajet_date      ON trajets(date_heure);
CREATE INDEX idx_trajet_statut    ON trajets(statut);
CREATE INDEX idx_reservation_statut ON reservations(statut);

-- ============================================
-- DONNÉES DE TEST
-- ============================================

-- Admin
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role)
VALUES ('Admin', 'Plateforme', 'admin@covoiturage.ma', '$2b$10$hashedpassword', 'admin');

-- Conducteur test
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role)
VALUES ('Dagdag', 'Youssef', 'youssef@test.ma', '$2b$10$hashedpassword', '0612345678', 'conducteur');

-- Passager test
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, telephone, role)
VALUES ('Oualidi', 'Sara', 'sara@test.ma', '$2b$10$hashedpassword', '0698765432', 'passager');

-- Véhicule test
INSERT INTO vehicules (utilisateur_id, modele, immatriculation, couleur, nb_places)
VALUES (2, 'Dacia Logan', 'A-12345-B', 'Blanc', 4);

-- Trajet test
INSERT INTO trajets (conducteur_id, vehicule_id, depart, arrivee, date_heure, prix, places_total, places_disponibles)
VALUES (2, 1, 'Casablanca', 'Rabat', '2026-06-01 08:00:00', 50.00, 3, 3);