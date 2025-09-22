import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function MapView({ alerts }) {
  const defaultPosition = [14.5995, 120.9842]; // Manila coords

  return (
    <MapContainer
      center={
        alerts.length > 0
          ? [alerts[0].coords.latitude, alerts[0].coords.longitude]
          : defaultPosition
      }
      zoom={12}
      style={{ height: "100%", width: "100%" }}
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />

      {alerts.map((alert) => (
        <Marker
          key={alert.id}
          position={[alert.coords.latitude, alert.coords.longitude]}
        >
          <Popup>
            <strong>{alert.message}</strong> <br />
            From: {alert.user} <br />
            Time: {alert.time ? alert.time.toLocaleString() : "No time"}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapView;
