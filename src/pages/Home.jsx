import { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "../firebase";
import '../styles/home.css';

function Home() {
  const [user, setUser] = useState(null);
  const [coords, setCoords] = useState(null);
  const auth = getAuth(app);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    // Load last saved location (if any) from localStorage
    const savedCoords = localStorage.getItem("lastLocation");
    if (savedCoords) {
      setCoords(JSON.parse(savedCoords));
    }

    return () => unsubscribe();
  }, [auth]);
  const sendHelpRequest = () => {
    if (coords && !coords.error) {  
    } else {
      alert("Location not available. Please share your location first.");
    }
  };
  const handleShareLocation = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const newCoords = { latitude, longitude };
        setCoords(newCoords);

        // Save in localStorage for offline use
        localStorage.setItem("lastLocation", JSON.stringify(newCoords));
      },
      (err) => {
        console.error(err.message);
        setCoords({ error: err.message });
      }
    );
  };

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
      <button className="helpButton" onClick={sendHelpRequest}>
        Send Help - di pa gumagana
      </button>
      <button onClick={handleShareLocation}>
        Share My Location
      </button>

      {coords && !coords.error && (
        <p>
          Last known Coordinates - Latitude: {coords.latitude}, Longitude: {coords.longitude}
        </p>
      )}
      {coords?.error && <p>Error: {coords.error}</p>}
    </div>
  );
}

export default Home;
