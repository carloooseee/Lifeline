import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
import "../styles/home.css";

const db = getFirestore(app);

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const [storedInfo, setStoredInfo] = useState(null);
  const [internetStatus, setInternetStatus] = useState(
    navigator.onLine ? "Online" : "Offline"
  );
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const auth = getAuth(app);

  // Load user + last saved location
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser && coords) {
        const dataToSave = {
          uid: currentUser.uid,
          coords: coords,
        };
        localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
      }
    });

    loadStoredInfo();

    return () => unsubscribe();
  }, [auth]);

  // Function to load stored info
  const loadStoredInfo = () => {
    const savedData = localStorage.getItem("lastLocation");
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setStoredInfo(parsed);
        if (parsed.coords) setCoords(parsed.coords);
      } catch (err) {
        console.error("Error parsing lastLocation:", err);
      }
    } else {
      setStoredInfo(null);
    }
  };

  // Help Request Button
  const sendHelpRequest = async () => {
    let fallbackCoords = null;
    const savedData = localStorage.getItem("lastLocation");

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.coords) fallbackCoords = parsed.coords;
      } catch (err) {
        console.error("Error parsing lastLocation:", err);
      }
    }

    const finalMessage = message.trim() === "" ? "HELP" : message.trim();

    const alertData = {
      user: user
        ? user.isAnonymous
          ? `Guest (Temporary ID: ${user.uid})`
          : user.email
        : "Unknown User",
      coords: coords || fallbackCoords || { error: "No location shared" },
      message: finalMessage,
      time: new Date().toISOString(),
    };

    if (navigator.onLine) {
      try {
        await addDoc(collection(db, "Alerts"), alertData);
        alert(`Help request sent! (${finalMessage})`);
        setMessage("");
      } catch (err) {
        console.error("Error writing to Firestore:", err);
        localStorage.setItem("pendingAlert", JSON.stringify(alertData));
        alert("Offline, alert queued locally.");
      }
    } else {
      localStorage.setItem("pendingAlert", JSON.stringify(alertData));
      alert("Offline, alert queued locally.");
    }
  };

  // Sync pending alert when back online
  const syncPendingAlert = async () => {
    const pending = localStorage.getItem("pendingAlert");
    if (pending && navigator.onLine) {
      try {
        const alertData = JSON.parse(pending);
        await addDoc(collection(db, "Alerts"), alertData);
        localStorage.removeItem("pendingAlert");
        console.log("Pending alert synced to Firestore");
      } catch (err) {
        console.error("Failed to sync pending alert:", err);
      }
    }
  };

  // Store location manually
  const handleShareLocation = () => {
    const finalMessage = message.trim() === "" ? "HELP" : message.trim();
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { latitude, longitude };
        setCoords(newCoords);

        const dataToSave = {
          user: user
            ? user.isAnonymous
              ? `Guest (Temporary ID: ${user.uid})`
              : user.email
            : "Unknown User",
          coords: newCoords,
          message: finalMessage,
          time: new Date().toISOString(),
        };

        localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
        setStoredInfo(dataToSave);
      },
      (err) => {
        console.error(err.message);
        setCoords({ error: err.message });
      }
    );
  };

  // Internet status handler
  function handleInternetStatus() {
    const nowOnline = navigator.onLine;
    setInternetStatus(nowOnline ? "Online" : "Offline");

    if (nowOnline) syncPendingAlert();
  }

  useEffect(() => {
    handleInternetStatus();
    window.addEventListener("online", handleInternetStatus);
    window.addEventListener("offline", handleInternetStatus);
    return () => {
      window.removeEventListener("online", handleInternetStatus);
      window.removeEventListener("offline", handleInternetStatus);
    };
  }, []);

  return (
    <div className="Home">
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
        Status:{" "}
        <span style={{ color: internetStatus === "Online" ? "#6baf26" : "red" }}>
          <b>{internetStatus}</b>
        </span>
      </p>

      <div style={{ marginBottom: "15px" }}>
        <label htmlFor="messageInput"><b>Message:</b></label>
        <input
          id="messageInput"
          type="text"
          placeholder="Enter your message (default: HELP)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          style={{
            width: "90%",
            padding: "10px",
            marginTop: "8px",
            borderRadius: "8px",
            border: "1px solid #ccc",
            fontSize: "16px",
          }}
        />
      </div>

      {/* Send Help Button */}
      <button className="helpButton" onClick={sendHelpRequest}>
        Send Help
      </button>

      {/* Store Information Button */}
      <button className="storeButton" onClick={handleShareLocation}>Store Information</button>

      {/* Stored Info Display */}
      {(() => {

        const savedData = localStorage.getItem("lastLocation");
        let storedCoords = null;

        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            if (parsed.coords) storedCoords = parsed.coords;
          } catch (err) {
            console.error("Error parsing lastLocation:", err);
          }
        }

        if (coords && !coords.error) {
          return (
            <p>
              Last known Coordinates — Latitude: {coords.latitude}, Longitude:{" "}
              {coords.longitude}
            </p>
          );
        } else if (storedCoords) {
          return (
            <p>
              Last stored Coordinates — Latitude: {storedCoords.latitude}, Longitude:{" "}
              {storedCoords.longitude}
            </p>
          );
        } else if (coords?.error) {
          return <p>Error: {coords.error}</p>;
        } else {
          return <p>No stored info yet.</p>;
        }
      })()}

      <button className="viewMapButton" onClick={() => navigate("/reports")}>
        View Alert
      </button>
      <a className="logoutButton" onClick={() => navigate("/")}>log out</a>
    </div>
  );
}

export default Home;
