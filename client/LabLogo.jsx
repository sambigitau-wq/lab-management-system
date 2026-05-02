// client/src/components/LabLogo.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const LabLogo = ({ labId, token, API_URL, style = {}, onError, className = '' }) => {
  const [logoUrl, setLogoUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const fetchLogo = async () => {
      if (!labId) {
        setLoading(false);
        return;
      }
      
      try {
        // Add timestamp to prevent caching
        const timestamp = new Date().getTime();
        const response = await axios.get(`${API_URL}/api/labs/logo/${labId}?t=${timestamp}`, {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        if (isMounted) {
          // Clean up old URL if exists
          if (logoUrl) {
            URL.revokeObjectURL(logoUrl);
          }
          
          const url = URL.createObjectURL(response.data);
          setLogoUrl(url);
          setError(false);
        }
      } catch (err) {
        console.error('Error fetching lab logo:', err);
        if (isMounted) {
          setError(true);
          if (onError) onError(err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchLogo();

    return () => {
      isMounted = false;
      if (logoUrl) {
        URL.revokeObjectURL(logoUrl);
      }
    };
  }, [labId, token, API_URL, logoUrl]);

  // Loading state
  if (loading) {
    return (
      <div 
        className={`logo-loading ${className}`}
        style={{ 
          width: style.width || '100px', 
          height: style.height || '50px', 
          backgroundColor: '#f0f0f0', 
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style 
        }}
      >
        <div className="spinner-small" style={{
          width: '20px',
          height: '20px',
          border: '2px solid #f3f3f3',
          borderTop: '2px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  // Error or no logo - show fallback with initials or icon
  if (error || !logoUrl) {
    return (
      <div 
        className={`logo-fallback ${className}`}
        style={{ 
          width: style.width || '100px', 
          height: style.height || '50px', 
          backgroundColor: '#3b82f6', 
          color: 'white',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: style.fontSize || '16px',
          fontWeight: 'bold',
          ...style 
        }}
      >
        🏥
      </div>
    );
  }

  return (
    <img 
      src={logoUrl} 
      alt="Lab Logo" 
      className={className}
      style={{ 
        maxWidth: '100%', 
        maxHeight: '100%', 
        objectFit: 'contain',
        ...style 
      }}
      onError={() => {
        setError(true);
        if (logoUrl) {
          URL.revokeObjectURL(logoUrl);
          setLogoUrl(null);
        }
      }}
    />
  );
};

export default LabLogo;