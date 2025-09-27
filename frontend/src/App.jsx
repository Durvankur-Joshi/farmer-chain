import { Routes, Route } from "react-router-dom";
import AuthForm from "./pages/AuthForm";
import FarmerDashboard from "./pages/FarmerDashboard";
import FPODashboard from "./pages/FPODashboard";
import RetailerDashboard from "./pages/RetailerDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./utils/ProtectedRoute";

function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthForm />} />

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
