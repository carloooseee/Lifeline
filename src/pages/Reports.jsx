// src/pages/Reports.jsx

import React, { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase"; // Make sure this path is correct
import MapView from "../components/MapView"; // Make sure this path is correct
import "../styles/report.css"; // Make sure this path is correct

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
            category: data.category || "not available",
            urgency_level: data.urgency_level || "not available",
          };
        });
        setAlerts(alertsData);
      } catch (error) {
        console.error("Error fetching alerts:", error);
      }
    };

    fetchAlerts();
  }, []);

  // --- Filter Function ---
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

      {/* --- UPDATED POPUP MODAL --- */}
      {/* We use a className toggle for animations */}
      <div
        className={`popup-overlay ${showPopup ? "active" : ""}`}
        onClick={() => setShowPopup(false)}
      >
        <div
          className="popup-content"
          onClick={(e) => e.stopPropagation()}
        >
          <h2>Alert History</h2>

          {/* --- Filter Buttons --- */}
          <div className="filter">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={filter === "24h" ? "active" : ""}
              onClick={() => setFilter("24h")}
            >
              Last 24 Hours
            </button>
            <button
              className={filter === "7d" ? "active" : ""}
              onClick={() => setFilter("7d")}
            >
              Last 7 Days
            </button>
          </div>
          {/* --- End of Filter Buttons --- */}

          <div className="alertBox">
            {filterAlerts(alerts).length === 0 ? (
              <p>No alerts found</p>
            ) : (
              <ol>
                {filterAlerts(alerts).map((alert) => (
                  <li key={alert.id}>
                    <strong>{alert.message}</strong>
                    <div className="details">
                      Category: {alert.category} <br />
                      Urgency Level: {alert.urgency_level}<br />
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
      {/* --- END OF POPUP --- */}
    </div>
  );
}

export default History;