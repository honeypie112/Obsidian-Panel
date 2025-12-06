import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ServerProvider } from './context/ServerContext';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/DashboardLayout';
import Overview from './pages/Overview';
import PrivateRoute from './components/PrivateRoute';

import Console from './pages/Console';
import Files from './pages/Files';
import ServerSettings from './pages/ServerSettings';
import GeneralSettings from './pages/GeneralSettings';

function App() {
  return (
    <AuthProvider>
      <ServerProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<PrivateRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Overview />} />
                <Route path="/console" element={<Console />} />
                <Route path="/files" element={<Files />} />
                <Route path="/server-settings" element={<ServerSettings />} />
                <Route path="/general-settings" element={<GeneralSettings />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Router>
      </ServerProvider>
    </AuthProvider>
  );
}

export default App;
