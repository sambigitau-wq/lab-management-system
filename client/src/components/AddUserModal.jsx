import React, { useState } from 'react';
import axios from 'axios';

const AddUserModal = ({ onClose, onSave, token, API_URL }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'technician',
    permissions: {
      can_delete: false,
      can_edit: true,
      can_view_reports: true,
      can_manage_patients: true,
      can_manage_tests: true,
      can_process_payments: true
    }
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handlePermissionChange = (perm) => {
    setFormData({
      ...formData,
      permissions: {
        ...formData.permissions,
        [perm]: !formData.permissions[perm]
      }
    });
  };

  // In your AddUserModal.jsx, ensure the user is created with the current lab's ID
const handleSubmit = async (e) => {
  e.preventDefault();
  setLoading(true);
  try {
    // Get the current lab ID from localStorage or user context
    const labId = localStorage.getItem('labId');
    
    await axios.post(`${API_URL}/api/users`, {
      labId: labId,  // Use the CURRENT lab's ID
      email: formData.email,
      password: formData.password,
      name: formData.name,
      role: formData.role,
      permissions: formData.permissions
    }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    alert('✅ User created successfully!');
    onSave();
    onClose();
  } catch (err) {
    alert('❌ Error creating user: ' + (err.response?.data?.error || err.message));
  } finally {
    setLoading(false);
  }
};


  const styles = {
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: 'white',
      padding: '30px',
      borderRadius: '12px',
      width: '90%',
      maxWidth: '500px'
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      margin: '8px 0',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      fontSize: '14px'
    },
    select: {
      width: '100%',
      padding: '10px 12px',
      margin: '8px 0',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      fontSize: '14px',
      background: 'white'
    },
    button: {
      padding: '10px 20px',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px',
      margin: '5px'
    },
    buttonSuccess: {
      background: '#10b981'
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 style={{ marginTop: 0 }}>Add New User</h2>
        <form onSubmit={handleSubmit}>
          <div>
            <label>Full Name *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div>
            <label>Email *</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div>
            <label>Password *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              style={styles.input}
              required
            />
          </div>

          <div>
            <label>Role *</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="admin">Admin</option>
              <option value="technician">Lab Technician</option>
              <option value="assistant">Assistant Technician</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>

          <div style={{ marginTop: '20px' }}>
            <h4>Permissions</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_delete}
                  onChange={() => handlePermissionChange('can_delete')}
                /> Can Delete
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_edit}
                  onChange={() => handlePermissionChange('can_edit')}
                /> Can Edit
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_view_reports}
                  onChange={() => handlePermissionChange('can_view_reports')}
                /> View Reports
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_manage_patients}
                  onChange={() => handlePermissionChange('can_manage_patients')}
                /> Manage Patients
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_manage_tests}
                  onChange={() => handlePermissionChange('can_manage_tests')}
                /> Manage Tests
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={formData.permissions.can_process_payments}
                  onChange={() => handlePermissionChange('can_process_payments')}
                /> Process Payments
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>
              Cancel
            </button>
            <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }} disabled={loading}>
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddUserModal;