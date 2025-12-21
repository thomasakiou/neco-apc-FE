import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';

import StationManagement from './pages/admin/StationManagement';
import StateManagement from './pages/admin/StateManagement';
import MarkingVenueManagement from './pages/admin/MarkingVenueManagement';
import APCGenerate from './pages/admin/APCGenerate';
import PostingModes from './pages/admin/PostingModes';
import AnnualPostings from './pages/admin/AnnualPostings';
import APCList from './pages/admin/APCList';
import NCEECenters from './pages/admin/NCEECenters';
import BECECustodians from './pages/admin/BECECustodians';
import SSCECustodians from './pages/admin/SSCECustodians';
import MandateConfig from './pages/admin/MandateConfig';
import AssignmentConfig from './pages/admin/AssignmentConfig';
import PersonalizedPost from './pages/admin/PersonalizedPost';
import AssignmentHistory from './pages/admin/AssignmentHistory';
import SDLPage from './pages/admin/metadata/SDLPage';
import ComparePage from './pages/admin/metadata/ComparePage';
import AuditLog from './pages/admin/AuditLog';
import RandomPost from './pages/admin/RandomPost';
import StaffDashboard from './pages/staff/StaffDashboard';
import MyPostingDetails from './pages/staff/MyPostingDetails';
import AdminLayout from './components/AdminLayout';

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Configuration from './pages/admin/Configuration';

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AuthProvider>
        <HashRouter>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Login />} />

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route path="dashboard" element={<AdminDashboard />} />

              <Route path="apc/generate" element={<ProtectedRoute moduleName="apc"><APCGenerate /></ProtectedRoute>} />
              <Route path="apc/modes" element={<ProtectedRoute moduleName="posting"><PostingModes /></ProtectedRoute>} />
              <Route path="apc/list" element={<ProtectedRoute moduleName="apc"><APCList /></ProtectedRoute>} />
              <Route path="apc/annual" element={<ProtectedRoute moduleName="posting"><AnnualPostings /></ProtectedRoute>} />

              <Route path="states" element={<ProtectedRoute moduleName="metadata"><StateManagement /></ProtectedRoute>} />
              <Route path="stations" element={<ProtectedRoute moduleName="metadata"><StationManagement /></ProtectedRoute>} />
              <Route path="marking-venues" element={<ProtectedRoute moduleName="metadata"><MarkingVenueManagement /></ProtectedRoute>} />
              <Route path="ncee-centers" element={<ProtectedRoute moduleName="metadata"><NCEECenters /></ProtectedRoute>} />
              <Route path="bece-custodians" element={<ProtectedRoute moduleName="metadata"><BECECustodians /></ProtectedRoute>} />
              <Route path="ssce-custodians" element={<ProtectedRoute moduleName="metadata"><SSCECustodians /></ProtectedRoute>} />

              <Route path="mandates/config" element={<ProtectedRoute moduleName="metadata"><MandateConfig /></ProtectedRoute>} />
              <Route path="assignments/config" element={<ProtectedRoute moduleName="metadata"><AssignmentConfig /></ProtectedRoute>} />

              {/* Meta Data Routes */}
              <Route path="metadata/sdl" element={<ProtectedRoute moduleName="metadata"><SDLPage /></ProtectedRoute>} />
              <Route path="metadata/compare" element={<ProtectedRoute moduleName="metadata"><ComparePage /></ProtectedRoute>} />

              <Route path="assignments/board" element={<ProtectedRoute moduleName="posting"><PersonalizedPost /></ProtectedRoute>} />
              <Route path="assignments/random" element={<ProtectedRoute moduleName="posting"><RandomPost /></ProtectedRoute>} />
              <Route path="mandates/history" element={<ProtectedRoute moduleName="reports"><AssignmentHistory /></ProtectedRoute>} />
              <Route path="audit" element={<ProtectedRoute requiredRole="super_admin"><AuditLog /></ProtectedRoute>} />

              <Route path="configuration" element={<ProtectedRoute requiredRole="super_admin"><Configuration /></ProtectedRoute>} />

              <Route index element={<Navigate to="dashboard" replace />} />
            </Route>

            {/* Staff Routes - Simplified Layout for Staff */}
            <Route path="/staff/dashboard" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
            <Route path="/staff/posting" element={<ProtectedRoute><MyPostingDetails /></ProtectedRoute>} />

          </Routes>
        </HashRouter>
      </AuthProvider>
    </NotificationProvider>
  );
};

export default App;