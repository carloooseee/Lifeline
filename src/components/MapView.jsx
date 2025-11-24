import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const formatTime = (t) => {
  if (!t) return "No time";

  // Firestore Timestamp
  if (t.toDate) return t.toDate().toLocaleString();

  // JS Date
  if (t instanceof Date) return t.toLocaleString();

  // ISO string fallback
  try {
    return new Date(t).toLocaleString();
  } catch {
    return "Invalid time";
  }
};

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [30, 48],
  iconAnchor: [0, 48],
  popupAnchor: [15, -40],
  shadowSize: [48, 48],
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

function RecenterMap({ coords }) {
  const map = useMap();

  useEffect(() => {
    if (coords && coords.latitude && coords.longitude) {
      map.flyTo([coords.latitude, coords.longitude], 18);
    }
  }, [coords, map]);

  return null;
}

function RecenterButton({ currentPosition }) {
  const map = useMap();

  const handleRecenter = (e) => {
    e.stopPropagation();
    if (currentPosition) {
      map.flyTo([currentPosition.latitude, currentPosition.longitude], map.getZoom());
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
        onClick={handleRecenter}
        className="btn btn-light"
        style={{
          boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
          borderRadius: "50%",
          width: "40px",
          height: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          backgroundColor: "white",
          cursor: "pointer",
        }}
        title="Recenter to my location"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          fill="currentColor"
          viewBox="0 0 16 16"
          style={{ color: "#333" }}
        >
          <path d="M8 16s6-5.686 6-10A6 6 0 0 0 2 6c0 4.314 6 10 6 10zm0-7a3 3 0 1 1 0-6 3 3 0 0 1 0 6z" />
        </svg>
      </button>
    </div>
  );
}

function MapView({ alerts, focusCoords, focusedAlertId }) {
  const fallbackPosition = { latitude: 14.386696, longitude: 120.895081 };
  const [currentPosition, setCurrentPosition] = useState(null);
  const markerRefs = React.useRef({});

  useEffect(() => {
    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setCurrentPosition(coords);

            // Save silently
            localStorage.setItem("lastLocation", JSON.stringify(coords));
          },
          (error) => {
            console.warn("Could not get current position:", error.message);

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

  useEffect(() => {
    if (focusedAlertId && markerRefs.current[focusedAlertId]) {
      const marker = markerRefs.current[focusedAlertId];
      marker.openPopup();
    }
  }, [focusedAlertId]);

  const defaultCenter = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : [14.5995, 120.9842];

  return (
    <MapContainer
      center={defaultCenter}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {/* Auto recenter */}
      {(focusCoords || currentPosition) && (
        <RecenterMap coords={focusCoords || currentPosition} />
      )}

      {/* Manual recenter button */}
      <RecenterButton currentPosition={currentPosition || fallbackPosition} />

      {/* Red marker for current position */}
      {currentPosition && (
        <Marker
          position={[currentPosition.latitude, currentPosition.longitude]}
          icon={redIcon}
          zIndexOffset={10000}
        >
          <Popup>
            📍 You are here <br />
            ({currentPosition.latitude.toFixed(4)},{" "}
            {currentPosition.longitude.toFixed(4)})
          </Popup>
        </Marker>
      )}

      {/* Alert markers */}
      {alerts.map((alert) => {
        const lat =
          alert?.coords?.latitude ??
          alert?.coords?.lat ??
          null;

        const lng =
          alert?.coords?.longitude ??
          alert?.coords?.lng ??
          null;

        if (typeof lat !== "number" || typeof lng !== "number") {
          console.warn("Skipping invalid alert marker:", alert);
          return null;
        }

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
              Urgency Level: {alert.urgency_level || "Not available"}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default MapView;
