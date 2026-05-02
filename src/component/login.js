import React, { useState } from 'react';
import axios from 'axios';

const Login = ({ setToken }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('http://localhost:5002/api/auth/login', { 
        email, 
        password 
      });
      
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('labId', res.data.labId);
      setToken(res.data.token);
    } catch (err) {
      console.error('Login error:', err);
      if (err.response) {
        // Server responded with error
        setError(err.response.data.error || 'Login failed');
      } else if (err.request) {
        // Request made but no response
        setError('Cannot connect to server. Make sure backend is running on port 5002');
      } else {
        // Something else happened
        setError('Login failed: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: '400px'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ 
            margin: '0 0 10px 0', 
            color: '#333',
            fontSize: '28px'
          }}>
            🏥 Lab Management System
          </h1>
          <p style={{ color: '#666', margin: 0 }}>
            Sign in to access your dashboard
          </p>
        </div>

        {error && (
          <div style={{
            background: '#f8d7da',
            color: '#721c24',
            padding: '10px',
            borderRadius: '5px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              color: '#555',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '5px',
                fontSize: '16px',
                transition: 'border-color 0.3s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <div style={{ marginBottom: '30px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              color: '#555',
              fontWeight: 'bold',
              fontSize: '14px'
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e0e0e0',
                borderRadius: '5px',
                fontSize: '16px',
                transition: 'border-color 0.3s',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading ? '#a0a0a0' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: loading ? 'none' : '0 5px 15px rgba(102, 126, 234, 0.4)'
            }}
            onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
            onMouseLeave={(e) => !loading && (e.target.style.transform = 'translateY(0)')}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{
          marginTop: '20px',
          textAlign: 'center',
          color: '#999',
          fontSize: '14px'
        }}>
          <p>Demo Credentials:</p>
          <p style={{ margin: '5px 0' }}>Email: admin@test.com</p>
          <p style={{ margin: '5px 0' }}>Password: password123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;