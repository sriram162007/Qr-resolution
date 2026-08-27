import { Routes, Route } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminOrganization from "@/pages/AdminOrganization";
import AdminLocations from "@/pages/AdminLocations";
import AdminQR from "@/pages/AdminQR";
import PublicQR from "@/pages/PublicQR";
import PublicTrack from "@/pages/PublicTrack";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/organization"
        element={
          <ProtectedRoute>
            <AdminOrganization />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/locations"
        element={
          <ProtectedRoute>
            <AdminLocations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/qr"
        element={
          <ProtectedRoute>
            <AdminQR />
          </ProtectedRoute>
        }
      />
      <Route path="/q/:qrId" element={<PublicQR />} />
      <Route path="/track/:ticketId" element={<PublicTrack />} />
    </Routes>
  );
}
