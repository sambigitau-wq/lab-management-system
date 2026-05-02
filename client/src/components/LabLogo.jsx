// client/src/components/LabLogo.jsx
import React, { useState } from 'react';

const LabLogo = ({ labId, API_URL, style = {}, className = '' }) => {
  const [error, setError] = useState(false);
  
  if (!labId) return null;
  
  // Direct URL to the logo endpoint with cache busting
  const logoUrl = `${API_URL}/api/labs/logo/${labId}?t=${Date.now()}`;
  
  if (error) {
    // Fallback when logo fails to load
    return (
      <div 
        className={className}
        style={{ 
          width: style.width || '100px', 
          height: style.height || '50px', 
          backgroundColor: '#3b82f6', 
          color: 'white',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: style.fontSize || '14px',
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
        console.error('Failed to load logo:', logoUrl);
        setError(true);
      }}
      onLoad={() => console.log('Logo loaded successfully for lab:', labId)}
    />
  );
};

export default LabLogo;