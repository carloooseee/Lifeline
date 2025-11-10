import React, { useEffect, useState, useCallback } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { app } from "../firebase";
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
  const navigate = useNavigate();
  const auth = getAuth(app);

  // --- Helper function to save location data ---
  const saveDataToStorage = (locationData) => {
    const dataToSave = {
      user: user
        ? user.isAnonymous
          ? `Guest (Temporary ID: ${user.uid})`
          : user.email
        : "Unknown User",
      coords: locationData.coords,
      message: message.trim() === "" ? "HELP" : message.trim(),
      time: new Date().toISOString(),
    };
    localStorage.setItem("lastLocation", JSON.stringify(dataToSave));
  };

  // --- Fetch current location for UI display and storage ---
  const fetchCurrentLocationForUI = () => {
    setIsFetchingLocation(true);
    if (!navigator.geolocation) {
      setCoords({ error: "Geolocation is not supported by your browser." });
      setIsFetchingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { latitude, longitude };
        setCoords(newCoords);
        setIsFetchingLocation(false);
        saveDataToStorage({ coords: newCoords }); 
      },
      (err) => {
        console.error("UI Location Error:", err.message);
       
        setIsFetchingLocation(false); 
      }
    );
  };

  // --- Effect to handle auth state and internet status ---
const processPendingAlert = async (currentUser) => { // <-- NOTE currentUser ARGUMENT
    const pendingAlert = localStorage.getItem("pendingAlert");

    if (pendingAlert && navigator.onLine) {
        try {
            const alertData = JSON.parse(pendingAlert);
            alertData.user = currentUser 
                ? currentUser.isAnonymous
                    ? `Guest (Temporary ID: ${currentUser.uid})`
                    : currentUser.email
                : "Unknown User";
            console.log("Internet restored. Sending pending alert:", alertData);
            await addDoc(collection(db, "Alerts"), alertData);
            localStorage.removeItem("pendingAlert");
            alert("Pending help request successfully sent upon connection restoration!");

        } catch (error) {
            console.error("Error processing pending alert:", error);
        }
    }
};
  useEffect(() => {
      const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
          setUser(currentUser);
      });
      const savedData = localStorage.getItem("lastLocation");
      if (savedData) {
      }
      fetchCurrentLocationForUI();
      const handleOnline = () => {
          setInternetStatus("Online");
          processPendingAlert(); 
      };

      const handleOffline = () => {
          setInternetStatus("Offline");
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      // 4. Cleanup function
      return () => {
          unsubscribeAuth();
          window.removeEventListener("online", handleOnline);
          window.removeEventListener("offline", handleOffline);
      };
  }, []); // [auth] if gusto mo i-add refresh location

  // --- Store location button ---
  const handleShareLocation = () => {
    fetchCurrentLocationForUI(); 
    alert("Updating stored location...");
  };


  const sendHelpRequest = async () => {
    setIsSending(true);
    const finalMessage = message.trim() === "" ? "HELP" : message.trim();

    // Helper to send alert data
    const sendAlert = async (locationData, isFresh = true) => {
      const alertData = {
        user: user
          ? user.isAnonymous
            ? `Guest (Temporary ID: ${user.uid})`
            : user.email
          : "Unknown User",
        coords: locationData,
        message: finalMessage,
        time: new Date().toISOString(),
      };

      if (navigator.onLine) {
        try {
          await addDoc(collection(db, "Alerts"), alertData);
          const alertMsg = isFresh 
            ? `Help request sent with your current location! (${finalMessage})`
            : `Help request sent with your LAST KNOWN location. (${finalMessage})`;
          alert(alertMsg);
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
      setIsSending(false);
    };
      
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
  
          const { latitude, longitude } = pos.coords;
          const freshCoords = { latitude, longitude };
 
          setCoords(freshCoords); 
          saveDataToStorage({ coords: freshCoords });

          sendAlert(freshCoords, true); 
        },
        (err) => {
          console.error("GPS Error on send:", err.message);
          const fallbackCoords = (coords && !coords.error) 
            ? coords 
            : { error: "No location available. GPS failed." };
            
          alert("Could not get new location. Sending last known coordinates.");
          sendAlert(fallbackCoords, false);
        }
      );
    } else {
  
      const fallbackCoords = (coords && !coords.error) 
        ? coords 
        : { error: "Geolocation not supported." };
        
      alert("Geolocation not supported. Sending last known coordinates.");
      sendAlert(fallbackCoords, false);
    }
  };


  return (
    <div className="home-page-wrapper">
      <div className="Home">
        
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
              className={`status-indicator ${
                internetStatus === "Online" ? "status-online" : "status-offline"
              }`}
            >
              {internetStatus}
            </span>
          </p>
        </div>

        <div className="message-group">
          <label htmlFor="messageInput">
            <b>Message:</b>
          </label>
          <input
            id="messageInput"
            className="message-input"
            type="text"
            placeholder="Enter your message (default: HELP)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </div>

        {/* --- BUTTONS --- */}
        <button 
          className="btn btn-help" 
          onClick={sendHelpRequest} 
          disabled={isSending}
        >
          {isSending ? "Sending..." : "Send Help"}
        </button>

        <button 
          className="btn btn-store" 
          onClick={handleShareLocation} 
          disabled={isFetchingLocation}
        >
          {isFetchingLocation ? "Getting Location..." : "Store Information"}
        </button>

        {/* --- Location Display --- */}
        <div className="location-display">
          {isFetchingLocation && <p>Fetching current location...</p>}
          
          {!isFetchingLocation && coords && !coords.error && (
          <p>
            <b>Last known Coordinates</b><br/>Latitude: {coords.latitude}, Longitude:{" "}
            {coords.longitude}
          </p>
          )}

          {!isFetchingLocation && coords?.error && (
            <p>Location Error: {coords.error}</p>
          )}
          
          {!isFetchingLocation && !coords && (
            <p>No location data. Please share your location.</p>
          )}
        </div>

        <button className="btn btn-map" onClick={() => navigate("/reports")}>
          View Alert
        </button>

        <a className="btn btn-logout" onClick={() => navigate("/")}>
          Log out
        </a>

      </div>
    </div>
  );
}

export default Home;