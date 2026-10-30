import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AnalysisProvider } from './context/AnalysisContext';
import { AppRoutes } from './routes/AppRoutes';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AnalysisProvider>
          <AppRoutes />
        </AnalysisProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
