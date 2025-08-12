import React, { useEffect, useState } from 'react';

const VersionChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);

  const checkForUpdates = async () => {
    try {
      // Add timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`${process.env.PUBLIC_URL}/version.json?v=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      const latestVersion = await response.json();
      const storedVersion = localStorage.getItem('app-version');
      
      setCurrentVersion(latestVersion);
      
      if (storedVersion && storedVersion !== latestVersion.version) {
        setUpdateAvailable(true);
      } else if (!storedVersion) {
        localStorage.setItem('app-version', latestVersion.version);
      }
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  };

  const handleUpdate = () => {
    if (currentVersion) {
      localStorage.setItem('app-version', currentVersion.version);
    }
    // Clear all caches and reload
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
    window.location.reload(true);
  };

  useEffect(() => {
    checkForUpdates();
    // Check for updates every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (!updateAvailable) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: '#007bff',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      zIndex: 9999,
      fontSize: '14px',
      maxWidth: '300px'
    }}>
      <div style={{ marginBottom: '8px' }}>
        🚀 New version available!
      </div>
      <button
        onClick={handleUpdate}
        style={{
          backgroundColor: 'white',
          color: '#007bff',
          border: 'none',
          padding: '5px 10px',
          borderRadius: '3px',
          cursor: 'pointer',
          fontSize: '12px',
          fontWeight: 'bold'
        }}
      >
        Update Now
      </button>
    </div>
  );
};

export default VersionChecker;
