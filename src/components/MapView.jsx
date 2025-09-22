import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import 'leaflet/dist/leaflet.css';

function MapView({ lat, lng }) {
  return (
    <MapContainer center={[lat, lng]} zoom={13} style={{ height: "300px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Marker position={[lat, lng]}>
        <Popup>Alert Location</Popup>
      </Marker>
    </MapContainer>
  );
}

export default MapView;
