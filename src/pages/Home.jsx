import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
import { prioritizeAlert } from "../utils/ml.js";
import "../styles/home.css";

const db = getFirestore(app);

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const [internetStatus, setInternetStatus] = useState(
    navigator.onLine ? "Online" : "Offline"
  );
  const [message, setMessage] = useState("");
  const [isFetchingLocation, setIsFetchingLocation] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);

  const [activeAlert, setActiveAlert] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth(app);

  const isReallyOnline = () => navigator.onLine;

  const saveDataToStorage = (locationData) => {
    const dataToSave = {
      user: user
        ? user.isAnonymous
          ? `Guest (${user.uid})`
          : user.email
        : "Unknown User",
      coords: locationData.coords,
      message: message.trim() || "HELP",
      time: new Date().toISOString(),
    };

    localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
  };

  const fetchCurrentLocationForUI = () => {
    setIsFetchingLocation(true);

    if (!navigator.geolocation) {
      setCoords({ error: "Geolocation not supported." });
      setIsFetchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newCoords = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };

        setCoords(newCoords);
        saveDataToStorage({ coords: newCoords });
        setIsFetchingLocation(false);
      },
      (err) => {
        console.error("UI Location Error:", err.message);
        // If error, we still stop fetching so UI can show error state
        setCoords({ error: "Location access denied or unavailable." });
        setIsFetchingLocation(false);
      }
    );
  };

  const processPendingAlert = async (currentUser) => {
    const pending = localStorage.getItem("pendingAlert");
    if (!pending) return;
    if (!isReallyOnline()) return;

    try {
      const alertData = JSON.parse(pending);

      alertData.user = currentUser
        ? currentUser.isAnonymous
          ? `Guest (${currentUser.uid})`
          : currentUser.email
        : "Unknown User";

      await addDoc(collection(db, "Alerts"), alertData);

      localStorage.removeItem("pendingAlert");
      alert("Queued alert was sent successfully!");
    } catch (err) {
      console.error("Failed sending queued alert:", err);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) {
      setActiveAlert(null);
      return;
    }

    const q = query(
      collection(db, "Alerts"),
      where("userId", "==", auth.currentUser.uid),
      where("alertCompleted", "==", false),
      orderBy("time", "desc"),
      limit(1)
    );

    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        setActiveAlert({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } else {
        setActiveAlert(null);
      }
    });

    return () => unsub();
  }, [auth.currentUser]);

  const markAlertCompleted = async () => {
    try {
      const current = auth.currentUser;

      if (!current) return alert("Not signed in.");
      if (!activeAlert) return;
      if (activeAlert.userId !== current.uid)
        return alert("You are not allowed to complete this alert.");

      await deleteDoc(doc(db, "Alerts", activeAlert.id));
      alert("Task completed.");
    } catch (err) {
      console.error("Complete task error:", err);
      alert("Error completing task.");
    }
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currUser) => {
      setUser(currUser);
      if (currUser) processPendingAlert(currUser);
    });

    fetchCurrentLocationForUI();

    const handleOnline = () => {
      setInternetStatus("Online");
      if (user) processPendingAlert(user);
    };

    const handleOffline = () => setInternetStatus("Offline");

    // PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    return () => {
      unsub();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, [user]);

  const handleInstallClick = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const sendHelpRequest = async () => {
    // --- Rate limit (local only)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let history = JSON.parse(localStorage.getItem("alertHistory")) || [];

    history = history.filter((t) => now - t < oneHour);
    if (history.length >= 5)
      return alert("Slow down: max 5 alerts per hour.");

    history.push(now);
    localStorage.setItem("alertHistory", JSON.stringify(history));

    // --- Cooldown
    const lastSend = Number(localStorage.getItem("lastSendTimestamp"));
    if (lastSend && now - lastSend < 10000) {
      const secs = Math.ceil((10000 - (now - lastSend)) / 1000);
      return alert(`Wait ${secs}s before sending again.`);
    }
    localStorage.setItem("lastSendTimestamp", now.toString());

    // 1. Capture Input
    const finalMessage = message.trim() || "HELP";
    setIsSending(true);

    // 2. Await ML Inference (Urgency & Category)
    // We do this BEFORE checking network so that even offline saves have tags.
    let category = "Unknown";
    let urgency_level = "Unknown"; // Default to Unknown if ML fails entirely

    // Special case: If message is just "HELP" (or similar), default to General/High
    const cleanMsg = finalMessage.trim().toUpperCase();
    if (cleanMsg === "HELP" || cleanMsg === "HELP." || cleanMsg === "HELP!") {
      category = "General Emergency";
      urgency_level = "Medium Priority";
    } else {
      try {
        const ml = await prioritizeAlert(finalMessage);
        category = ml.category || "Unknown";
        urgency_level = ml.urgency_level || "Medium Priority";
      } catch (err) {
        console.error("ML Inference failed:", err);
        // Fallback is already 'Unknown'
      }
    }

    // 3. Attach labels to alert object
    let finalCoords = coords;
    if (!finalCoords || finalCoords.error) {
      try {
        const saved = localStorage.getItem("lastLocation");
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.coords && !parsed.coords.error) {
            finalCoords = parsed.coords;
            console.log("Using cached location:", finalCoords);
          }
        }
      } catch (e) {
        console.error("Failed to recover saved location:", e);
      }
    }

    const alertData = {
      userId: auth.currentUser?.uid || null,
      user: user
        ? user.isAnonymous
          ? `Guest (${user.uid})`
          : user.email
        : "Unknown User",
      coords: finalCoords,
      message: finalMessage,
      time: new Date().toISOString(),
      category,
      urgency_level,
      alertCompleted: false,
    };

    // 4. Check Network Status
    if (!isReallyOnline()) {
      // 5. Offline -> Save to LocalStorage
      localStorage.setItem("pendingAlert", JSON.stringify(alertData));
      alert("Offline → Alert saved locally. Will send when online.");
      setIsSending(false);
      return;
    }

    // 6. Online -> Send to Firebase
    try {
      await addDoc(collection(db, "Alerts"), alertData);
      alert("Help request sent!");
      setMessage("");
    } catch (err) {
      console.error("Firebase send failed:", err);
      // Fallback: Queue locally if network fails during send
      localStorage.setItem("pendingAlert", JSON.stringify(alertData));
      alert("Network issue → Alert queued locally.");
    }

    setIsSending(false);
  };

  const getResponderStatusMessage = (category, status) => {
    let responderType = "Responders";

    switch (category) {
      case "Crime/Violence":
        responderType = "Police/Ambulance";
        break;
      case "Medical Emergency":
      case "Injury":
        responderType = "Ambulance";
        break;
      case "Fire":
        responderType = "Fire Fighters/Ambulance";
        break;
      case "Rescue/Trapped":
        responderType = "Rescue Team";
        break;
      case "Flood":
        responderType = "Rescue Team";
        break;
      case "Earthquake":
        responderType = "Rescue Team";
        break;
      default:
        responderType = "Responders";
    }

    if (status === "arrived") {
      return `${responderType} have arrived!`;
    } else {
      return `${responderType} are on the way!`;
    }
  };

  return (
    <div className="home-page-wrapper">
      <div className="logo home-logo">
        <h1>
          <span className="life">Life</span>
          <span className="line">Line</span>
        </h1>
        <p>Emergency Alert System</p>
      </div>

      <div className="Home">
        <div className="logo home-logo-mobile">
          <h1>
            <span className="life">Life</span>
            <span className="line">Line</span>
          </h1>
          <p>Emergency Alert System</p>
        </div>

        <div className="home-header">
          <h1>Welcome to Lifeline!</h1>

          {user ? (
            <p>
              Welcome{" "}
              {user.isAnonymous
                ? `Guest (Temporary ID: ${user.uid})`
                : user.email}
            </p>
          ) : (
            <p>Loading user...</p>
          )}

          <p>
            <span className="status-text">Status:</span>
            <span
              className={`status-indicator ${internetStatus === "Online"
                ? "status-online"
                : "status-offline"
                }`}
            >
              {internetStatus}
            </span>
          </p>
        </div>

        <div className="message-group">
          <label><b>Message:</b></label>
          <input
            className="message-input"
            type="text"
            placeholder="Enter your message (default: HELP)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        <button className="btn btn-help" onClick={sendHelpRequest} disabled={isSending}>
          {isSending ? "Sending..." : "Send Help"}
        </button>

        <button
          className="btn btn-store"
          onClick={() => fetchCurrentLocationForUI()}
          disabled={isFetchingLocation}
        >
          {isFetchingLocation ? "Getting Location..." : "Update Information"}
        </button>

        {installPrompt && (
          <button
            className="btn"
            onClick={handleInstallClick}
            style={{
              backgroundColor: "#2196F3",
              color: "white",
              marginTop: "10px",
              padding: "10px 20px",
              border: "none",
              borderRadius: "5px",
              fontSize: "1rem"
            }}
          >
            Install App
          </button>
        )}

        <div className="location-display">
          {isFetchingLocation && <p>Fetching current location...</p>}

          {!isFetchingLocation && coords && !coords.error && (
            <p>
              <b>Last known Coordinates</b><br />
              Latitude: {coords.latitude}, Longitude: {coords.longitude}
            </p>
          )}

          {!isFetchingLocation && coords?.error && (
            <p>
              Location Error: {coords.error}
              <br />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  fetchCurrentLocationForUI();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "blue",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0,
                  font: "inherit"
                }}
              >
                Allow Location
              </button>
            </p>
          )}
        </div>

        {activeAlert && (
          <div className="active-alert">
            <h3>Active Alert</h3>
            <p><b>Message:</b> {activeAlert.message}</p>
            {activeAlert.coords && (
              <p>
                <b>Coords:</b> {activeAlert.coords.latitude},{" "}
                {activeAlert.coords.longitude}
              </p>
            )}

            {activeAlert.status === "responding" && (
              <div className="alert-status-responding">
                <b>{getResponderStatusMessage(activeAlert.category, "responding")}</b>
              </div>
            )}

            {activeAlert.status === "arrived" && (
              <div className="alert-status-arrived">
                <b>{getResponderStatusMessage(activeAlert.category, "arrived")}</b>
              </div>
            )}

            <button className="btn btn-complete" onClick={markAlertCompleted}>
              Mark as Completed
            </button>
          </div>
        )}

        <button className="btn btn-map" onClick={() => navigate("/reports")}>
          View Alert
        </button>

        {user && user.email === "gentri@responder.com" && (
          <button
            className="btn btn-responder"
            onClick={() => navigate("/responder")}
            style={{ marginTop: "10px", backgroundColor: "#ff9800", color: "white" }}
          >
            Responder Dashboard
          </button>
        )}

        <button className="btn btn-logout" onClick={() => navigate("/")}>
          Log out
        </button>
      </div>
    </div>
  );
}

export default Home;
