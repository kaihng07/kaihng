import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import PublicCard from './components/PublicCard';
import { SystemConfig } from './types';

export default function App() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);

  const fetchSystemConfig = async () => {
    setLoadingConfig(true);
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      } else {
        throw new Error('Failed to fetch from API');
      }
    } catch (err: any) {
      console.error("[CARDNET] Could not obtain DB parameters, falling back to memory mode.", err);
      // Construct fallback UI state
      setConfig({
        configured: false,
        mode: 'memory',
        connected: false,
        dbName: 'InMemoryStore',
        error: err.message || String(err)
      });
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchSystemConfig();
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Sharing Digital Card Layout View */}
        <Route path="/card/:id" element={<PublicCard />} />
        
        {/* Hub Admin Panel Layout System (* fallback handles root & SPA navigations) */}
        <Route 
          path="/*" 
          element={
            <Dashboard 
              config={config} 
              loadingConfig={loadingConfig} 
              onRefreshConfig={fetchSystemConfig} 
            />
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}
