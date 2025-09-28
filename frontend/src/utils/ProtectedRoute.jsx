import React from "react";
import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";

export default function ProtectedRoute({ children, allowedRoles }) {
  // 🔹 Debug: log all cookies
  console.log("All cookies:", Cookies.get());

  const role = Cookies.get("role");
  console.log("Role cookie:", role);

  if (!role) {
    console.warn("No role cookie found → redirecting to /auth");
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role.toLowerCase())) {
    console.warn(`Role '${role}' is not allowed. Allowed roles:`, allowedRoles);
    return <Navigate to="/auth" replace />;
  }

  console.log(`Access granted for role: ${role}`);
  return children;
}
