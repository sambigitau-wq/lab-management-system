import React, { useState } from 'react';
import axios from 'axios';

const EditTestModal = ({ test, onClose, onSave, token, API_URL, formatKES }) => {
  const [formData, setFormData] = useState({
    name: test.name || '',
    category: test.category || 'blood',
    price: test.price || '',
    description: test.description || '',
    turnaround_time: test.turnaround_time || '24 hours',
    sample_type: test.sample_type || 'Blood'
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.put(`${API_URL}/api/tests/${test.id}`, {
        ...formData,
        price: parseFloat(formData.price)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert('✅ Test updated successfully!');
      onSave();
      onClose();
    } catch (err) {
      alert('❌ Error updating test: ' + (err.response?.data?.error || err.message));
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
      maxWidth: '600px'
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
        <h2 style={{ marginTop: 0 }}>Edit Test: {test.name}</h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.grid2}>
            <div>
              <label>Test Name *</label>
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
              <label>Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="blood">Blood Tests</option>
                <option value="urine">Urine Tests</option>
                <option value="imaging">Imaging</option>
                <option value="cardiac">Cardiac</option>
                <option value="hormone">Hormone</option>
              </select>
            </div>
          </div>

          <div style={styles.grid2}>
            <div>
              <label>Price (KES) *</label>
              <input
                type="number"
                name="price"
                step="100"
                value={formData.price}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>
            <div>
              <label>Sample Type</label>
              <select
                name="sample_type"
                value={formData.sample_type}
                onChange={handleChange}
                style={styles.select}
              >
                <option value="Blood">Blood</option>
                <option value="Urine">Urine</option>
                <option value="Stool">Stool</option>
                <option value="Saliva">Saliva</option>
              </select>
            </div>
          </div>

          <div>
            <label>Turnaround Time</label>
            <select
              name="turnaround_time"
              value={formData.turnaround_time}
              onChange={handleChange}
              style={styles.select}
            >
              <option value="1 hour">1 hour</option>
              <option value="2 hours">2 hours</option>
              <option value="4 hours">4 hours</option>
              <option value="8 hours">8 hours</option>
              <option value="24 hours">24 hours</option>
              <option value="48 hours">48 hours</option>
            </select>
          </div>

          <div>
            <label>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              style={{ ...styles.input, minHeight: '60px' }}
            />
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

export default EditTestModal;