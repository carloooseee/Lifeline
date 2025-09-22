import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { app } from "../firebase"; // make sure firebase.js exports `app`
import '../styles/login.css'

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const auth = getAuth(app);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/home");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleGuest = async () => {
    try {
      await signInAnonymously(auth);
      navigate("/home"); 
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleLogin} className="space-y-4">
      {error && (
        <p>{error}</p>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        
        required
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}

        required
      />

      <button
        type="submit"
      >
        Log In
      </button>

      <button
        type="button"
        onClick={handleGuest}
      >
        Continue as Guest
      </button>
    </form>
  );
}
