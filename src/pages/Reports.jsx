import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import MapView from "../components/MapView";
import "../styles/report.css";

function History() {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [showPopup, setShowPopup] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "Alerts"));
        const alertsData = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            message: data.message || "No message",
            user: data.user || "Unknown",
            coords: data.coords || {},
            time: data.time ? new Date(data.time) : null,
          };
        });
        setAlerts(alertsData);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    fetchAlerts();
  }, []);

  const filterAlerts = (alerts) => {
    if (filter === "all") return alerts;

    const now = new Date();
    return alerts.filter((alert) => {
      if (!alert.time) return false;

      const diff = now - alert.time;
      if (filter === "24h") return diff <= 24 * 60 * 60 * 1000;
      if (filter === "7d") return diff <= 7 * 24 * 60 * 60 * 1000;

      return true;
    });
  };

  return (
    <div className="history-page">
      {/* Fullscreen map as background */}
      <div className="map-container">
        <MapView alerts={filterAlerts(alerts)} />
      </div>

      {/* Overlay for buttons */}
      <div className="ui-overlay">
        <div className="top-buttons">
          <button className="viewButton" onClick={() => navigate("/home")}>
            Go Back
          </button>
          <button className="viewButton" onClick={() => setShowPopup(true)}>
            Alert History
          </button>
        </div>
      </div>

      {/* Popup modal */}
      {showPopup && (
        <div className="popup-overlay" onClick={() => setShowPopup(false)}>
          <div
            className="popup-content"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Alert History</h2>

            <div className="filter">
              <button onClick={() => setFilter("all")}>All</button>
              <button onClick={() => setFilter("24h")}>Last 24 Hours</button>
              <button onClick={() => setFilter("7d")}>Last 7 Days</button>
            </div>

            <div className="alertBox">
              {filterAlerts(alerts).length === 0 ? (
                <p>No alerts found</p>
              ) : (
                <ol>
                  {filterAlerts(alerts).map((alert) => (
                    <li key={alert.id}>
                      <strong>{alert.message}</strong>
                      <div className="details">
                        From: {alert.user} <br />
                        Location: {alert.coords.latitude},{" "}
                        {alert.coords.longitude} <br />
                        Time:{" "}
                        {alert.time
                          ? alert.time.toLocaleString()
                          : "No time provided"}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <button
              className="closeButton"
              onClick={() => setShowPopup(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default History;
