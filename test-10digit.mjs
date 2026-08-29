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

async function testRaw10Digit() {
  console.log("\n=== TEST: Raw 10-digit 8248261165 end-to-end ===");
  const ticketId = "TKT-10D-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await login();

    const { normalizePhoneNumber } = await import("./src/services/whatsappService.ts");
    const rawInput = "8248261165";
    const normalized = normalizePhoneNumber(rawInput);
    console.log("Input:", rawInput);
    console.log("Normalized:", normalized);

    if (!normalized) {
      console.log("FAIL: normalizePhoneNumber returned null");
      return false;
    }

    const ref = doc(db, "tickets", ticketId);
    await setDoc(ref, {
      ticketId,
      qrId: "QR-4CI6P4",
      organizationId: "default",
      locationId: "test",
      category: "HVAC",
      title: "AC Not Working",
      description: "Test raw 10-digit",
      severity: "HIGH",
      priority: "P2",
      status: "OPEN",
      phoneNumber: normalized,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const snap = await getDoc(ref);
    const storedPhone = snap.data().phoneNumber;
    console.log("Stored in Firestore:", storedPhone);

    const res = await fetch("http://localhost:5173/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: storedPhone,
        ticketId,
        type: "created",
        title: "AC Not Working",
        priority: "P2",
        status: "OPEN",
      }),
    });

    const text = await res.text();
    console.log("API response:", res.status, text);
    if (res.ok && text.includes('"success":true')) {
      const body = JSON.parse(text);
      console.log("PASS: WhatsApp sent with SID:", body.messageSid);
      return true;
    }
    console.log("FAIL: Unexpected response");
    return false;
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : "Unknown");
    return false;
  }
}

async function testAdminFlowWithRaw10Digit() {
  console.log("\n=== TEST: Admin flow with raw 10-digit stored phone ===");
  const ticketId = "TKT-10D-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await login();
    const ref = doc(db, "tickets", ticketId);
    await setDoc(ref, {
      ticketId,
      qrId: "QR-4CI6P4",
      organizationId: "default",
      locationId: "test",
      category: "HVAC",
      title: "AC Not Working",
      description: "Test admin flow",
      severity: "HIGH",
      priority: "P2",
      status: "OPEN",
      phoneNumber: "8248261165",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const { normalizePhoneNumber } = await import("./src/services/whatsappService.ts");
    const rawFromDb = "8248261165";
    const normalized = normalizePhoneNumber(rawFromDb);
    console.log("Raw from Firestore:", rawFromDb);
    console.log("Normalized for API:", normalized);

    if (!normalized) {
      console.log("FAIL: normalizePhoneNumber returned null for raw 10-digit");
      return false;
    }

    const res = await fetch("http://localhost:5173/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phoneNumber: normalized,
        ticketId,
        type: "status_changed",
        status: "TRIAGED",
      }),
    });

    const text = await res.text();
    console.log("API response:", res.status, text);
    if (res.ok && text.includes('"success":true')) {
      const body = JSON.parse(text);
      console.log("PASS: Admin WhatsApp sent with SID:", body.messageSid);
      return true;
    }
    console.log("FAIL: Unexpected response");
    return false;
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : "Unknown");
    return false;
  }
}

async function testEmptyPhone() {
  console.log("\n=== TEST: Empty phone number skips WhatsApp ===");
  try {
    const { shouldNotify } = await import("./src/services/whatsappService.ts");
    const result = shouldNotify("");
    if (result === false) {
      console.log("PASS: Empty phone correctly skips notification");
      return true;
    }
    console.log("FAIL: Empty phone should not notify");
    return false;
  } catch (err) {
    console.log("FAIL:", err instanceof Error ? err.message : "Unknown");
    return false;
  }
}

async function run() {
  const results = {};

  results.raw10Digit = await testRaw10Digit();
  results.adminFlow = await testAdminFlowWithRaw10Digit();
  results.emptyPhone = await testEmptyPhone();

  console.log("\n\n========================================");
  console.log("10-DIGIT WHATSAPP FIX TEST REPORT");
  console.log("========================================");
  console.log("Raw 10-digit end-to-end:", results.raw10Digit ? "PASS" : "FAIL");
  console.log("Admin flow with raw 10-digit:", results.adminFlow ? "PASS" : "FAIL");
  console.log("Empty phone skips:", results.emptyPhone ? "PASS" : "FAIL");
  console.log("========================================\n");

  await logout();
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
