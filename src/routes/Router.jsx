import React from "react";
import { createBrowserRouter, Navigate, useLocation } from "react-router-dom";
import { useAuthContext } from "../context/AuthContext";

// Golfer pages
import GolferHomePage from "../pages/golfer/GolferHomePage";
import GolferBookingPage from "../pages/golfer/GolferBookingPage";
import ProfilePage from "../pages/golfer/ProfilePage";
import CheckoutSuccess from "../pages/golfer/CheckoutSuccess";
import UnauthorizedPage from "../pages/golfer/UnauthorizedPage";

// Auth pages
import LoginPage from "../pages/auth/LoginPage";
import RegisterPage from "../pages/auth/RegisterPage";
import StaffLoginPage from "../pages/auth/StaffLoginPage";

// Admin pages
import AdminDashboard from "../pages/admin/AdminDashboard";
import BookingTable from "../pages/admin/BookingTable";
import EmployeeDetail from "../pages/admin/EmployeeDetail";
import EmployeeForm from "../pages/admin/EmployeeForm";
import EmployeePage from "../components/admin/EmployeePage";

// Starter pages
import StarterLayout from "../layout/starterLayout";
import StarterDashboard from "../pages/starter/Dashboard";
import StarterReportPage from "../pages/starter/ReportPage";
import ReportConfirmPage from "../pages/starter/ReportConfirmPage";

// Caddie pages
import CaddieLayout from "../layout/caddieLayout";
import LandingPage from "../pages/Caddy/LandingPage";
import BookingPage from "../pages/Caddy/BookingPage";
import CaddyProfile from "../pages/Caddy/CaddyProfile";
import HistoryPage from "../pages/Caddy/HistoryPage";
import ProcessGolfPage from "../pages/Caddy/ProcessGolfPage";
import CaddieDashboard from "../pages/Caddy/Dashboard";
import DashboardStart from "../pages/Caddy/DashboardStart";

// ---- Role guard ----
function RequireRole({ allowed = [], children }) {
  const { user } = useAuthContext();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname, reason: "auth" }} />;
  }
  if (!allowed.includes(user.role)) {
    return <Navigate to="/unauthorized" replace state={{ reason: "role" }} />;
  }
  return children;
}

// ---- Router ----
const Router = createBrowserRouter([
  // Public / Golfer
  { path: "/", element: <GolferHomePage /> },

  // Booking flow
  { path: "/booking", element: <GolferBookingPage /> },       // Step1-4
  { path: "/booking/success", element: <CheckoutSuccess /> }, // Success after Stripe

  // Profile
  { path: "/profile", element: <ProfilePage /> },

  // Auth
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  { path: "/staff/login", element: <StaffLoginPage /> },

  // Unauthorized
  { path: "/unauthorized", element: <UnauthorizedPage /> },

  // Starter (protected)
  {
    path: "/starter",
    element: (
      <RequireRole allowed={["starter"]}>
        <StarterLayout />
      </RequireRole>
    ),
    children: [
      { index: true, element: <StarterDashboard /> },
      { path: "dashboard", element: <StarterDashboard /> },
      { path: "report", element: <StarterReportPage /> },
      { path: "report/confirm", element: <ReportConfirmPage /> },
    ],
  },

  // Caddie (protected)
  {
    element: (
      <RequireRole allowed={["caddy"]}>
        <CaddieLayout />
      </RequireRole>
    ),
    children: [
      { path: "/landing", element: <LandingPage /> },
      { path: "/caddy", element: <BookingPage /> },
      { path: "/caddy/booking", element: <BookingPage /> },
      { path: "/caddy/profile", element: <CaddyProfile /> },
      { path: "/caddy/history", element: <HistoryPage /> },
      { path: "/caddy/process", element: <ProcessGolfPage /> },
      { path: "/caddy/dashboard", element: <CaddieDashboard /> },
      { path: "/caddy/dashboard/start", element: <DashboardStart /> },
    ],
  },

  // Admin (protected)
  {
    path: "/admin",
    element: (
      <RequireRole allowed={["admin", "starter", "caddy"]}>
        <AdminDashboard />
      </RequireRole>
    ),
    children: [
      { index: true, element: <EmployeePage /> },
      { path: "booking", element: <BookingTable /> },
      { path: "add", element: <EmployeeForm /> },
      { path: "detail/:id", element: <EmployeeDetail /> },
    ],
  },

  // Fallback
  { path: "*", element: <Navigate to="/" replace /> },
]);

export default Router;
