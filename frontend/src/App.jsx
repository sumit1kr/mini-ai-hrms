import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UIProvider } from './context/UIContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';

// Pages
import Login from './pages/Login';
import RegisterAdmin from './pages/RegisterAdmin';
import JoinOrg from './pages/JoinOrg';
import AdminDashboard from './pages/AdminDashboard';
import EmployeesPage from './pages/EmployeesPage';
import TasksPage from './pages/TasksPage';
import PendingRequests from './pages/PendingRequests';
import AiInsights from './pages/AiInsights';
import EmployeeDashboard from './pages/EmployeeDashboard';

// Layout wrapper that includes the navbar
const AppLayout = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="app-shell">
        <main>{children}</main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Navbar />
      <div className="dashboard-shell">
        <Sidebar />
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
};

// Root redirect
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'admin' ? '/admin' : '/employee'} replace />;
};

const App = () => (
  <BrowserRouter>
    <UIProvider>
      <AuthProvider>
        <AppLayout>
          <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register-admin" element={<RegisterAdmin />} />
          <Route path="/join-org" element={<JoinOrg />} />

          {/* Root */}
          <Route path="/" element={<RootRedirect />} />

          {/* Admin routes */}
          <Route
            path="/admin"
            element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <ProtectedRoute role="admin">
                <EmployeesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tasks"
            element={
              <ProtectedRoute role="admin">
                <TasksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/requests"
            element={
              <ProtectedRoute role="admin">
                <PendingRequests />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/ai-insights"
            element={
              <ProtectedRoute role="admin">
                <AiInsights />
              </ProtectedRoute>
            }
          />

          {/* Employee routes */}
          <Route
            path="/employee"
            element={
              <ProtectedRoute role="employee">
                <EmployeeDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/employee/tasks"
            element={
              <ProtectedRoute role="employee">
                <TasksPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </AuthProvider>
    </UIProvider>
  </BrowserRouter>
);

export default App;