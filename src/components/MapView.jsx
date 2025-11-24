import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const redIcon = new L.Icon({
  iconUrl:
    "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [30, 48],
  iconAnchor: [15, 48],
  popupAnchor: [0, -40],
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
    if (coords?.latitude && coords?.longitude) {
      map.flyTo([coords.latitude, coords.longitude], 18);
    }
  }, [coords, map]);

  return null;
}

function RecenterButton({ currentPosition }) {
  const map = useMap();

  const handleRecenter = () => {
    if (currentPosition) {
      map.flyTo(
        [currentPosition.latitude, currentPosition.longitude],
        map.getZoom()
      );
    } else {
      alert("Location unavailable — please enable Location Permission.");
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
          width="22"
          height="22"
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
  const [currentPosition, setCurrentPosition] = useState(null);
  const [locationError, setLocationError] = useState(false);

  const markerRefs = useRef({});

  useEffect(() => {
    const getLocation = () => {
      if (!navigator.geolocation) {
        setLocationError("Geolocation not supported.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentPosition({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setLocationError(false);
        },
        (err) => {
          console.warn("User denied location:", err.message);
          setLocationError(true);
          setCurrentPosition(null);
          alert(
            "Lifeline cannot access your location. Please enable Location Permission in your browser settings."
          );
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    };

    getLocation();
  }, []);

  useEffect(() => {
    if (focusedAlertId && markerRefs.current[focusedAlertId]) {
      markerRefs.current[focusedAlertId].openPopup();
    }
  }, [focusedAlertId]);

  const defaultCenter = focusCoords
    ? [focusCoords.latitude, focusCoords.longitude]
    : currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : [14.5995, 120.9842]; // Manila — safe neutral center

  return (
    <MapContainer
      center={defaultCenter}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="© OpenStreetMap contributors"
      />

      {/* Recenter on selected alert or my location */}
      {(focusCoords || currentPosition) && (
        <RecenterMap coords={focusCoords || currentPosition} />
      )}

      <RecenterButton currentPosition={currentPosition} />

      {/* Current Location Marker (only if permission granted) */}
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
              Time: {alert.time || "No time"} <br />
              Urgency Level: {alert.urgency_level || "N/A"}
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}

export default MapView;
