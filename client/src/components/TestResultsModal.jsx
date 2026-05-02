import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const TestResultsModal = ({ order, tests, onClose, onComplete, token, API_URL, formatKES }) => {
  const [results, setResults] = useState([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Track if we've initialized for this specific order
  const initializedForOrder = useRef(null);
  
  // Hospital/Clinician Information
  const [hospitalInfo, setHospitalInfo] = useState({
    hospitalName: '',
    department: '',
    ward: '',
    bedNumber: '',
    
    referringDoctor: order?.doctor_name || '',
    referringDoctorPhone: '',
    referringDoctorEmail: order?.doctor_email || '',
    referringDoctorLicense: '',
    
    attendingDoctor: '',
    attendingDoctorPhone: '',
    attendingDoctorEmail: '',
    
    clinicalDiagnosis: '',
    clinicalNotes: '',
    specimenType: '',
    specimenCollectionDate: new Date().toISOString().split('T')[0],
    specimenCollectionTime: new Date().toTimeString().slice(0,5),
    
    priority: order?.priority || 'routine',
    insuranceProvider: '',
    insuranceNumber: '',
    consentObtained: false
  });

  // Initialize results only once when tests are first received
  useEffect(() => {
    if (tests && tests.length > 0) {
      if (initializedForOrder.current !== order?.id) {
        console.log('Initializing results for order:', order?.id);
        initializedForOrder.current = order?.id;
        
        const initialResults = tests.map(test => ({
          testId: test.id,
          testName: test.name,
          resultValue: test.result_value || '',
          resultUnit: test.result_unit || '',
          referenceRange: test.reference_range || '',
          isAbnormal: test.is_abnormal || false,
          testNotes: test.test_notes || '',
          performedBy: test.tested_by || '',
          saved: test.result_value ? true : false
        }));
        
        setResults(initialResults);
        setCurrentStep(1);
      }
    }
  }, [tests, order?.id]);

  const handleResultChange = (index, field, value) => {
    const newResults = [...results];
    newResults[index][field] = value;
    
    // Auto-detect abnormal based on reference range
    if (field === 'resultValue' && newResults[index].referenceRange) {
      const range = newResults[index].referenceRange;
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && range.includes('-')) {
        const [min, max] = range.split('-').map(Number);
        newResults[index].isAbnormal = numValue < min || numValue > max;
      }
    }
    
    setResults(newResults);
  };

  const handleSaveResult = async (index) => {
    const result = results[index];
    if (!result.resultValue) {
      alert('Please enter result value');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        `${API_URL}/api/orders/${order.id}/tests/${result.testId}/result`,
        {
          result_value: result.resultValue,
          result_unit: result.resultUnit,
          reference_range: result.referenceRange,
          is_abnormal: result.isAbnormal,
          test_notes: result.testNotes,
          performed_by: result.performedBy || 'Lab Technician',
          result_status: 'completed'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Mark this result as saved
      const newResults = [...results];
      newResults[index].saved = true;
      setResults(newResults);
      
      alert(`✅ Result saved for ${result.testName}`);
      
    } catch (err) {
      alert(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAll = async () => {
    // Get results that have values
    const enteredResults = results.filter(r => r.resultValue && r.resultValue.trim() !== '');
    
    if (enteredResults.length === 0) {
      alert('Please enter at least one result');
      return;
    }

    setLoading(true);
    let allSaved = true;
    let savedCount = 0;

    // Save all unsaved results
    for (let i = 0; i < results.length; i++) {
      if (results[i].resultValue && results[i].resultValue.trim() !== '' && !results[i].saved) {
        try {
          await axios.post(
            `${API_URL}/api/orders/${order.id}/tests/${results[i].testId}/result`,
            {
              result_value: results[i].resultValue,
              result_unit: results[i].resultUnit,
              reference_range: results[i].referenceRange,
              is_abnormal: results[i].isAbnormal,
              test_notes: results[i].testNotes,
              performed_by: results[i].performedBy || 'Lab Technician',
              result_status: 'completed'
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
          
          results[i].saved = true;
          savedCount++;
          
        } catch (err) {
          console.error(`Error saving ${results[i].testName}:`, err);
          allSaved = false;
        }
      } else if (results[i].resultValue && results[i].resultValue.trim() !== '' && results[i].saved) {
        savedCount++;
      }
    }

    setLoading(false);
    
    if (allSaved && savedCount > 0) {
      alert(`✅ ${savedCount} result(s) saved successfully!`);
    } else {
      alert('⚠️ Some results failed to save. Please check and try again.');
    }
  };

  // Function to go to step 2 - checks if ANY results have values
  const goToHospitalInfo = () => {
    const hasAnyResults = results.some(r => r.resultValue && r.resultValue.trim() !== '');
    
    if (!hasAnyResults) {
      alert('Please enter at least one result value first');
      return;
    }
    
    setCurrentStep(2);
  };

  // Function to go back to step 1
  const goBackToResults = () => {
    setCurrentStep(1);
  };

  const handleSubmitToClinician = async () => {
    if (!hospitalInfo.referringDoctorEmail && !hospitalInfo.attendingDoctorEmail) {
      alert('Please enter at least one doctor email address');
      return;
    }

    setLoading(true);
    try {
      const clinicianData = {
        clinicianEmail: hospitalInfo.referringDoctorEmail || hospitalInfo.attendingDoctorEmail,
        clinicianPhone: hospitalInfo.referringDoctorPhone || hospitalInfo.attendingDoctorPhone,
        sendEmail: true,
        sendSMS: false,
        feedback: hospitalInfo
      };

      const response = await axios.post(
        `${API_URL}/api/orders/${order.id}/send-to-clinician`,
        clinicianData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      alert('✅ Results sent to clinician successfully!');
      
      if (onComplete) onComplete();
      onClose();
      
    } catch (err) {
      alert(`❌ Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
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
      zIndex: 1000,
      backdropFilter: 'blur(4px)'
    },
    modalContent: {
      background: 'white',
      padding: '30px',
      borderRadius: '12px',
      width: '95%',
      maxWidth: '1000px',
      maxHeight: '90vh',
      overflowY: 'auto'
    },
    stepIndicator: {
      display: 'flex',
      marginBottom: '30px',
      borderBottom: '2px solid #e2e8f0',
      paddingBottom: '15px'
    },
    step: {
      flex: 1,
      textAlign: 'center',
      padding: '10px',
      fontWeight: 'bold',
      color: '#94a3b8',
      cursor: 'pointer'
    },
    activeStep: {
      color: '#3b82f6',
      borderBottom: '3px solid #3b82f6'
    },
    section: {
      background: '#f8fafc',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px'
    },
    sectionTitle: {
      margin: '0 0 15px 0',
      color: '#1e293b',
      fontSize: '16px',
      fontWeight: '600'
    },
    grid3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '15px'
    },
    grid2: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '15px'
    },
    input: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      fontSize: '14px'
    },
    textarea: {
      width: '100%',
      padding: '8px 12px',
      border: '1px solid #e2e8f0',
      borderRadius: '6px',
      fontSize: '14px',
      minHeight: '80px'
    },
    label: {
      display: 'block',
      marginBottom: '5px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#475569'
    },
    resultCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '20px',
      marginBottom: '15px',
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
      fontWeight: '500',
      margin: '0 5px'
    },
    buttonSuccess: { background: '#10b981' },
    buttonWarning: { background: '#f59e0b' },
    saveBadge: {
      background: '#d1fae5',
      color: '#065f46',
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      marginLeft: '10px'
    }
  };

  if (!tests || tests.length === 0) {
    return (
      <div style={styles.modal}>
        <div style={styles.modalContent}>
          <h3>No Tests Found</h3>
          <p>This order has no tests associated with it.</p>
          <button onClick={onClose} style={styles.button}>Close</button>
        </div>
      </div>
    );
  }

  // Check if any results have values (for enabling the Continue button)
  const hasAnyResults = results.some(r => r.resultValue && r.resultValue.trim() !== '');

  return (
    <div style={styles.modal}>
      <div style={styles.modalContent}>
        <h2 style={{ marginTop: 0 }}>
          {currentStep === 1 ? '🔬 Enter Test Results' : '🏥 Hospital/Clinician Information'}
        </h2>
        
        {/* Step Indicator - Clickable */}
        <div style={styles.stepIndicator}>
          <div 
            style={{ 
              ...styles.step, 
              ...(currentStep === 1 ? styles.activeStep : {})
            }}
            onClick={() => setCurrentStep(1)}
          >
            Step 1: Test Results
          </div>
          <div 
            style={{ 
              ...styles.step, 
              ...(currentStep === 2 ? styles.activeStep : {}),
              opacity: hasAnyResults ? 1 : 0.5,
              cursor: hasAnyResults ? 'pointer' : 'not-allowed'
            }}
            onClick={() => {
              if (hasAnyResults) {
                setCurrentStep(2);
              } else {
                alert('Please enter at least one result first');
              }
            }}
          >
            Step 2: Hospital/Clinician Details
          </div>
        </div>

        {/* Order Info */}
        <div style={{ ...styles.section, background: '#e6f0ff' }}>
          <div style={styles.grid3}>
            <div><strong>Order #:</strong> {order.id}</div>
            <div><strong>Patient:</strong> {order.patient_name}</div>
            <div><strong>Total:</strong> {formatKES(order.total_amount)}</div>
          </div>
        </div>

        {/* Step 1: Test Results */}
        {currentStep === 1 && (
          <>
            {results.map((result, index) => (
              <div key={index} style={styles.resultCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{result.testName}</h3>
                    {result.saved && <span style={styles.saveBadge}>✓ Saved</span>}
                  </div>
                </div>

                <div style={styles.grid3}>
                  <div>
                    <label style={styles.label}>Result Value *</label>
                    <input
                      type="text"
                      value={result.resultValue}
                      onChange={(e) => handleResultChange(index, 'resultValue', e.target.value)}
                      style={styles.input}
                      placeholder="e.g., 5.2"
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Unit</label>
                    <input
                      type="text"
                      value={result.resultUnit}
                      onChange={(e) => handleResultChange(index, 'resultUnit', e.target.value)}
                      style={styles.input}
                      placeholder="e.g., g/dL"
                    />
                  </div>
                  <div>
                    <label style={styles.label}>Reference Range</label>
                    <input
                      type="text"
                      value={result.referenceRange}
                      onChange={(e) => handleResultChange(index, 'referenceRange', e.target.value)}
                      style={styles.input}
                      placeholder="e.g., 4.0-6.0"
                    />
                  </div>
                </div>

                <div>
                  <label style={styles.label}>Performed By</label>
                  <input
                    type="text"
                    value={result.performedBy}
                    onChange={(e) => handleResultChange(index, 'performedBy', e.target.value)}
                    style={styles.input}
                    placeholder="Technician name"
                  />
                </div>

                <div>
                  <label style={styles.label}>Test Notes</label>
                  <textarea
                    value={result.testNotes}
                    onChange={(e) => handleResultChange(index, 'testNotes', e.target.value)}
                    style={styles.textarea}
                    placeholder="Any additional notes..."
                  />
                </div>

                {!result.saved && result.resultValue && (
                  <div style={{ marginTop: '15px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleSaveResult(index)}
                      style={{ ...styles.button, ...styles.buttonSuccess }}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save This Result'}
                    </button>
                  </div>
                )}
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
              <button onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
              
              <div>
                <button
                  onClick={handleSubmitAll}
                  style={{ ...styles.button, ...styles.buttonWarning }}
                  disabled={loading || !hasAnyResults}
                >
                  {loading ? 'Saving...' : 'Save All Results'}
                </button>
                
                <button
                  onClick={goToHospitalInfo}
                  style={{ ...styles.button, ...styles.buttonSuccess }}
                  disabled={!hasAnyResults}
                >
                  Continue to Hospital Info →
                </button>
              </div>
            </div>

            {hasAnyResults && (
              <p style={{ textAlign: 'center', color: '#10b981', marginTop: '10px' }}>
                ✅ Results entered! Click "Continue to Hospital Info →" above.
              </p>
            )}
          </>
        )}
{/* Step 2: Hospital/Clinician Information - CLEAN & ORGANIZED */}
{currentStep === 2 && (
  <>
    {/* Order Summary - Always show this */}
    <div style={{ ...styles.section, background: '#e6f0ff', marginBottom: '20px' }}>
      <div style={styles.grid3}>
        <div><strong>Order #:</strong> {order.id}</div>
        <div><strong>Patient:</strong> {order.patient_name}</div>
        <div><strong>Total:</strong> {formatKES(order.total_amount)}</div>
      </div>
    </div>

    {/* Section 1: Clinician Contact (MOST IMPORTANT) */}
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>📧 Send To</h3>
      <div style={styles.grid2}>
        <div>
          <label style={styles.label}>Doctor's Email *</label>
          <input
            type="email"
            value={hospitalInfo.referringDoctorEmail}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, referringDoctorEmail: e.target.value })}
            style={styles.input}
            placeholder="doctor@hospital.com"
            required
          />
        </div>
        <div>
          <label style={styles.label}>Doctor's Name</label>
          <input
            type="text"
            value={hospitalInfo.referringDoctor}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, referringDoctor: e.target.value })}
            style={styles.input}
            placeholder="Dr. John Smith"
          />
        </div>
      </div>
    </div>

    {/* Section 2: Clinical Context (Important for diagnosis) */}
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>🩺 Clinical Context</h3>
      <div style={styles.grid2}>
        <div>
          <label style={styles.label}>Hospital/Clinic</label>
          <input
            type="text"
            value={hospitalInfo.hospitalName}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, hospitalName: e.target.value })}
            style={styles.input}
            placeholder="e.g., Nairobi Hospital"
          />
        </div>
        <div>
          <label style={styles.label}>Department/Ward</label>
          <input
            type="text"
            value={hospitalInfo.department}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, department: e.target.value })}
            style={styles.input}
            placeholder="e.g., Cardiology, Ward 3A"
          />
        </div>
      </div>
      
      <div>
        <label style={styles.label}>Clinical Diagnosis/Notes</label>
        <textarea
          value={hospitalInfo.clinicalNotes}
          onChange={(e) => setHospitalInfo({ ...hospitalInfo, clinicalNotes: e.target.value })}
          style={{ ...styles.textarea, minHeight: '60px' }}
          placeholder="Suspected diagnosis, relevant symptoms, etc."
        />
      </div>
    </div>

    {/* Section 3: Specimen Information (Optional but helpful) */}
    <div style={styles.section}>
      <h3 style={styles.sectionTitle}>🧪 Specimen Details</h3>
      <div style={styles.grid3}>
        <div>
          <label style={styles.label}>Specimen Type</label>
          <select
            value={hospitalInfo.specimenType}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, specimenType: e.target.value })}
            style={styles.input}
          >
            <option value="">Select type</option>
            <option value="blood">Blood</option>
            <option value="urine">Urine</option>
            <option value="stool">Stool</option>
            <option value="tissue">Tissue</option>
            <option value="swab">Swab</option>
            <option value="csf">CSF</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style={styles.label}>Collection Date</label>
          <input
            type="date"
            value={hospitalInfo.specimenCollectionDate}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, specimenCollectionDate: e.target.value })}
            style={styles.input}
          />
        </div>
        <div>
          <label style={styles.label}>Collection Time</label>
          <input
            type="time"
            value={hospitalInfo.specimenCollectionTime}
            onChange={(e) => setHospitalInfo({ ...hospitalInfo, specimenCollectionTime: e.target.value })}
            style={styles.input}
          />
        </div>
      </div>
    </div>

    {/* Action Buttons */}
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
      <button onClick={goBackToResults} style={{ ...styles.button, background: '#64748b' }}>
        ← Back to Results
      </button>
      <div>
        <button onClick={onClose} style={{ ...styles.button, background: '#64748b', marginRight: '10px' }}>
          Cancel
        </button>
        <button
          onClick={handleSubmitToClinician}
          style={{ ...styles.button, ...styles.buttonSuccess }}
          disabled={loading || !hospitalInfo.referringDoctorEmail}
        >
          {loading ? '📤 Sending...' : '📤 Send Results to Clinician'}
        </button>
      </div>
    </div>

    {/* Helper text */}
    <p style={{ textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '15px' }}>
      * Email address is required. All other fields help provide context for the clinician.
    </p>
  </>
      )}
    </div>
  </div>
);
};

export default TestResultsModal;