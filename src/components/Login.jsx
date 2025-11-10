import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithEmailAndPassword, signInAnonymously, createUserWithEmailAndPassword } from "firebase/auth";
import { app } from "../firebase"; // make sure firebase.js exports `app`
import '../styles/login.css'

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
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

  const handleSignup = async (e) => {
    e.preventDefault();

    // Simple password check
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      alert("Account created successfully!");
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
        <p>Be safer today—with<br />reliable Lifeline</p>
      </div>
      <div className="hero-section">
        <img src="/pictures/Rescue.png" />
      </div>
      <div className="login-panel">
        <h1>{isLogin ? "Nice to see you again!" : "Create your Lifeline account"}</h1>
        {error && (
          <p className="error">{error}</p>
        )}
        <form onSubmit={isLogin ? handleLogin : handleSignup}>
          <label className="input-label">{isLogin ? "Login" : "Email"}</label>
          <input
            type="email"
            placeholder="Email or phone number"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label className="input-label">Password</label>
          <div className="password-input-container">
            <input
              type={showPassword ? "text" : "password"}
              placeholder={isLogin ? "Enter password" : "Password (min. 6 characters)"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <img
              src="/pictures/eye.png"
              alt="Toggle password visibility"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            />
          </div>
          {!isLogin && (
            <>
              <label className="input-label">Confirm Password</label>
              <input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </>
          )}
          {isLogin && (
            <div className="form-options">
              <label className="switch-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="slider"></span>
                Remember me
              </label>
              <a href="#" className="forgot-password">Forgot password?</a>
            </div>
          )}
          <button type="submit" className="sign-in-btn">{isLogin ? "Sign in" : "Sign up"}</button>
          {isLogin && (
            <>
              <button type="button" onClick={handleGuest} className="guest-btn">Continue as Guest</button>
              <button type="button" className="google-btn">
                <img src="/pictures/google-icon.png" alt="Google" />
                Sign in with Google
              </button>
            </>
          )}
        </form>
        <p className="signup-link">
          {isLogin ? "Don’t have an account?" : "Already have an account?"}{" "}
          <a href="#" onClick={() => setIsLogin(!isLogin)}>{isLogin ? "Sign up now" : "Sign in now"}</a>
        </p>
      </div>
    </div>
  );
}
