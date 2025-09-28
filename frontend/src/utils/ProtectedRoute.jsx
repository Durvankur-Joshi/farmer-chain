import React from "react";
import { Navigate } from "react-router-dom";
import Cookies from "js-cookie";

export default function ProtectedRoute({ children, allowedRoles }) {
  // We can’t read HttpOnly token in JS, so just trust it’s there.
  // The backend will reject requests if token is missing/expired.
 const role = Cookies.get("role");

  console.log("Role:", role);

  if (!role) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role.toLowerCase())) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
