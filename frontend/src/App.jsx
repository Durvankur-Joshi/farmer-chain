import { Routes, Route } from "react-router-dom";
import AuthForm from "./pages/AuthForm";
import FarmerDashboard from "./pages/farmer/FarmerDashboard";
import FPODashboard from "./pages/fpo/FpoDashboard";
import RetailerDashboard from "./pages/retailer/RetailerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ProtectedRoute from "./utils/ProtectedRoute";
import AdminLogin from "./pages/admin/AdminLogin";
import Cor1 from "./components/Cor1";

function App() {
  return (
    <Routes>
      <Route path="/contract/0x6be52B0DFf8CfC6F389430fF958881d7842d4466" element={<Cor1/>} />
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
