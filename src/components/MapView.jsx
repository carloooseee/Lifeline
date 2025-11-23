import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom red marker icon
const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
const blueIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Helper component to recenter map
function RecenterMap({ coords }) {
  const map = useMap();
  useEffect(() => {
    if (coords) {
      map.setView([coords.latitude, coords.longitude], 15);
    }
  }, [coords, map]);
  return null;
}

function MapView({ alerts }) {
  const fallbackPosition = { latitude: 14.386696, longitude: 120.895081 };
  const [currentPosition, setCurrentPosition] = useState(null);

  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            // ✅ only set state — don’t write to localStorage
            setCurrentPosition(coords);
          },
          (error) => {
            console.warn("Could not get current position:", error.message);
            // ✅ read only
            const stored = localStorage.getItem("lastLocation");
            if (stored) {
              setCurrentPosition(JSON.parse(stored));
            } else {
              setCurrentPosition(fallbackPosition);
            }
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
        );
      } else {
        const stored = localStorage.getItem("lastLocation");
        if (stored) {
          setCurrentPosition(JSON.parse(stored));
        } else {
          setCurrentPosition(fallbackPosition);
        }
      }
    };

    getLocation();
  }, []);

  const defaultCenter = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : [14.5995, 120.9842]; // Manila fallback while loading

  return (
    <MapContainer
      center={defaultCenter}
      zoom={25}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Recenter map when location changes */}
      {currentPosition && <RecenterMap coords={currentPosition} />}

      {/* Red pin for current or fallback location */}
      {currentPosition && (
        <Marker
          position={[currentPosition.latitude, currentPosition.longitude]}
          icon={redIcon}
        >
          <Popup>
            📍 You are here <br />
            ({currentPosition.latitude.toFixed(4)},{" "}
            {currentPosition.longitude.toFixed(4)})
          </Popup>
        </Marker>
      )}

      {/* Show pins from alerts */}
      {alerts.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.coords.latitude, alert.coords.longitude]}
          icon={blueIcon}
        >
          <Popup>
            <strong>{alert.message}</strong> <br />
            From: {alert.user} <br />
            Time: {alert.time ? alert.time.toLocaleString() : "No time"} <br />
            Urgency Level: {alert.urgency_level || "Not available"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapView;
