import React, { Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import { ErrorBoundary } from './components/ErrorBoundary';

// Lazy load components
const GamePage = React.lazy(() => import('./pages/GamePage'));
const DataConverter = React.lazy(() => import('./pages/DataConverter'));
const LobbyPage = React.lazy(() => import('./pages/LobbyPage'));

const LoadingScreen = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F1419] text-white">
    <div className="w-12 h-12 border-4 border-[#0066CC] border-t-transparent rounded-full animate-spin mb-4"></div>
    <p className="font-mono text-sm text-gray-400 animate-pulse">Loading Season Data...</p>
  </div>
);

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#0F1419] text-white overflow-hidden selection:bg-[#0066CC] selection:text-white">
      <div className="fixed inset-0 pointer-events-none opacity-5" 
           style={{ 
             backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
             backgroundSize: '24px 24px' 
           }}>
      </div>
      
      <ErrorBoundary>
        <Router>
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/game" element={<GamePage />} />
              <Route path="/lobby" element={<LobbyPage />} />
              {/* Secret route to process your CSVs */}
              <Route path="/convert" element={<DataConverter />} />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </Router>
      </ErrorBoundary>
    </div>
  );
};

export default App;