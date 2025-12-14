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
// ...
<Route path="assignments/board" element={<PersonalizedPost />} />
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

const App: React.FC = () => {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />

          <Route path="apc/generate" element={<APCGenerate />} />
          <Route path="apc/modes" element={<PostingModes />} />
          <Route path="apc/list" element={<APCList />} />
          <Route path="apc/annual" element={<AnnualPostings />} />
          <Route path="states" element={<StateManagement />} />
          <Route path="stations" element={<StationManagement />} />
          <Route path="marking-venues" element={<MarkingVenueManagement />} />
          <Route path="ncee-centers" element={<NCEECenters />} />
          <Route path="bece-custodians" element={<BECECustodians />} />
          <Route path="ssce-custodians" element={<SSCECustodians />} />

          {/* Meta Data Routes */}
          <Route path="metadata/sdl" element={<SDLPage />} />
          <Route path="metadata/compare" element={<ComparePage />} />

          <Route path="mandates/config" element={<MandateConfig />} />
          <Route path="assignments/config" element={<AssignmentConfig />} />
          <Route path="assignments/board" element={<PersonalizedPost />} />
          <Route path="assignments/random" element={<RandomPost />} />
          <Route path="mandates/history" element={<AssignmentHistory />} />
          <Route path="audit" element={<AuditLog />} />
          <Route index element={<Navigate to="dashboard" replace />} />
        </Route>

        {/* Staff Routes - Simplified Layout for Staff */}
        <Route path="/staff/dashboard" element={<StaffDashboard />} />
        <Route path="/staff/posting" element={<MyPostingDetails />} />

      </Routes>
    </HashRouter>
  );
};

export default App;