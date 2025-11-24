import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Time formatter
const formatTime = (t) => {
  if (!t) return "No time";
  if (t.toDate) return t.toDate().toLocaleString();
  if (t instanceof Date) return t.toLocaleString();
  try {
    return new Date(t).toLocaleString();
  } catch {
    return "Invalid time";
  }
};

// Marker icons
const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [30, 48],
  iconAnchor: [0, 48],
  popupAnchor: [15, -40],
  shadowSize: [48, 48],
});

const blueIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Safe recenter
function RecenterMap({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (
      coords &&
      typeof coords.latitude === "number" &&
      typeof coords.longitude === "number"
    ) {
      map.flyTo([coords.latitude, coords.longitude], 18);
    }
  }, [coords, map]);

  return null;
}

// Recenter button
function RecenterButton({ coords }) {
  const map = useMap();

  const handleClick = (e) => {
    e.stopPropagation();
    if (
      coords &&
      typeof coords.latitude === "number" &&
      typeof coords.longitude === "number"
    ) {
      map.flyTo([coords.latitude, coords.longitude], map.getZoom());
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: "20px",
        right: "20px",
        zIndex: 1000,
      }}
    >
      <button
        className="btn btn-light"
        onClick={handleClick}
        style={{
          boxShadow: "0 2px 5px rgba(0, 0, 0, 0.3)",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          border: "none",
          background: "#fff",
        }}
      >
        ⟳
      </button>
    </div>
  );
}

function MapView({ alerts, focusCoords, focusedAlertId }) {
  const fallback = { latitude: 14.599512, longitude: 120.984222 }; // Manila
  const [currentPosition, setCurrentPosition] = useState(null);
  const markerRefs = React.useRef({});

  // --- FIXED getLocation ---
  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentPosition(fallback);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setCurrentPosition(coords);
        localStorage.setItem("lastLocation", JSON.stringify(coords));
      },
      (err) => {
        console.warn("GPS Error:", err.message);

        // If user DENIED → DO NOT use invalid coordinates
        if (err.code === 1) {
          setCurrentPosition(fallback);
          return;
        }

        // Try stored coords
        const stored = localStorage.getItem("lastLocation");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.latitude && parsed.longitude) {
              setCurrentPosition(parsed);
              return;
            }
          } catch {}
        }

        // Final fallback
        setCurrentPosition(fallback);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
    );
  }, []);

  // Auto-open popup
  useEffect(() => {
    if (focusedAlertId && markerRefs.current[focusedAlertId]) {
      markerRefs.current[focusedAlertId].openPopup();
    }
  }, [focusedAlertId]);

  // Safe center
  const center =
    currentPosition &&
    typeof currentPosition.latitude === "number" &&
    typeof currentPosition.longitude === "number"
      ? [currentPosition.latitude, currentPosition.longitude]
      : [fallback.latitude, fallback.longitude];

  return (
    <MapContainer center={center} zoom={15} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      <RecenterMap coords={focusCoords || currentPosition} />
      <RecenterButton coords={currentPosition || fallback} />

      {/* RED MARKER — only if valid coords */}
      {currentPosition &&
        typeof currentPosition.latitude === "number" &&
        typeof currentPosition.longitude === "number" && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={redIcon}
          >
            <Popup>
              {currentPosition.latitude === fallback.latitude &&
              currentPosition.longitude === fallback.longitude
                ? "⚠️ Fallback location used (GPS denied)"
                : "📍 You are here"}
              <br />
              ({currentPosition.latitude.toFixed(4)},{" "}
              {currentPosition.longitude.toFixed(4)})
            </Popup>
          </Marker>
        )}

      {/* Alert markers */}
      {alerts.map((alert) => {
        const lat = alert?.coords?.latitude ?? null;
        const lng = alert?.coords?.longitude ?? null;

        if (typeof lat !== "number" || typeof lng !== "number") return null;

        return (
          <Marker
            key={alert.id}
            position={[lat, lng]}
            icon={blueIcon}
            ref={(el) => (markerRefs.current[alert.id] = el)}
          >
            <Popup>
              <strong>{alert.message}</strong> <br />
              From: {alert.user} <br />
              Time: {formatTime(alert.time)} <br />
              Urgency: {alert.urgency_level || "N/A"}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default MapView;
