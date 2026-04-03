
import React, { useState, useEffect } from 'react';
import Dashboard from './screens/Dashboard';
import AuthScreen from './screens/AuthScreen';
import StaffLogin from './screens/StaffLogin';
import StaffDashboard from './screens/StaffDashboard';
import OBSOverlay from './screens/OBSOverlay';
import OBSGreen from './screens/OBSGreen';
import LandingPage from './screens/LandingPage';
import AdminDashboard from './screens/AdminDashboard';
import SuperAdminDashboard from './screens/SuperAdminDashboard';
import CreateAuction from './screens/CreateAuction';
import AuctionManage from './screens/AuctionManage';
import PlayerRegistration from './screens/PlayerRegistration';
import ScoringDashboard from './screens/ScoringDashboard';
import MatchScorer from './screens/MatchScorer';
import MatchOverlay from './screens/MatchOverlay';
import PlatformGuide from './screens/PlatformGuide';
import SupportWidget from './components/SupportWidget';
import { useAuction } from './hooks/useAuction';
import { auth } from './firebase';
import firebase from 'firebase/compat/app';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { UserRole } from './types';

const AppContent: React.FC = () => {
  const { userProfile, activeAuctionId, state } = useAuction();
  const [user, setUser] = useState<firebase.User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (isLoading || (user && !userProfile)) {
    return (
      <div className="min-h-screen bg-primary flex items-center justify-center">
         <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-highlight mb-4"></div>
            <p className="text-highlight text-xl animate-pulse">Loading SM SPORTS...</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = !!user;
  const isSuperAdmin = userProfile?.role === UserRole.SUPER_ADMIN;
  const isSupportStaff = userProfile?.role === UserRole.SUPPORT;
  const isAdmin = userProfile?.role === UserRole.ADMIN || isSuperAdmin || isSupportStaff;
  const isTeamOwner = userProfile?.role === UserRole.TEAM_OWNER;

  const getAuthRedirect = () => {
      if (isSuperAdmin) return "/super-admin";
      if (isSupportStaff) return "/staff-dashboard";
      if (isAdmin) return "/admin";
      if (isTeamOwner && activeAuctionId) return `/auction/${activeAuctionId}`;
      return "/";
  };

  // Visibility Logic: Hide Support Widget on Landing Page or OBS Views
  const isLandingPage = location.pathname === '/';
  const isObsView = location.pathname.includes('obs-') || location.pathname.includes('match-overlay');
  const isRegistrationPage = location.pathname.includes('/register');
  const showSupport = isLoggedIn && !isSupportStaff && !isLandingPage && !isObsView && !isRegistrationPage;

  return (
    <>
      <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/guide" element={<PlatformGuide />} />
          <Route path="/auction/:auctionId" element={<Dashboard />} />
          <Route path="/auction/:id/register" element={<PlayerRegistration />} />

          <Route path="/auth" element={
              isLoggedIn ? <Navigate to={getAuthRedirect()} replace /> : <AuthScreen />
          } />

          <Route path="/staff-login" element={
              isLoggedIn ? <Navigate to={getAuthRedirect()} replace /> : <StaffLogin />
          } />

          <Route path="/staff-dashboard" element={
              isSupportStaff ? <StaffDashboard /> : <Navigate to="/staff-login" replace />
          } />

          <Route path="/super-admin" element={
              isSuperAdmin ? <SuperAdminDashboard /> : <Navigate to="/auth" replace />
          } />

          <Route path="/admin" element={
              isAdmin ? <AdminDashboard /> : <Navigate to="/auth" replace />
          } />
          
          <Route path="/admin/new" element={
              isAdmin ? <CreateAuction /> : <Navigate to="/auth" replace />
          } />
          
          <Route path="/admin/auction/:id/manage" element={
              isAdmin ? <AuctionManage /> : <Navigate to="/auth" replace />
          } />

          <Route path="/scoring" element={
              isAdmin && !state.hideScoringSection ? <ScoringDashboard /> : <Navigate to="/admin" replace />
          } />
          <Route path="/scoring/:matchId" element={
              isAdmin && !state.hideScoringSection ? <MatchScorer /> : <Navigate to="/admin" replace />
          } />
          <Route path="/match-overlay/:matchId" element={<MatchOverlay />} />

          <Route path="/obs-overlay/:auctionId" element={<OBSOverlay />} />
          <Route path="/obs-green/:auctionId" element={<OBSGreen />} />

          <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      
      {showSupport && <SupportWidget />}
    </>
  );
}

const App: React.FC = () => {
  return (
      <AppContent />
  );
};

export default App;
