import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
} from "react-router-dom";
import Login from "../components/Login";
import App from "../App";
import CommonSpinner from "../components/CommanSpinner";
import {
  getAuthToken,
  getUserRole,
  clearAuthData,
  setAuthData,
  isValidToken,
} from "../utils/auth";
import { getCurrentUser } from "../api";

export type UserRole =
  | "manager"
  | "admin"
  | "fieldofficer"
  | "farmer"
  | "owner";

const AppRoutesContent: React.FC = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check authentication status on app start
    const token = getAuthToken();
    const savedRole = getUserRole() as UserRole | null;

    if (token && savedRole) {
      // Validate token with backend
      validateToken(token, savedRole);
    } else {
      setLoading(false);
    }
  }, []);

  const validateToken = async (token: string, role: UserRole) => {
    try {
      // Check if token exists and is valid format
      if (!token || token.trim() === "") {
        console.warn("⚠️ No token found, redirecting to login");
        handleLogout();
        return;
      }

      // Validate token format before making API call
      if (!isValidToken(token)) {
        console.warn("⚠️ Invalid token format, redirecting to login");
        handleLogout();
        return;
      }

      console.log("🔐 Validating token on app reload...");

      // Use the API function to get current user (automatically uses stored token)
      const response = await getCurrentUser();
      const userData = response.data;

      console.log("✅ User data received in AppRoutes:", userData);

      // Handle both string roles and numeric role_id
      let normalizedRole: UserRole;

      // Create role mapping
      const roleMap: { [key: number]: UserRole } = {
        1: "farmer",
        2: "fieldofficer",
        3: "manager",
        4: "owner",
      };

      if (
        userData.role &&
        typeof userData.role === "object" &&
        userData.role.name
      ) {
        // If role is an object with name property, use the name
        normalizedRole = userData.role.name.toLowerCase() as UserRole;
      } else if (
        userData.role &&
        typeof userData.role === "object" &&
        userData.role.id
      ) {
        // If role is an object with id property, map the id
        normalizedRole = roleMap[userData.role.id] || "farmer";
      } else if (userData.role && typeof userData.role === "string") {
        // If role is a string, use it directly
        normalizedRole = userData.role.toLowerCase() as UserRole;
      } else if (userData.role_id && typeof userData.role_id === "number") {
        // If role_id is a number, map it to role string
        normalizedRole = roleMap[userData.role_id] || "farmer";
      } else {
        // Fallback: check if role is already a number
        const roleId = userData.role || userData.role_id;
        if (typeof roleId === "number") {
          normalizedRole = roleMap[roleId] || "farmer";
        } else {
          // Invalid role, logout
          console.error("❌ Invalid role format:", userData);
          handleLogout();
          return;
        }
      }

      if (
        normalizedRole &&
        ["manager", "admin", "fieldofficer", "farmer", "owner"].includes(
          normalizedRole
        )
      ) {
        console.log("✅ Token valid, user role:", normalizedRole);
        setUserRole(normalizedRole);
        setIsAuthenticated(true);

        // Update localStorage with normalized role
        setAuthData(token, normalizedRole, {
          first_name: userData.first_name || "",
          last_name: userData.last_name || "",
          email: userData.email || "",
          username: userData.username || "",
          id: userData.id || "",
        });
      } else {
        // Invalid role, logout
        console.error("❌ Invalid role:", normalizedRole);
        handleLogout();
      }
    } catch (error: any) {
      const status = error.response?.status;
      const errorMessage = error.response?.data?.detail || error.message;
      
      // Handle 401/403 - Token expired or invalid
      if (status === 401 || status === 403) {
        console.warn("⚠️ Token expired or invalid (401/403). Redirecting to login...");
        console.log("Token validation failed - this is normal if the session expired");
        handleLogout();
        return;
      }
      
      // Handle network errors - keep user logged in with cached credentials
      if (!error.response || error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
        console.warn(
          "⚠️ Network error during token validation. Using cached credentials."
        );
        setUserRole(role);
        setIsAuthenticated(true);
        setLoading(false);
        return;
      }
      
      // Handle other errors
      console.error("❌ Token validation error:", {
        status,
        message: errorMessage,
        error: error.response?.data
      });
      
      // For unknown errors, logout for security
      console.warn("⚠️ Unknown error during token validation. Redirecting to login for security.");
      handleLogout();
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (role: UserRole, token: string) => {
    const normalizedRole = role.toLowerCase() as UserRole;

    // Store authentication data using utility function
    setAuthData(token, normalizedRole);

    // Update state
    setUserRole(normalizedRole);
    setIsAuthenticated(true);

    // Auto-redirect to dashboard
    console.log("Login successful for role:", normalizedRole);
    console.log("Redirecting to dashboard...");
    navigate("/dashboard");
  };

  const handleLogout = () => {
    // Clear all authentication data using utility function
    clearAuthData();

    // Reset state
    setUserRole(null);
    setIsAuthenticated(false);
  };

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <CommonSpinner />
      </div>
    );
  }

  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Login onLoginSuccess={handleLoginSuccess} />
          )
        }
      />

      {/* Dashboard Route */}
      <Route
        path="/dashboard"
        element={
          isAuthenticated && userRole ? (
            <App userRole={userRole} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Root Route */}
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />

      {/* Catch all route */}
      <Route
        path="*"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
    </Routes>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <AppRoutesContent />
    </Router>
  );
};

export default AppRoutes;
