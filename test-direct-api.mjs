import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

async function loadEnv() {
  try {
    const fs = await import("fs");
    const path = await import("path");
    const lines = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf-8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = val;
    }
  } catch (e) {
    console.warn("Could not load .env.local:", e instanceof Error ? e.message : e);
  }
}

await loadEnv();

const FIREBASE_CONFIG = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(FIREBASE_CONFIG);
const db = getFirestore(app);
const auth = getAuth(app);

async function login() {
  await signInWithEmailAndPassword(auth, "admin@test.com", "admin123");
}

async function logout() {
  await signOut(auth);
}

async function testDirectApiCall(phoneNumber) {
  console.log("\n=== TEST: Direct API handler call with " + phoneNumber + " ===");
  try {
    const handler = (await import("./api/send-whatsapp.ts")).default;

    const req = {
      method: "POST",
      body: {
        phoneNumber: phoneNumber,
        ticketId: "TKT-DIRECT",
        type: "created",
        title: "Test",
        priority: "P2",
        status: "OPEN",
      },
    };

    const chunks = [];
    const res = {
      statusCode: 200,
      setHeader() {},
      end(data) {
        chunks.push(data);
      },
    };

    await handler(req, res);

    const body = chunks.join("");
    console.log("Direct API response:", res.statusCode, body);
    if (res.statusCode === 200 && body.includes('"success":true')) {
      console.log("PASS: Direct API call succeeded");
      return true;
    }
    console.log("FAIL: Direct API call failed");
    return false;
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : "Unknown");
    return false;
  }
}

async function run() {
  await login();

  const results = {};
  results.raw10Digit = await testDirectApiCall("8248261165");
  results.normalized = await testDirectApiCall("+918248261165");
  results.withSpace = await testDirectApiCall("+91 8248261165");

  console.log("\n\n========================================");
  console.log("DIRECT API CALL TEST REPORT");
  console.log("========================================");
  console.log("Raw 10-digit 8248261165:", results.raw10Digit ? "PASS" : "FAIL");
  console.log("Normalized +918248261165:", results.normalized ? "PASS" : "FAIL");
  console.log("With space +91 8248261165:", results.withSpace ? "PASS" : "FAIL");
  console.log("========================================\n");

  await logout();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
