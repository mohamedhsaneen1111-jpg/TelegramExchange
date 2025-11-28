import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Earn from './pages/Earn';
import AddChannel from './pages/AddChannel';
import MyTasks from './pages/MyTasks'; // Import new page
import Ads from './pages/Ads';
import Referrals from './pages/Referrals';
import ProfilePage from './pages/Profile';
import CompleteProfile from './pages/CompleteProfile';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [profileCompleted, setProfileCompleted] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setAuthenticated(true);
        const { data: profile } = await supabase
          .from('profiles')
          .select('country')
          .eq('id', session.user.id)
          .maybeSingle();
        
        if (profile?.country) {
          setProfileCompleted(true);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>;
  
  if (!authenticated) return <Navigate to="/login" />;
  if (!profileCompleted && window.location.pathname !== '/complete-profile') return <Navigate to="/complete-profile" />;
  
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/complete-profile" element={<ProtectedRoute><CompleteProfile /></ProtectedRoute>} />
        
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="earn" element={<Earn />} />
          <Route path="add-channel" element={<AddChannel />} />
          <Route path="my-tasks" element={<MyTasks />} /> {/* Add Route */}
          <Route path="ads" element={<Ads />} />
          <Route path="referrals" element={<Referrals />} />
          <Route path="profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
