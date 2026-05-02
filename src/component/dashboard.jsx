import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { io } from 'socket.io-client';

// Initialize socket
const socket = io('http://localhost:5002', {
  auth: { token: localStorage.getItem('token') }
});

const Dashboard = ({ token }) => {
  const [summary, setSummary] = useState({ orders: {}, payments: {} });
  const [recentOrders, setRecentOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [period, setPeriod] = useState('daily');
  const [loading, setLoading] = useState(true);

  const API_URL = 'http://localhost:5002';

  useEffect(() => {
    fetchSummary();
    fetchRecentOrders();

    // Socket.io real-time updates
    socket.on('resultUpdated', (data) => {
      setNotifications(prev => [`Result updated for order #${data.orderId}`, ...prev.slice(0, 4)]);
      // Refresh data when results are updated
      fetchSummary();
      fetchRecentOrders();
    });

    return () => {
      socket.off('resultUpdated');
    };
  }, [period]);

  const fetchSummary = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/reports/summary?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSummary(res.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentOrders = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/orders?limit=5`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRecentOrders(res.data);
    } catch (err) {
      console.error('Error fetching recent orders:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('labId');
    window.location.reload();
  };

  const sendToClinician = async (orderId) => {
    const clinicianEmail = prompt('Enter clinician email:');
    if (!clinicianEmail) return;
    
    try {
      await axios.post(`${API_URL}/api/orders/${orderId}/send-to-clinician`, 
        { clinicianEmail }, 
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Results sent to clinician successfully!');
    } catch (err) {
      alert('Error sending results: ' + (err.response?.data?.error || err.message));
    }
  };

  const printResults = (orderId) => {
    window.open(`${API_URL}/api/orders/${orderId}/print?token=${token}`);
  };

  const chartData = [
    { name: 'Orders', value: summary.orders?.order_count || 0 },
    { name: 'Revenue ($)', value: summary.orders?.total_revenue || 0 },
    { name: 'Paid ($)', value: summary.payments?.total_paid || 0 }
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '30px',
        paddingBottom: '20px',
        borderBottom: '2px solid #eee'
      }}>
        <h1 style={{ margin: 0, color: '#333' }}>🏥 Lab Management Dashboard</h1>
        <button 
          onClick={handleLogout}
          style={{
            padding: '10px 20px',
            background: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          Logout
        </button>
      </div>

      {/* Period Selector */}
      <div style={{ marginBottom: '30px' }}>
        <label style={{ marginRight: '10px', fontWeight: 'bold' }}>Select Period:</label>
        <select 
          value={period} 
          onChange={(e) => setPeriod(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '5px',
            border: '1px solid #ccc',
            fontSize: '14px'
          }}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '10px',
          color: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9 }}>Total Orders</h3>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
            {loading ? '...' : summary.orders?.order_count || 0}
          </p>
        </div>

        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
          borderRadius: '10px',
          color: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9 }}>Total Revenue</h3>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
            ${loading ? '...' : summary.orders?.total_revenue || 0}
          </p>
        </div>

        <div style={{
          padding: '20px',
          background: 'linear-gradient(135deg, #5ea3ec 0%, #43e97b 100%)',
          borderRadius: '10px',
          color: 'white',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', opacity: 0.9 }}>Total Paid</h3>
          <p style={{ margin: 0, fontSize: '32px', fontWeight: 'bold' }}>
            ${loading ? '...' : summary.payments?.total_paid || 0}
          </p>
        </div>
      </div>

      {/* Chart and Notifications */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', marginBottom: '30px' }}>
        {/* Chart */}
        <div style={{
          padding: '20px',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0 }}>Analytics Overview</h3>
          <BarChart width={500} height={300} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="value" fill="#8884d8" />
          </BarChart>
        </div>

        {/* Notifications */}
        <div style={{
          padding: '20px',
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{ marginTop: 0 }}>🔔 Real-time Notifications</h3>
          {notifications.length === 0 ? (
            <p style={{ color: '#999', fontStyle: 'italic' }}>No new notifications</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {notifications.map((n, i) => (
                <li key={i} style={{
                  padding: '10px',
                  marginBottom: '5px',
                  background: '#f8f9fa',
                  borderRadius: '5px',
                  borderLeft: '3px solid #28a745'
                }}>
                  {n}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        marginBottom: '30px'
      }}>
        <h3 style={{ marginTop: 0 }}>📋 Recent Orders</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #eee' }}>
              <th style={{ textAlign: 'left', padding: '10px' }}>Order ID</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '10px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr>
                <td colSpan="4" style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                  No recent orders
                </td>
              </tr>
            ) : (
              recentOrders.map(order => (
                <tr key={order.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>#{order.id}</td>
                  <td style={{ padding: '10px' }}>${order.total_amount}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{
                      padding: '4px 8px',
                      background: order.status === 'completed' ? '#28a745' : '#ffc107',
                      color: order.status === 'completed' ? 'white' : 'black',
                      borderRadius: '3px',
                      fontSize: '12px'
                    }}>
                      {order.status || 'pending'}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button 
                      onClick={() => sendToClinician(order.id)}
                      style={{
                        padding: '5px 10px',
                        marginRight: '5px',
                        background: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Send to Clinician
                    </button>
                    <button 
                      onClick={() => printResults(order.id)}
                      style={{
                        padding: '5px 10px',
                        background: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Print
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Quick Actions */}
      <div style={{
        padding: '20px',
        background: 'white',
        borderRadius: '10px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h3 style={{ marginTop: 0 }}>⚡ Quick Actions</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            + New Order
          </button>
          <button style={{
            padding: '10px 20px',
            background: '#17a2b8',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            + Add Patient
          </button>
          <button style={{
            padding: '10px 20px',
            background: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            📊 Full Reports
          </button>
          <button style={{
            padding: '10px 20px',
            background: '#6f42c1',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}>
            🔬 Manage Tests
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;