import React, { useEffect, useState } from 'react'
import Map from './Map'

function MapModal({ open, onClose, start, end, title }) {
  const [userLocation, setUserLocation] = useState(null)
  const [mapInstance, setMapInstance] = useState(null)

  useEffect(() => {
    if (!open) return
    // Try to get geolocation when modal opens
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setUserLocation(loc)
          // if map instance is ready, fly to user
          if (mapInstance) {
            mapInstance.flyTo([loc.lat, loc.lng], 13)
          }
        },
        (err) => {
          // ignore errors silently; user can still open modal
          console.warn('Geolocation error', err)
        },
        { enableHighAccuracy: true, timeout: 5000 }
      )
    }
  }, [open, mapInstance])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black opacity-50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-[90%] max-w-3xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{title || 'Carte'}</h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (!navigator.geolocation) return alert('Géolocalisation non supportée');
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
                    setUserLocation(loc)
                    if (mapInstance) mapInstance.flyTo([loc.lat, loc.lng], 13)
                  },
                  (err) => alert('Impossible d\'obtenir la position: ' + err.message),
                  { enableHighAccuracy: true }
                )
              }}
              className="text-xs px-2 py-1 bg-triki text-white rounded-lg hover:bg-triki-600"
            >Centrer sur ma position</button>
            <button onClick={onClose} className="text-gray-600 hover:text-gray-800">Fermer</button>
          </div>
        </div>
        <div style={{ height: '60vh' }}>
          <Map start={start} end={end} userLocation={userLocation} onMapCreated={m => setMapInstance(m)} />
        </div>
      </div>
    </div>
  )
}

export default MapModal
