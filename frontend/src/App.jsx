import { Routes, Route } from "react-router-dom";
import AuthForm from "./pages/AuthForm";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import FPODashboard from "./pages/fpo/FpoDashboard";
import RetailerDashboard from "./pages/retailer/RetailerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./utils/ProtectedRoute";
import AdminLogin from "./pages/admin/AdminLogin";
import Contract from "./contract/Contract";
import CropPassportPage from "./pages/CropPassportPage";

function App() {
  return (
    <Routes>
      <Route path="/contract/:address" element={<Contract/>} />
      {/* Phase 2.2 — Public Crop Passport verification (no auth required) */}
      <Route path="/crop-passport/:id" element={<CropPassportPage />} />
      <Route path="/auth" element={<AuthForm />} />
      <Route path="/admin" element={<AdminLogin/>} />

      <Route
        path="/farmer-dashboard"
        element={
          <ProtectedRoute allowedRoles={["farmer"]}>
            <FarmerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/fpo-dashboard"
        element={
          <ProtectedRoute allowedRoles={["fpo"]}>
            <FPODashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/retailer-dashboard"
        element={
          <ProtectedRoute allowedRoles={["retailer"]}>
            <RetailerDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin-dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AdminDashboard />
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="*" element={<AuthForm />} />
    </Routes>
  );
}

export default App;
