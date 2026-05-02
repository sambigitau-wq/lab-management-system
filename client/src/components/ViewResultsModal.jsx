import React from 'react';

const ViewResultsModal = ({ order, results, onClose, formatKES, onPrint }) => {
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Lab Results - Order #${order.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.6; }
            .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #333; }
            .lab-name { font-size: 28px; font-weight: bold; color: #2563eb; }
            .lab-details { color: #666; font-size: 12px; margin-top: 5px; }
            .patient-info { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
            .patient-info p { margin: 5px 0; }
            .result-card { border: 1px solid #e2e8f0; padding: 20px; margin-bottom: 20px; border-radius: 8px; break-inside: avoid; }
            .test-name { font-size: 18px; font-weight: bold; margin-bottom: 15px; color: #1e293b; border-left: 4px solid #3b82f6; padding-left: 10px; }
            .result-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
            .label { font-weight: 600; color: #475569; display: block; margin-bottom: 3px; }
            .value { color: #0f172a; font-size: 15px; }
            .abnormal { color: #dc2626; font-weight: bold; background: #fee2e2; padding: 2px 8px; border-radius: 4px; display: inline-block; }
            .normal { color: #059669; background: #d1fae5; padding: 2px 8px; border-radius: 4px; display: inline-block; }
            .notes { margin-top: 15px; padding: 12px; background: #f1f5f9; border-radius: 6px; font-style: italic; }
            .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
            .disclaimer { font-size: 10px; color: #94a3b8; margin-top: 10px; }
            .signature-line { margin-top: 30px; border-top: 1px solid #333; width: 200px; margin: 30px auto 5px; }
            @media print {
              .no-print { display: none; }
              body { padding: 0.5in; }
              .result-card { break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="lab-name">${order.lab_name || 'Medical Laboratory'}</div>
            <div class="lab-details">
              ${order.lab_address || ''}<br>
              ${order.lab_phone ? `Tel: ${order.lab_phone}` : ''}
            </div>
            <h2 style="margin-top: 10px;">Laboratory Results Report</h2>
          </div>
          
          <div class="patient-info">
            <p><strong>Patient Name:</strong> ${order.patient_name}</p>
            <p><strong>Order #:</strong> ${order.id}</p>
            <p><strong>Date Collected:</strong> ${new Date(order.created_at).toLocaleString('en-KE')}</p>
            <p><strong>Date Reported:</strong> ${new Date().toLocaleString('en-KE')}</p>
            <p><strong>Referring Doctor:</strong> ${order.doctor_name || 'N/A'}</p>
          </div>
          
          <h3 style="margin-bottom: 15px;">Test Results Summary</h3>
          
          ${results.map(result => `
            <div class="result-card">
              <div class="test-name">${result.test_name}</div>
              <div class="result-grid">
                <div>
                  <span class="label">Result Value:</span>
                  <span class="value">${result.result_value || 'N/A'} ${result.result_unit || ''}</span>
                </div>
                <div>
                  <span class="label">Reference Range:</span>
                  <span class="value">${result.reference_range || 'N/A'}</span>
                </div>
                <div>
                  <span class="label">Status:</span>
                  <span class="${result.is_abnormal ? 'abnormal' : 'normal'}">
                    ${result.is_abnormal ? '⚠️ ABNORMAL' : '✓ Normal'}
                  </span>
                </div>
                <div>
                  <span class="label">Tested By:</span>
                  <span class="value">${result.tested_by_name || 'N/A'}</span>
                </div>
              </div>
              ${result.test_notes ? `
                <div class="notes">
                  <span class="label">Notes:</span> ${result.test_notes}
                </div>
              ` : ''}
            </div>
          `).join('')}
          
          <div class="footer">
            <div class="signature-line"></div>
            <p>Authorized Signature</p>
            <p>This is a computer generated report. No signature is required.</p>
            <p>Generated on ${new Date().toLocaleString('en-KE')}</p>
            <div class="disclaimer">
              * Reference ranges may vary based on age, gender, and other factors.<br>
              Please consult with a healthcare provider for proper interpretation.
            </div>
          </div>
          
          <div class="no-print" style="text-align: center; margin-top: 30px;">
            <button onclick="window.print()" style="padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; margin-right: 10px;">
              🖨️ Print / Save as PDF
            </button>
            <button onclick="window.close()" style="padding: 12px 24px; background: #64748b; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 14px;">
              Close Window
            </button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
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
      maxWidth: '800px',
      maxHeight: '90vh',
      overflowY: 'auto',
      boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
    },
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20px',
      paddingBottom: '15px',
      borderBottom: '2px solid #e2e8f0'
    },
    resultCard: {
      border: '1px solid #e2e8f0',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '15px',
      background: 'white'
    },
    badge: {
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '500'
    },
    button: {
      padding: '10px 20px',
      background: '#3b82f6',
      color: 'white',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '14px'
    },
    summary: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '15px',
      marginBottom: '20px',
      padding: '15px',
      background: '#f8fafc',
      borderRadius: '8px'
    }
  };

  // Calculate summary statistics
  const totalTests = results.length;
  const abnormalTests = results.filter(r => r.is_abnormal).length;
  const normalTests = totalTests - abnormalTests;

  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modalContent}>
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>📊 Test Results - Order #{order.id}</h2>
          <div>
            <button onClick={handlePrint} style={{ ...styles.button, background: '#10b981', marginRight: '10px' }}>
              🖨️ Print
            </button>
            <button onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>
              Close
            </button>
          </div>
        </div>
        
        {/* Patient Info */}
        <div style={{ 
          background: '#f8fafc', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '10px'
        }}>
          <p style={{ margin: 0 }}><strong>Patient:</strong> {order.patient_name}</p>
          <p style={{ margin: 0 }}><strong>Order #:</strong> {order.id}</p>
          <p style={{ margin: 0 }}><strong>Date:</strong> {new Date(order.created_at).toLocaleString('en-KE')}</p>
          <p style={{ margin: 0 }}><strong>Doctor:</strong> {order.doctor_name || 'N/A'}</p>
        </div>
        
        {/* Summary Stats */}
        <div style={styles.summary}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{totalTests}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Total Tests</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{normalTests}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Normal</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>{abnormalTests}</div>
            <div style={{ fontSize: '12px', color: '#64748b' }}>Abnormal</div>
          </div>
        </div>
        
        <hr style={{ margin: '20px 0' }} />
        
        {/* Results */}
        {results.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            <p style={{ fontSize: '16px' }}>No results available for this order</p>
          </div>
        ) : (
          results.map((result, index) => (
            <div key={index} style={styles.resultCard}>
              <h3 style={{ margin: '0 0 10px 0', color: '#1e293b' }}>{result.test_name}</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <p style={{ margin: '5px 0' }}>
                    <strong style={{ color: '#475569' }}>Result:</strong>{' '}
                    <span style={{ fontSize: '16px', fontWeight: '500' }}>
                      {result.result_value || 'N/A'} {result.result_unit || ''}
                    </span>
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong style={{ color: '#475569' }}>Reference Range:</strong>{' '}
                    {result.reference_range || 'N/A'}
                  </p>
                </div>
                <div>
                  <p style={{ margin: '5px 0' }}>
                    <strong style={{ color: '#475569' }}>Status:</strong>{' '}
                    <span style={{
                      ...styles.badge,
                      background: result.is_abnormal ? '#fee2e2' : '#d1fae5',
                      color: result.is_abnormal ? '#991b1b' : '#065f46'
                    }}>
                      {result.is_abnormal ? '⚠️ Abnormal' : '✅ Normal'}
                    </span>
                  </p>
                  <p style={{ margin: '5px 0' }}>
                    <strong style={{ color: '#475569' }}>Tested By:</strong>{' '}
                    {result.tested_by_name || 'N/A'}
                  </p>
                </div>
              </div>
              
              {result.test_notes && (
                <div style={{ 
                  marginTop: '15px', 
                  padding: '12px', 
                  background: '#f1f5f9', 
                  borderRadius: '6px',
                  borderLeft: '4px solid #3b82f6'
                }}>
                  <strong style={{ color: '#475569', display: 'block', marginBottom: '5px' }}>
                    Clinical Notes:
                  </strong>
                  <p style={{ margin: 0, fontStyle: 'italic' }}>{result.test_notes}</p>
                </div>
              )}
            </div>
          ))
        )}
        
        {/* Footer */}
        <div style={{ 
          marginTop: '20px', 
          padding: '15px', 
          background: '#f8fafc', 
          borderRadius: '8px',
          textAlign: 'center',
          fontSize: '12px',
          color: '#64748b'
        }}>
          <p style={{ margin: '5px 0' }}>
            This is a computer generated report. No signature is required.
          </p>
          <p style={{ margin: '5px 0' }}>
            Generated on {new Date().toLocaleString('en-KE')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ViewResultsModal;