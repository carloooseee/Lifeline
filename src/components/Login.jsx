import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { app } from "../firebase"; // make sure firebase.js exports `app`
import '../styles/login.css'

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
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
    <div className="login-page">
      <div className="logo">
        <h1><span className="life">Life</span><span className="line">Line</span></h1>
        <p>Be safer today—with reliable Lifeline</p>
      </div>
      <div className="hero-section">
        <img src="/pictures/Rescue.png" />
      </div>
      <div className="login-panel">
        <h1>Nice to see you again!</h1>
        {error && (
          <p className="error">{error}</p>
        )}
        <form onSubmit={handleLogin}>
          <input
            type="email"
            placeholder="Email or phone number"
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
          <div className="form-options">
            <label>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              Remember me
            </label>
            <a href="#" className="forgot-password">Forgot password?</a>
          </div>
          <button type="submit" className="sign-in-btn">Sign in</button>
          <button type="button" onClick={handleGuest} className="guest-btn">Continue as Guest</button>
          <button type="button" className="google-btn">
            <img src="/path/to/google-icon.png" alt="Google" />
            Sign in with Google
          </button>
        </form>
        <p className="signup-link">Don’t have an account? <a href="#">Sign up now</a></p>
      </div>
    </div>
  );
}
