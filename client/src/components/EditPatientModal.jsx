import React, { useState } from 'react';
import axios from 'axios';

const EditPatientModal = ({ patient, onClose, onSave, token, API_URL, formatPhone }) => {
  const [formData, setFormData] = useState({
    name: patient.name || '',
    phone: patient.phone || '07',
    email: patient.email || '',
    address: patient.address || '',
    date_of_birth: patient.date_of_birth || '',
    gender: patient.gender || '',
    blood_group: patient.blood_group || '',
    id_number: patient.id_number || '',
    emergency_contact: patient.emergency_contact || '',
    emergency_phone: patient.emergency_phone || '07'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const dataToSend = {
        ...formData,
        phone: formatPhone(formData.phone),
        emergency_phone: formatPhone(formData.emergency_phone)
      };
      
      await axios.put(`${API_URL}/api/patients/${patient.id}`, dataToSend, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('✅ Patient updated successfully!');
      onSave();
      onClose();
    } catch (err) {
      alert('❌ Error updating patient: ' + (err.response?.data?.error || err.message));
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
      maxWidth: '600px',
      maxHeight: '90vh',
      overflowY: 'auto'
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
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '15px'
    }
  };

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <h2 style={{ marginTop: 0 }}>Edit Patient: {patient.name}</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.grid2}>
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
              <label>ID Number</label>
              <input
                type="text"
                name="id_number"
                value={formData.id_number}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div>
              <label>Phone *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>
            <div>
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.grid2}>
            <div>
              <label>Date of Birth</label>
              <input
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
            <div>
              <label>Gender</label>
              <select
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div>
              <label>Blood Group</label>
              <select
                name="blood_group"
                value={formData.blood_group}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <div>
            <label>Address</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              style={{ ...styles.input, minHeight: '60px' }}
            />
          </div>

          <div style={styles.grid2}>
            <div>
              <label>Emergency Contact</label>
              <input
                type="text"
                name="emergency_contact"
                value={formData.emergency_contact}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
            <div>
              <label>Emergency Phone</label>
              <input
                type="tel"
                name="emergency_phone"
                value={formData.emergency_phone}
                onChange={handleChange}
                style={styles.input}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>
              Cancel
            </button>
            <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPatientModal;