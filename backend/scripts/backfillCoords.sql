-- backfillCoords.sql — TRIKI.COV
-- À exécuter une seule fois pour corriger les trajets déjà publiés avant le fix
-- du géocodage automatique (lat_depart/lng_depart/lat_arrivee/lng_arrivee étaient NULL).
-- Usage : mysql -u root -p covoiturage_db < backfillCoords.sql

UPDATE trajets SET lat_depart = 33.5731, lng_depart = -7.5898 WHERE LOWER(depart)  = 'casablanca' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 33.5731, lng_arrivee = -7.5898 WHERE LOWER(arrivee) = 'casablanca' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 34.0209, lng_depart = -6.8416 WHERE LOWER(depart)  = 'rabat' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 34.0209, lng_arrivee = -6.8416 WHERE LOWER(arrivee) = 'rabat' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 31.6295, lng_depart = -7.9811 WHERE LOWER(depart)  = 'marrakech' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 31.6295, lng_arrivee = -7.9811 WHERE LOWER(arrivee) = 'marrakech' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 34.0331, lng_depart = -5.0003 WHERE LOWER(depart)  IN ('fès','fes') AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 34.0331, lng_arrivee = -5.0003 WHERE LOWER(arrivee) IN ('fès','fes') AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 35.7595, lng_depart = -5.8340 WHERE LOWER(depart)  = 'tanger' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 35.7595, lng_arrivee = -5.8340 WHERE LOWER(arrivee) = 'tanger' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 30.4278, lng_depart = -9.5981 WHERE LOWER(depart)  = 'agadir' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 30.4278, lng_arrivee = -9.5981 WHERE LOWER(arrivee) = 'agadir' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 33.8935, lng_depart = -5.5547 WHERE LOWER(depart)  IN ('meknès','meknes') AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 33.8935, lng_arrivee = -5.5547 WHERE LOWER(arrivee) IN ('meknès','meknes') AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 34.6814, lng_depart = -1.9086 WHERE LOWER(depart)  = 'oujda' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 34.6814, lng_arrivee = -1.9086 WHERE LOWER(arrivee) = 'oujda' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 34.2610, lng_depart = -6.5802 WHERE LOWER(depart)  IN ('kenitra','kénitra') AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 34.2610, lng_arrivee = -6.5802 WHERE LOWER(arrivee) IN ('kenitra','kénitra') AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 35.5785, lng_depart = -5.3684 WHERE LOWER(depart)  IN ('tétouan','tetouan') AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 35.5785, lng_arrivee = -5.3684 WHERE LOWER(arrivee) IN ('tétouan','tetouan') AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 32.2994, lng_depart = -9.2372 WHERE LOWER(depart)  = 'safi' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 32.2994, lng_arrivee = -9.2372 WHERE LOWER(arrivee) = 'safi' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 33.6861, lng_depart = -7.3829 WHERE LOWER(depart)  = 'mohammedia' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 33.6861, lng_arrivee = -7.3829 WHERE LOWER(arrivee) = 'mohammedia' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 32.8811, lng_depart = -6.9063 WHERE LOWER(depart)  = 'khouribga' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 32.8811, lng_arrivee = -6.9063 WHERE LOWER(arrivee) = 'khouribga' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 33.2316, lng_depart = -8.5007 WHERE LOWER(depart)  = 'el jadida' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 33.2316, lng_arrivee = -8.5007 WHERE LOWER(arrivee) = 'el jadida' AND lat_arrivee IS NULL;

UPDATE trajets SET lat_depart = 35.1681, lng_depart = -2.9287 WHERE LOWER(depart)  = 'nador' AND lat_depart IS NULL;
UPDATE trajets SET lat_arrivee = 35.1681, lng_arrivee = -2.9287 WHERE LOWER(arrivee) = 'nador' AND lat_arrivee IS NULL;
