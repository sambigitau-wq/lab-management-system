import React, { useState, useEffect } from 'react';
import axios from 'axios';

const NotificationSettings = ({ token, API_URL, labId, onClose, onSave }) => {
  const [settings, setSettings] = useState({
    // Email settings
    email_enabled: true,
    email_smtp_host: 'smtp.gmail.com',
    email_smtp_port: 587,
    email_smtp_secure: false,
    email_auth_user: '',
    email_auth_pass: '',
    email_from_name: '',
    email_from_address: '',
    
    // SMS settings (Africa's Talking)
    sms_enabled: false,
    sms_provider: 'africastalking',
    sms_api_key: '',
    sms_username: '',
    sms_sender_id: '',
    
    // Notification triggers
    notify_on_referral_sent: true,
    notify_on_referral_received: true,
    notify_on_results_ready: true,
    notify_on_results_sent: true,
    notify_on_payment_received: true,
    notify_on_order_created: true,
    
    // Recipients
    send_to_clinician: true,
    send_to_patient: false,
    send_to_lab_admin: true,
    admin_emails: [],
    admin_phones: [],
    
    // Templates
    email_template_referral: '',
    email_template_results: '',
    sms_template_referral: '',
    sms_template_results: '',
    
    // WhatsApp (optional)
    whatsapp_enabled: false,
    whatsapp_business_id: '',
    whatsapp_access_token: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [testPhone, setTestPhone] = useState('');
  const [showTestModal, setShowTestModal] = useState(false);
  const [testType, setTestType] = useState('email'); // 'email' or 'sms'

  // Fetch existing settings
  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data) {
        setSettings(res.data);
      }
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/api/notification-settings`, settings, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Notification settings saved successfully!');
      if (onSave) onSave(settings);
    } catch (err) {
      alert('❌ Error saving settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };
const handleTestNotification = async () => {
  try {
    setLoading(true);
    
    if (testType === 'email') {
      // Test email
      const response = await axios.post(`${API_URL}/api/notifications/test-email`, {
        to: testEmail,
        settings: settings
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.simulated) {
        alert(`✅ Test email simulated! (Check console)\nIn production, this would send to: ${testEmail}`);
        console.log('Email would be sent:', response.data);
      } else {
        alert(`✅ Test email sent successfully to ${testEmail}!`);
      }
      
    } else {
      // Test SMS
      const response = await axios.post(`${API_URL}/api/notifications/test-sms`, {
        to: testPhone,
        settings: settings
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.simulated) {
        alert(`✅ Test SMS simulated! (Check console)\nIn production, this would send to: ${response.data.to}`);
        console.log('SMS would be sent:', response.data);
      } else {
        alert(`✅ Test SMS sent successfully to ${testPhone}!`);
      }
    }
    
    setShowTestModal(false);
    
  } catch (err) {
    console.error('Test error:', err);
    alert(`❌ Error: ${err.response?.data?.error || err.message}\n\nPlease check your settings.`);
  } finally {
    setLoading(false);
  }
};  const addAdminEmail = () => {
    const email = prompt('Enter admin email:');
    if (email && email.includes('@')) {
      setSettings({
        ...settings,
        admin_emails: [...settings.admin_emails, email]
      });
    }
  };

  const addAdminPhone = () => {
    const phone = prompt('Enter admin phone (e.g., 2547XXXXXXXX):');
    if (phone) {
      setSettings({
        ...settings,
        admin_phones: [...settings.admin_phones, phone]
      });
    }
  };

  const removeAdminEmail = (email) => {
    setSettings({
      ...settings,
      admin_emails: settings.admin_emails.filter(e => e !== email)
    });
  };

  const removeAdminPhone = (phone) => {
    setSettings({
      ...settings,
      admin_phones: settings.admin_phones.filter(p => p !== phone)
    });
  };

  const styles = {
    container: { padding: '20px', maxWidth: '800px', margin: '0 auto' },
    section: { 
      background: 'white', 
      padding: '20px', 
      borderRadius: '8px', 
      marginBottom: '20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    sectionTitle: { margin: '0 0 15px 0', color: '#333', fontSize: '18px' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
    input: { 
      width: '100%', 
      padding: '8px 12px', 
      border: '1px solid #ddd', 
      borderRadius: '4px',
      fontSize: '14px'
    },
    label: { display: 'block', marginBottom: '5px', fontWeight: '500', color: '#555' },
    checkbox: { marginRight: '8px' },
    checkboxLabel: { display: 'flex', alignItems: 'center', marginBottom: '10px' },
    button: { 
      padding: '10px 20px', 
      background: '#3b82f6', 
      color: 'white', 
      border: 'none', 
      borderRadius: '4px',
      cursor: 'pointer',
      fontSize: '14px',
      fontWeight: '500',
      marginRight: '10px'
    },
    buttonSuccess: { background: '#10b981' },
    buttonWarning: { background: '#f59e0b' },
    buttonDanger: { background: '#ef4444' },
    tagContainer: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
    tag: { 
      background: '#e2e8f0', 
      padding: '4px 8px', 
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      gap: '5px'
    },
    removeTag: { 
      cursor: 'pointer', 
      color: '#ef4444',
      fontWeight: 'bold',
      marginLeft: '5px'
    },
    modal: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    },
    modalContent: {
      background: 'white',
      padding: '30px',
      borderRadius: '8px',
      width: '90%',
      maxWidth: '400px'
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.container}>
      <h2>🔔 Notification Settings</h2>
      
      {/* Email Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📧 Email Configuration</h3>
        <div style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.email_enabled}
            onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })}
            style={styles.checkbox}
          />
          <span>Enable Email Notifications</span>
        </div>
        
        {settings.email_enabled && (
          <>
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>SMTP Host</label>
                <input
                  type="text"
                  value={settings.email_smtp_host}
                  onChange={(e) => setSettings({ ...settings, email_smtp_host: e.target.value })}
                  style={styles.input}
                  placeholder="smtp.gmail.com"
                />
              </div>
              <div>
                <label style={styles.label}>SMTP Port</label>
                <input
                  type="number"
                  value={settings.email_smtp_port}
                  onChange={(e) => setSettings({ ...settings, email_smtp_port: parseInt(e.target.value) })}
                  style={styles.input}
                  placeholder="587"
                />
              </div>
            </div>
            
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Email Username</label>
                <input
                  type="text"
                  value={settings.email_auth_user}
                  onChange={(e) => setSettings({ ...settings, email_auth_user: e.target.value })}
                  style={styles.input}
                  placeholder="your-email@gmail.com"
                />
              </div>
              <div>
                <label style={styles.label}>Email Password</label>
                <input
                  type="password"
                  value={settings.email_auth_pass}
                  onChange={(e) => setSettings({ ...settings, email_auth_pass: e.target.value })}
                  style={styles.input}
                  placeholder="app password"
                />
              </div>
            </div>
            
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>From Name</label>
                <input
                  type="text"
                  value={settings.email_from_name}
                  onChange={(e) => setSettings({ ...settings, email_from_name: e.target.value })}
                  style={styles.input}
                  placeholder="Your Lab Name"
                />
              </div>
              <div>
                <label style={styles.label}>From Email</label>
                <input
                  type="email"
                  value={settings.email_from_address}
                  onChange={(e) => setSettings({ ...settings, email_from_address: e.target.value })}
                  style={styles.input}
                  placeholder="noreply@yourlab.com"
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* SMS Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>📱 SMS Configuration (Africa's Talking)</h3>
        <div style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={settings.sms_enabled}
            onChange={(e) => setSettings({ ...settings, sms_enabled: e.target.checked })}
            style={styles.checkbox}
          />
          <span>Enable SMS Notifications</span>
        </div>
        
        {settings.sms_enabled && (
          <>
            <div>
              <label style={styles.label}>API Key</label>
              <input
                type="text"
                value={settings.sms_api_key}
                onChange={(e) => setSettings({ ...settings, sms_api_key: e.target.value })}
                style={styles.input}
                placeholder="Your Africa's Talking API Key"
              />
            </div>
            
            <div style={styles.grid2}>
              <div>
                <label style={styles.label}>Username</label>
                <input
                  type="text"
                  value={settings.sms_username}
                  onChange={(e) => setSettings({ ...settings, sms_username: e.target.value })}
                  style={styles.input}
                  placeholder="sandbox or your username"
                />
              </div>
              <div>
                <label style={styles.label}>Sender ID</label>
                <input
                  type="text"
                  value={settings.sms_sender_id}
                  onChange={(e) => setSettings({ ...settings, sms_sender_id: e.target.value })}
                  style={styles.input}
                  placeholder="YourLab or N/A"
                />
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Notification Triggers */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>🎯 Notification Triggers</h3>
        <div style={styles.grid2}>
          <div>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_referral_sent}
                onChange={(e) => setSettings({ ...settings, notify_on_referral_sent: e.target.checked })}
                style={styles.checkbox}
              />
              Referral Sent
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_referral_received}
                onChange={(e) => setSettings({ ...settings, notify_on_referral_received: e.target.checked })}
                style={styles.checkbox}
              />
              Referral Results Received
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_results_ready}
                onChange={(e) => setSettings({ ...settings, notify_on_results_ready: e.target.checked })}
                style={styles.checkbox}
              />
              Test Results Ready
            </label>
          </div>
          
          <div>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_results_sent}
                onChange={(e) => setSettings({ ...settings, notify_on_results_sent: e.target.checked })}
                style={styles.checkbox}
              />
              Results Sent to Clinician
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_payment_received}
                onChange={(e) => setSettings({ ...settings, notify_on_payment_received: e.target.checked })}
                style={styles.checkbox}
              />
              Payment Received
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.notify_on_order_created}
                onChange={(e) => setSettings({ ...settings, notify_on_order_created: e.target.checked })}
                style={styles.checkbox}
              />
              New Order Created
            </label>
          </div>
        </div>
      </div>
      
      {/* Recipients */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>👥 Recipients</h3>
        
        <div style={styles.grid2}>
          <div>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.send_to_clinician}
                onChange={(e) => setSettings({ ...settings, send_to_clinician: e.target.checked })}
                style={styles.checkbox}
              />
              Send to Clinician
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.send_to_patient}
                onChange={(e) => setSettings({ ...settings, send_to_patient: e.target.checked })}
                style={styles.checkbox}
              />
              Send to Patient
            </label>
            
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={settings.send_to_lab_admin}
                onChange={(e) => setSettings({ ...settings, send_to_lab_admin: e.target.checked })}
                style={styles.checkbox}
              />
              Send to Lab Admin
            </label>
          </div>
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <h4>Admin Emails</h4>
          <div style={styles.tagContainer}>
            {settings.admin_emails.map(email => (
              <span key={email} style={styles.tag}>
                {email}
                <span style={styles.removeTag} onClick={() => removeAdminEmail(email)}>×</span>
              </span>
            ))}
            <button onClick={addAdminEmail} style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }}>
              + Add Email
            </button>
          </div>
        </div>
        
        <div style={{ marginTop: '20px' }}>
          <h4>Admin Phone Numbers</h4>
          <div style={styles.tagContainer}>
            {settings.admin_phones.map(phone => (
              <span key={phone} style={styles.tag}>
                {phone}
                <span style={styles.removeTag} onClick={() => removeAdminPhone(phone)}>×</span>
              </span>
            ))}
            <button onClick={addAdminPhone} style={{ ...styles.button, padding: '4px 8px', fontSize: '12px' }}>
              + Add Phone
            </button>
          </div>
        </div>
      </div>
      
      {/* Test Buttons */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          style={{ ...styles.button, ...styles.buttonSuccess }}
          onClick={() => {
            setTestType('email');
            setShowTestModal(true);
          }}
        >
          Test Email
        </button>
        <button 
          style={{ ...styles.button, ...styles.buttonWarning }}
          onClick={() => {
            setTestType('sms');
            setShowTestModal(true);
          }}
        >
          Test SMS
        </button>
      </div>
      
      {/* Save Button */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button style={styles.button} onClick={handleSave}>
          Save Settings
        </button>
        <button style={{ ...styles.button, background: '#64748b' }} onClick={onClose}>
          Close
        </button>
      </div>
      
      {/* Test Modal */}
      {showTestModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h3>Send Test {testType === 'email' ? 'Email' : 'SMS'}</h3>
            <div style={{ marginTop: '20px' }}>
              <label style={styles.label}>
                {testType === 'email' ? 'Email Address' : 'Phone Number'}
              </label>
              <input
                type={testType === 'email' ? 'email' : 'tel'}
                value={testType === 'email' ? testEmail : testPhone}
                onChange={(e) => {
                  if (testType === 'email') {
                    setTestEmail(e.target.value);
                  } else {
                    setTestPhone(e.target.value);
                  }
                }}
                style={styles.input}
                placeholder={testType === 'email' ? 'admin@example.com' : '2547XXXXXXXX'}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button style={styles.button} onClick={handleTestNotification}>
                Send Test
              </button>
              <button style={{ ...styles.button, background: '#64748b' }} onClick={() => setShowTestModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;