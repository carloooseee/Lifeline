// src/db.js
import Dexie from "dexie";

// Create a new Dexie instance
const db = new Dexie("EmergencyReportsDB");

// Define tables
db.version(1).stores({
  reports: "++id, title, description, location, timestamp, status, votes", 
  users: "++id, username, role" 
  // Add more if needed
});

export default db;
