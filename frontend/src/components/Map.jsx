import React, { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, LayersControl, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

// Fix default icon paths for bundlers (Vite)
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// react-leaflet v5 traite les props de MapContainer (dont `center`) comme
// IMMUABLES après le premier rendu : changer `start`/`end` ne déplace plus
// la carte automatiquement. Ce composant interne utilise le hook useMap()
// pour recentrer/ajuster la vue chaque fois que les coordonnées du trajet
// sélectionné changent (= la carte reste synchronisée avec les trajets).
function RecenterMap({ start, end, userLocation }) {
  const map = useMap()

  useEffect(() => {
    if (start && end) {
      const bounds = L.latLngBounds([
        [start.lat, start.lng],
        [end.lat, end.lng],
      ])
      map.fitBounds(bounds, { padding: [40, 40] })
    } else if (start) {
      map.setView([start.lat, start.lng], 12)
    } else if (end) {
      map.setView([end.lat, end.lng], 12)
    } else if (userLocation) {
      map.setView([userLocation.lat, userLocation.lng], 13)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start?.lat, start?.lng, end?.lat, end?.lng, userLocation?.lat, userLocation?.lng])

  return null
}

function Map({ start, end, userLocation, onMapCreated }) {
  const center = userLocation || start || end || { lat: 31.6295, lng: -7.9811 }
  const polyline = start && end ? [[start.lat, start.lng], [end.lat, end.lng]] : null

  return (
    <div className="rounded-lg overflow-hidden h-64">
      <MapContainer
        ref={(map) => { if (map && onMapCreated) onMapCreated(map) }}
        center={[center.lat, center.lng]}
        zoom={10}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <RecenterMap start={start} end={end} userLocation={userLocation} />
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="OpenStreetMap">
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Carto Voyager">
            <TileLayer
              attribution='&copy; CartoDB'
              url="https://cartodb-basemaps-{s}.global.ssl.fastly.net/rastertiles/voyager/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Stamen Terrain">
            <TileLayer
              attribution='Map tiles by Stamen Design'
              url="https://stamen-tiles-{s}.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"
            />
          </LayersControl.BaseLayer>

          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
        </LayersControl>
        {start && (
          <Marker position={[start.lat, start.lng]}>
            <Popup>Départ</Popup>
          </Marker>
        )}
        {end && (
          <Marker position={[end.lat, end.lng]}>
            <Popup>Arrivée</Popup>
          </Marker>
        )}
        {polyline && <Polyline positions={polyline} color="#2563eb" />}
        {userLocation && (
          <Marker position={[userLocation.lat, userLocation.lng]}>
            <Popup>Vous êtes ici</Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}

export default Map
