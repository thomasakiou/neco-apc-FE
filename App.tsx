import React from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';

import StationManagement from './pages/admin/StationManagement';
import StateManagement from './pages/admin/StateManagement';
import MarkingVenueManagement from './pages/admin/MarkingVenueManagement';

import PostingModes from './pages/admin/PostingModes';
import AnnualPostings from './pages/admin/AnnualPostings';
import FinalPostings from './pages/admin/FinalPostings';
import APCList from './pages/admin/APCList';
import DriverAPCList from './pages/admin/DriverAPCList';
import TypesettingAPCList from './pages/admin/TypesettingAPCList';
import CustomAPC from './pages/admin/CustomAPC';
import RandomAPC from './pages/admin/RandomAPC';
import NCEECenters from './pages/admin/NCEECenters';
import GiftedCenters from './pages/admin/GiftedCenters';
import BECECustodians from './pages/admin/BECECustodians';
import SSCECustodians from './pages/admin/SSCECustodians';
import MandateConfig from './pages/admin/MandateConfig';
import AssignmentConfig from './pages/admin/AssignmentConfig';
import SSCEExtCustodians from './pages/admin/SSCEExtCustodians';
import SSCEExtMarkingVenues from './pages/admin/SSCEExtMarkingVenues';
import BECEMarkingVenues from './pages/admin/BECEMarkingVenues';
import PersonalizedPost from './pages/admin/PersonalizedPost';
import AssignmentHistory from './pages/admin/AssignmentHistory';
import SDLPage from './pages/admin/metadata/SDLPage';
import ComparePage from './pages/admin/metadata/ComparePage';
import FlaggedStaffPage from './pages/admin/metadata/FlaggedStaffPage';
import AssignmentValidationPage from './pages/admin/metadata/ValidationPage';
import OutstandingPostingsPage from './pages/admin/metadata/OutstandingPostingsPage';
import AuditLog from './pages/admin/AuditLog';
import RandomizedPost from './pages/admin/RandomizedPost';
import HODApcList from './pages/admin/HODApcList';
import HODPostings from './pages/admin/HODPostings';
import HODPostingsTable from './pages/admin/HODPostingsTable';
import TTCenters from './pages/admin/TTCenters';
import PrintingPoints from './pages/admin/PrintingPoints';
import FinalHodPostings from './pages/admin/FinalHodPostings';
import StaffDashboard from './pages/staff/StaffDashboard';
import MyPostingDetails from './pages/staff/MyPostingDetails';
import Statistics from './pages/admin/Statistics';
import HODJuxtapose from './pages/admin/HODJuxtapose';
import TypesettingJuxtapose from './pages/admin/TypesettingJuxtapose';
import DriverJuxtapose from './pages/admin/DriverJuxtapose';
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


              <Route path="apc/modes" element={<ProtectedRoute moduleName="posting"><PostingModes /></ProtectedRoute>} />
              <Route path="apc/list" element={<ProtectedRoute moduleName="apc"><APCList /></ProtectedRoute>} />
              <Route path="drivers/apc" element={<ProtectedRoute moduleName="apc"><DriverAPCList /></ProtectedRoute>} />
              <Route path="drivers/compare" element={<ProtectedRoute moduleName="apc"><DriverJuxtapose /></ProtectedRoute>} />
              <Route path="typesetting/apc" element={<ProtectedRoute moduleName="apc"><TypesettingAPCList /></ProtectedRoute>} />
              <Route path="typesetting/compare" element={<ProtectedRoute moduleName="apc"><TypesettingJuxtapose /></ProtectedRoute>} />
              <Route path="apc/custom" element={<ProtectedRoute moduleName="apc"><CustomAPC /></ProtectedRoute>} />
              <Route path="apc/random" element={<ProtectedRoute moduleName="apc"><RandomAPC /></ProtectedRoute>} />
              <Route path="apc/hod" element={<ProtectedRoute moduleName="apc"><HODApcList /></ProtectedRoute>} />
              <Route path="apc/annual" element={<ProtectedRoute moduleName="posting"><AnnualPostings /></ProtectedRoute>} />
              <Route path="apc/final" element={<ProtectedRoute moduleName="posting"><FinalPostings /></ProtectedRoute>} />

              <Route path="states" element={<ProtectedRoute moduleName="metadata"><StateManagement /></ProtectedRoute>} />
              <Route path="stations" element={<ProtectedRoute moduleName="metadata"><StationManagement /></ProtectedRoute>} />
              <Route path="marking-venues" element={<ProtectedRoute moduleName="metadata"><MarkingVenueManagement /></ProtectedRoute>} />
              <Route path="ncee-centers" element={<ProtectedRoute moduleName="metadata"><NCEECenters /></ProtectedRoute>} />
              <Route path="gifted-centers" element={<ProtectedRoute moduleName="metadata"><GiftedCenters /></ProtectedRoute>} />
              <Route path="tt-centers" element={<ProtectedRoute moduleName="metadata"><TTCenters /></ProtectedRoute>} />
              <Route path="printing-points" element={<ProtectedRoute moduleName="metadata"><PrintingPoints /></ProtectedRoute>} />
              <Route path="bece-custodians" element={<ProtectedRoute moduleName="metadata"><BECECustodians /></ProtectedRoute>} />
              <Route path="ssce-custodians" element={<ProtectedRoute moduleName="metadata"><SSCECustodians /></ProtectedRoute>} />
              <Route path="ssce-ext-custodians" element={<ProtectedRoute moduleName="metadata"><SSCEExtCustodians /></ProtectedRoute>} />
              <Route path="ssce-ext-marking-venues" element={<ProtectedRoute moduleName="metadata"><SSCEExtMarkingVenues /></ProtectedRoute>} />
              <Route path="bece-marking-venues" element={<ProtectedRoute moduleName="metadata"><BECEMarkingVenues /></ProtectedRoute>} />

              <Route path="mandates/config" element={<ProtectedRoute moduleName="metadata"><MandateConfig /></ProtectedRoute>} />
              <Route path="assignments/config" element={<ProtectedRoute moduleName="metadata"><AssignmentConfig /></ProtectedRoute>} />

              {/* Meta Data Routes */}
              <Route path="metadata/sdl" element={<ProtectedRoute moduleName="metadata"><SDLPage /></ProtectedRoute>} />
              <Route path="metadata/compare" element={<ProtectedRoute moduleName="metadata"><ComparePage /></ProtectedRoute>} />
              <Route path="metadata/flagged" element={<ProtectedRoute moduleName="metadata"><FlaggedStaffPage /></ProtectedRoute>} />
              <Route path="metadata/validation" element={<ProtectedRoute moduleName="metadata"><AssignmentValidationPage /></ProtectedRoute>} />
              <Route path="metadata/outstanding" element={<ProtectedRoute moduleName="metadata"><OutstandingPostingsPage /></ProtectedRoute>} />

              <Route path="assignments/board" element={<ProtectedRoute moduleName="posting"><PersonalizedPost /></ProtectedRoute>} />
              <Route path="assignments/random" element={<ProtectedRoute moduleName="posting"><RandomizedPost /></ProtectedRoute>} />
              <Route path="assignments/hod" element={<ProtectedRoute moduleName="posting"><HODPostings /></ProtectedRoute>} />
              <Route path="assignments/hod/table" element={<ProtectedRoute moduleName="posting"><HODPostingsTable /></ProtectedRoute>} />
              <Route path="assignments/hod/final" element={<ProtectedRoute moduleName="posting"><FinalHodPostings /></ProtectedRoute>} />
              <Route path="assignments/hod/compare" element={<ProtectedRoute moduleName="hod"><HODJuxtapose /></ProtectedRoute>} />
              <Route path="mandates/history" element={<ProtectedRoute moduleName="reports"><AssignmentHistory /></ProtectedRoute>} />
              <Route path="statistics" element={<ProtectedRoute moduleName="reports"><Statistics /></ProtectedRoute>} />
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