import React, { useEffect, useState } from "react";
import { getAuth, signOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
import MapView from "../components/MapView";
import "../styles/ResponderDashboard.css";

const db = getFirestore(app);
const auth = getAuth(app);

export default function ResponderDashboard() {
  const [alerts, setAlerts] = useState([]);
  const [user, setUser] = useState(null);
  const [focusCoords, setFocusCoords] = useState(null);
  const navigate = useNavigate();

  // 1. Auth Check
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      if (!u) {
        navigate("/");
      } else if (!u.email.endsWith("@responder.com")) {
        alert("Access Denied: Responders Only");
        navigate("/home");
      } else {
        setUser(u);
      }
    });
    return () => unsub();
  }, [navigate]);

  // 2. Fetch Active Alerts
  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, "Alerts"), where("alertCompleted", "==", false));
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        // Ensure time is a Date object if it's a timestamp
        time: doc.data().time ? new Date(doc.data().time) : null,
      }));
      
      // Sort by time (newest first)
      data.sort((a, b) => (b.time || 0) - (a.time || 0));
      
      setAlerts(data);
    });

    return () => unsub();
  }, [user]);

  // 3. Actions
  const handleRespond = async (alertId) => {
    try {
      await updateDoc(doc(db, "Alerts", alertId), {
        status: "responding",
        responderId: user.uid,
        responderEmail: user.email,
      });
      alert("Marked as responding!");
    } catch (err) {
      console.error("Error responding:", err);
      alert("Failed to update status.");
    }
  };

  const handleComplete = async (alertId) => {
    if (!window.confirm("Mark this alert as resolved?")) return;
    try {
      await deleteDoc(doc(db, "Alerts", alertId));
      
      alert("Alert deleted successfully.");
    } catch (err) {
      console.error("Error completing:", err);
      alert("Failed to complete alert.");
    }
  };

  const handleLogout = () => {
    signOut(auth);
    navigate("/");
  };

  if (!user) return <div className="loading">Loading Responder Dashboard...</div>;

  return (
    <div className="responder-dashboard">
      {/* Left Panel: Alerts List */}
      <div className="dashboard-sidebar">
        <div className="dashboard-header">
          <h2>Responder Panel</h2>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <div className="alerts-list">
          {alerts.length === 0 ? (
            <div className="no-alerts">No active alerts. Good job!</div>
          ) : (
            alerts.map((alert) => (
              <div 
                key={alert.id} 
                className="alert-card"
                onClick={() => {
                  if (alert.coords && alert.coords.latitude) {
                    setFocusCoords(alert.coords);
                  }
                }}
                style={{ cursor: "pointer" }}
              >
                <h3>
                  {alert.message || "No Message"}
                  {alert.status === "responding" && (
                    <span className="alert-status-badge responding">Responding</span>
                  )}
                </h3>
                <div className="alert-details">
                  <p><strong>Category:</strong> {alert.category || "Emergency"}</p>
                  <p><strong>User:</strong> {alert.user}</p>
                  <p><strong>Urgency:</strong> {alert.urgency_level}</p>
                  <p><strong>Time:</strong> {alert.time ? alert.time.toLocaleString() : "N/A"}</p>
                </div>
                <div className="alert-actions">
                  {alert.status !== "responding" && (
                    <button 
                      className="btn-respond"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRespond(alert.id);
                      }}
                    >
                      Respond
                    </button>
                  )}
                  <button 
                    className="btn-complete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleComplete(alert.id);
                    }}
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Map */}
      <div className="map-container">
        <MapView alerts={alerts} focusCoords={focusCoords} />
      </div>
    </div>
  );
}
