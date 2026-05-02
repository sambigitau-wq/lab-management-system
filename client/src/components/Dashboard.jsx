import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import LabLogo from './LabLogo';

// Import Modals
import TestResultsModal from './TestResultsModal';
import EditPatientModal from './EditPatientModal';
import EditTestModal from './EditTestModal';
import ViewResultsModal from './ViewResultsModal';
import AddUserModal from './AddUserModal';
import POSDashboard from './POSDashboard';
import NotificationSettings from './NotificationSettings';

// Initialize Socket
const socket = io('http://localhost:5002', {
  auth: { token: localStorage.getItem('token') }
});

// ==================== CONSTANTS ====================
const API_URL = 'http://localhost:5002';
const TABS = [
  { id: 'overview', icon: '📊', label: 'Overview' },
  { id: 'labs', icon: '🏢', label: 'Labs' },
  { id: 'patients', icon: '👥', label: 'Patients' },
  { id: 'tests', icon: '🔬', label: 'Tests Catalog' },
  { id: 'orders', icon: '📋', label: 'Orders' },
  { id: 'invoices', icon: '💰', label: 'Invoices' },
  { id: 'analytics', icon: '📈', label: 'Analytics' },
  { id: 'activity', icon: '📝', label: 'Activity Log' },
  { id: 'users', icon: '👥', label: 'Users' },
  { id: 'pos', icon: '🛒', label: 'POS' },
  { id: 'referrals', icon: '🔄', label: 'Referrals' },
  { id: 'settings', icon: '⚙️', label: 'Settings' }
];

// ==================== STYLES ====================
const styles = {
  container: { display: 'flex', minHeight: '100vh', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' },
  sidebar: { width: '280px', background: 'linear-gradient(180deg, #1a1f2e 0%, #2d3748 100%)', color: 'white', padding: '25px 0', boxShadow: '2px 0 10px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', height: '100vh', position: 'sticky', top: 0 },
  main: { flex: 1, background: '#f8fafc', padding: '30px', overflowY: 'auto' },
  navItem: { padding: '12px 25px', margin: '5px 15px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.3s', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '15px' },
  card: { background: 'white', padding: '25px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', marginBottom: '25px', border: '1px solid #edf2f7' },
  button: { padding: '10px 20px', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500', transition: 'all 0.2s' },
  buttonSecondary: { background: '#64748b' },
  buttonSuccess: { background: '#10b981' },
  buttonDanger: { background: '#ef4444' },
  buttonWarning: { background: '#f59e0b' },
  input: { width: '100%', padding: '10px 12px', margin: '8px 0', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', transition: 'border-color 0.2s', boxSizing: 'border-box' },
  select: { width: '100%', padding: '10px 12px', margin: '8px 0', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', background: 'white' },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden' },
  th: { background: '#f8fafc', padding: '15px', textAlign: 'left', fontWeight: '600', fontSize: '14px', color: '#475569', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '15px', borderBottom: '1px solid #e2e8f0', fontSize: '14px', color: '#334155' },
  badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' },
  modalContent: { background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '20px' },
  statCard: { padding: '20px', borderRadius: '10px', color: 'white', position: 'relative', overflow: 'hidden' },
  navSection: { flex: 1, overflowY: 'auto' },
  logoutSection: { padding: '20px 25px', borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: 'auto' },
  alertCard: { background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px', padding: '15px', marginBottom: '20px' },
  alertTitle: { color: '#856404', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px' },
  alertItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px', borderBottom: '1px solid #ffe69c' },
  revenueBreakdown: { fontSize: '14px', color: '#f8fafc', marginTop: '5px' },
  warningCard: { background: '#fff3cd', border: '1px solid #ffeeba', borderRadius: '8px', padding: '20px', marginBottom: '20px' },
  successCard: { background: '#d1fae5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '20px', marginBottom: '20px' },
  errorText: { color: '#ef4444', fontSize: '14px', marginTop: '5px' }
};

// ==================== UTILITY FUNCTIONS ====================
const formatKES = (amount) => {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0
  }).format(amount || 0);
};

const formatPhone = (phone) => {
  if (!phone) return '';
  if (phone.startsWith('07')) return '+254' + phone.substring(1);
  return phone;
};

const readFileAsBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const compressImage = (base64Data, maxWidth, maxHeight) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Data;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width *= maxHeight / height;
          height = maxHeight;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
  });
};

// ==================== MAIN DASHBOARD COMPONENT ====================
const Dashboard = ({ token }) => {
  // ==================== STATE ====================
  const [activeTab, setActiveTab] = useState('overview');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  
  // Data States
  const [labs, setLabs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [tests, setTests] = useState([]);
  const [orders, setOrders] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [filteredActivityLogs, setFilteredActivityLogs] = useState([]);
  const [activityFilters, setActivityFilters] = useState({ actions: [], entity_types: [] });
  const [summary, setSummary] = useState({ orders: {}, payments: {} });
  const [users, setUsers] = useState([]);
  const [exportLogs, setExportLogs] = useState([]);
  
  // POS States
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [posSales, setPosSales] = useState([]);
  const [posRevenue, setPosRevenue] = useState({ today: 0, week: 0, month: 0, total: 0 });
  const [labRevenue, setLabRevenue] = useState({ today: 0, week: 0, month: 0, total: 0 });
  const [showStockAlerts, setShowStockAlerts] = useState(true);
  
  // Referral States
  const [referenceLabs, setReferenceLabs] = useState([]);
  const [referrals, setReferrals] = useState([]);
  const [referralTests, setReferralTests] = useState([]);
  const [referralResultsData, setReferralResultsData] = useState(null);
  
  // Filter States
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  
  // Modal States
  const [showAddLab, setShowAddLab] = useState(false);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [showAddTest, setShowAddTest] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [showTestResult, setShowTestResult] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showEditPatient, setShowEditPatient] = useState(false);
  const [showEditTest, setShowEditTest] = useState(false);
  const [showViewResults, setShowViewResults] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [showAddReferenceLab, setShowAddReferenceLab] = useState(false);
  const [showLogoUpload, setShowLogoUpload] = useState(false);
  const [showOverpaymentModal, setShowOverpaymentModal] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [showReceiveResultsModal, setShowReceiveResultsModal] = useState(false);
  const [showViewReferralResults, setShowViewReferralResults] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showExportLogs, setShowExportLogs] = useState(false);
  
  // Selected Item States
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderTests, setSelectedOrderTests] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null);
  const [editingTest, setEditingTest] = useState(null);
  const [viewResultsData, setViewResultsData] = useState([]);
  const [selectedReferral, setSelectedReferral] = useState(null);
  const [selectedReferralForResults, setSelectedReferralForResults] = useState(null);
  const [notificationSettings, setNotificationSettings] = useState(null);
  
  // Form States
  const [newLab, setNewLab] = useState({
    company_name: '', name: '', email: '', password: '', phone: '',
    address: '', website: '', subscription_plan: 'basic', kra_pin: '', business_reg: ''
  });
  
  const [newPatient, setNewPatient] = useState({
    name: '', phone: '07', email: '', address: '', date_of_birth: '',
    gender: '', blood_group: '', id_number: '', emergency_contact: '', emergency_phone: '07'
  });
  
  const [newTest, setNewTest] = useState({
    name: '', category: 'blood', price: '', description: '',
    turnaround_time: '24 hours', sample_type: 'Blood'
  });
  
  const [newOrder, setNewOrder] = useState({
    patientId: '', testIds: [], notes: '', doctor_name: '', doctor_email: '', priority: 'normal'
  });
  
  const [payment, setPayment] = useState({
    amount: '', method: 'cash', mpesa_code: '', notes: ''
  });
  
  const [overpaymentData, setOverpaymentData] = useState({
    amount: 0, remainingBalance: 0, action: 'credit'
  });
  
  const [manualResults, setManualResults] = useState({
    results_text: '', result_file: null, result_date: new Date().toISOString().split('T')[0],
    conducted_by: '', notes: '', test_results: []
  });
  
  const [referralResults, setReferralResults] = useState('');
  const [referralFile, setReferralFile] = useState(null);
  
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState('');

  // ==================== COMPUTED VALUES ====================
  const combinedRevenue = useMemo(() => ({
    today: (labRevenue.today || 0) + (posRevenue.today || 0),
    week: (labRevenue.week || 0) + (posRevenue.week || 0),
    month: (labRevenue.month || 0) + (posRevenue.month || 0),
    total: (labRevenue.total || 0) + (posRevenue.total || 0)
  }), [labRevenue, posRevenue]);

  const completedReferrals = useMemo(() => 
    referrals.filter(r => r.status === 'completed'), [referrals]
  );

  // ==================== DATA FETCHING ====================
  const fetchUserData = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      console.error('Error fetching user:', err);
      const storedUser = localStorage.getItem('user');
      if (storedUser) setUser(JSON.parse(storedUser));
    }
  }, [token]);

  const fetchPOSProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lowStock = res.data.filter(p => p.stock_quantity <= p.low_stock_threshold);
      setLowStockProducts(lowStock);
      return res.data;
    } catch (err) {
      console.error('Error fetching POS products:', err);
      return [];
    }
  }, [token]);

  const fetchPOSSales = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pos/sales?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const salesData = res.data || [];
      const validSales = salesData.filter(sale => sale && sale.id);
      setPosSales(validSales);
      
      const today = new Date().toISOString().split('T')[0];
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
      
      setPosRevenue({
        today: validSales.filter(s => new Date(s.created_at).toISOString().split('T')[0] === today).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0),
        week: validSales.filter(s => new Date(s.created_at) >= weekAgo).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0),
        month: validSales.filter(s => new Date(s.created_at) >= monthAgo).reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0),
        total: validSales.reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0)
      });
    } catch (err) {
      console.error('Error fetching POS sales:', err);
      setPosSales([]);
    }
  }, [token]);

  const calculateLabRevenue = useCallback((ordersData) => {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
    
    setLabRevenue({
      today: ordersData.filter(o => new Date(o.created_at).toISOString().split('T')[0] === today && o.paid_amount > 0).reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0),
      week: ordersData.filter(o => new Date(o.created_at) >= weekAgo && o.paid_amount > 0).reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0),
      month: ordersData.filter(o => new Date(o.created_at) >= monthAgo && o.paid_amount > 0).reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0),
      total: ordersData.filter(o => o.paid_amount > 0).reduce((sum, o) => sum + (parseFloat(o.paid_amount) || 0), 0)
    });
  }, []);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      
      const [
        summaryRes, labsRes, patientsRes, testsRes, ordersRes,
        invoicesRes, logsRes, usersRes, exportLogsRes
      ] = await Promise.all([
        axios.get(`${API_URL}/api/reports/summary?period=daily`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { orders: {}, payments: {} } })),
        axios.get(`${API_URL}/api/labs`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/patients`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/tests`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/orders?limit=20`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/invoices`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/activity-logs?limit=50`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: { logs: [], filters: {} } })),
        axios.get(`${API_URL}/api/users`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] })),
        axios.get(`${API_URL}/api/export-logs`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => ({ data: [] }))
      ]);
      
      setSummary(summaryRes.data);
      setLabs(labsRes.data);
      setPatients(patientsRes.data);
      setTests(testsRes.data);
      setOrders(ordersRes.data);
      setInvoices(invoicesRes.data);
      setActivityLogs(logsRes.data.logs || []);
      setFilteredActivityLogs(logsRes.data.logs || []);
      setActivityFilters(logsRes.data.filters || { actions: [], entity_types: [] });
      setUsers(usersRes.data);
      setExportLogs(exportLogsRes.data || []);
      
      calculateLabRevenue(ordersRes.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, calculateLabRevenue]);

  const fetchReferenceLabs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/reference-labs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferenceLabs(res.data);
    } catch (err) {
      console.error('Error fetching reference labs:', err);
      setReferenceLabs([]);
    }
  }, [token]);

  const fetchReferrals = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/referrals`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferrals(res.data);
    } catch (err) {
      console.error('Error fetching referrals:', err);
    }
  }, [token]);

  const fetchNotificationSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/notification-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNotificationSettings(res.data);
    } catch (err) {
      console.error('Error fetching notification settings:', err);
    }
  }, [token]);

  // ==================== ACTION HANDLERS ====================
  const handleAddLab = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/labs`, newLab, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Lab "${newLab.company_name}" registered successfully!`);
      setShowAddLab(false);
      resetLabForm();
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error creating lab: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddPatient = async (e) => {
    e.preventDefault();
    try {
      const patientData = {
        ...newPatient,
        phone: formatPhone(newPatient.phone),
        emergency_phone: formatPhone(newPatient.emergency_phone)
      };
      
      await axios.post(`${API_URL}/api/patients`, patientData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`✅ Patient ${newPatient.name} added successfully!`);
      setShowAddPatient(false);
      resetPatientForm();
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error adding patient: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddTest = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/api/tests`, {
        ...newTest, price: parseFloat(newTest.price)
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      alert(`✅ Test "${newTest.name}" added successfully!`);
      setShowAddTest(false);
      resetTestForm();
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error adding test: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    try {
      const selectedTests = tests.filter(t => newOrder.testIds.includes(t.id));
      const totalAmount = selectedTests.reduce((sum, test) => sum + test.price, 0);
      
      const res = await axios.post(`${API_URL}/api/orders`, {
        ...newOrder, totalAmount, labId: localStorage.getItem('labId')
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      socket.emit('newOrder', { orderId: res.data.orderId });
      alert(`✅ Order #${res.data.orderId} created successfully!`);
      setShowCreateOrder(false);
      resetOrderForm();
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error creating order: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddPayment = async (e) => {
    e.preventDefault();
    
    const orderTotal = selectedOrder.total_amount;
    const amountPaidSoFar = selectedOrder.paid_amount || 0;
    const remainingBalance = orderTotal - amountPaidSoFar;
    const paymentAmount = parseFloat(payment.amount);
    
    if (!payment.amount || paymentAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (paymentAmount > remainingBalance) {
      setOverpaymentData({
        amount: paymentAmount,
        remainingBalance: remainingBalance,
        overage: paymentAmount - remainingBalance
      });
      setShowOverpaymentModal(true);
      return;
    }
    
    if (paymentAmount < remainingBalance) {
      if (!window.confirm(`You are paying ${formatKES(paymentAmount)}.\nRemaining balance will be: ${formatKES(remainingBalance - paymentAmount)}\n\nContinue with partial payment?`)) {
        return;
      }
    }
    
    await processPayment(paymentAmount, remainingBalance);
  };

  const processPayment = async (amountToPay, remainingBalance) => {
    try {
      const res = await axios.post(`${API_URL}/api/orders/${selectedOrder.id}/payment`, {
        amount: amountToPay,
        method: payment.method,
        mpesa_code: payment.mpesa_code || null,
        notes: payment.notes || `Payment of ${formatKES(amountToPay)} for order #${selectedOrder.id}`
      }, { headers: { Authorization: `Bearer ${token}` } });
      
      const newPaidAmount = (selectedOrder.paid_amount || 0) + amountToPay;
      const isFullyPaid = newPaidAmount >= selectedOrder.total_amount;
      
      let message = `✅ Payment of ${formatKES(amountToPay)} received!\n`;
      if (res.data.receiptNumber) message += `Receipt #: ${res.data.receiptNumber}\n`;
      message += isFullyPaid ? '🎉 Order fully paid!' : `Remaining balance: ${formatKES(remainingBalance - amountToPay)}`;
      
      alert(message);
      
      setShowPayment(false);
      resetPaymentForm();
      
      if (isFullyPaid) {
        try {
          await axios.post(`${API_URL}/api/orders/${selectedOrder.id}/generate-invoice`, {}, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (invoiceErr) {
          console.log('Invoice generation:', invoiceErr.response?.data || invoiceErr.message);
        }
      }
      
      await fetchDashboardData();
      await fetchPOSSales();
      await fetchPOSProducts();
    } catch (err) {
      console.error('Payment error:', err.response?.data || err);
      alert(`❌ Error adding payment: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleOverpaymentAction = async (action) => {
    setShowOverpaymentModal(false);
    
    const { amount: paymentAmount, remainingBalance, overage } = overpaymentData;
    
    if (action === 'credit') {
      if (window.confirm(`Bill: ${formatKES(remainingBalance)}\nPaid: ${formatKES(paymentAmount)}\nCredit: ${formatKES(overage)} will be added as store credit.\n\nContinue?`)) {
        setPayment({ ...payment, notes: `Payment of ${formatKES(paymentAmount)}. Store credit of ${formatKES(overage)} added.` });
        await processPayment(paymentAmount, remainingBalance);
      }
    } else {
      if (window.confirm(`Bill: ${formatKES(remainingBalance)}\nYou will pay exactly ${formatKES(remainingBalance)}.\n${formatKES(overage)} will be refunded to customer.\n\nContinue?`)) {
        setPayment({ ...payment, amount: remainingBalance.toString(), notes: `Exact payment of ${formatKES(remainingBalance)}. Overpayment of ${formatKES(overage)} refunded.` });
        await processPayment(remainingBalance, remainingBalance);
      }
    }
  };

  const handleDeleteInvoice = async (invoice) => {
    if (user?.role !== 'admin' && !user?.permissions?.can_delete) {
      alert('❌ You do not have permission to delete invoices');
      return;
    }
    
    if (!invoice || !invoice.id) {
      alert('❌ Invalid invoice data');
      return;
    }
    
    if (!window.confirm(`⚠️ DELETE INVOICE #${invoice.invoice_number}\nAmount: ${formatKES(invoice.total || 0)}\nThis action CANNOT be undone!\n\nAre you sure?`)) return;
    if (window.prompt('Type "DELETE" to confirm:') !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/invoices/${invoice.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Invoice #${invoice.invoice_number} deleted successfully`);
      setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
      await fetchDashboardData();
    } catch (err) {
      console.error('Delete invoice error:', err.response?.data || err);
      if (err.response?.status === 404) {
        alert('❌ Invoice not found. It may have been already deleted.');
        setInvoices(prev => prev.filter(inv => inv.id !== invoice.id));
      } else {
        alert('❌ Error deleting invoice: ' + (err.response?.data?.error || err.message));
      }
    }
  };

  const handleGenerateInvoice = async (orderId) => {
    try {
      const res = await axios.post(`${API_URL}/api/orders/${orderId}/generate-invoice`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Invoice #${res.data.invoice_number} generated!`);
      fetchDashboardData();
    } catch (err) {
      console.error('Generate invoice error:', err.response?.data);
      alert('❌ Error generating invoice: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteLab = async (lab) => {
    if (!window.confirm(`⚠️ Delete lab "${lab.company_name || lab.name}"?\n\nThis will permanently delete ALL data!`)) return;
    if (window.prompt('Type "DELETE" to confirm permanent deletion:') !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/labs/${lab.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Lab deleted successfully`);
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error deleting lab: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeletePatient = async (patient) => {
    if (!window.confirm(`Are you sure you want to delete patient ${patient.name}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/patients/${patient.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Patient deleted successfully');
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error deleting patient: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteTest = async (test) => {
    if (!window.confirm(`Are you sure you want to delete test ${test.name}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/tests/${test.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Test deleted successfully');
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error deleting test: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteOrder = async (order) => {
    if (!window.confirm(`Are you sure you want to delete order #${order.id}?`)) return;
    try {
      await axios.delete(`${API_URL}/api/orders/${order.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Order deleted successfully');
      fetchDashboardData();
    } catch (err) {
      alert('❌ Error deleting order: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDeleteSale = async (saleId, receiptNumber) => {
    if (user?.role !== 'admin') {
      alert('❌ Only admins can delete sales');
      return;
    }
    
    if (!window.confirm(`⚠️ DELETE SALE #${receiptNumber}\nThis will restore all products to inventory and CANNOT be undone!\n\nAre you absolutely sure?`)) return;
    if (window.prompt('Type "DELETE" to confirm permanent deletion:') !== 'DELETE') {
      alert('Deletion cancelled');
      return;
    }
    
    try {
      await axios.delete(`${API_URL}/api/pos/sales/${saleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Sale #${receiptNumber} deleted successfully!`);
      await Promise.all([fetchPOSSales(), fetchPOSProducts(), fetchDashboardData()]);
    } catch (err) {
      console.error('Delete error:', err.response?.data || err);
      alert('❌ Error deleting sale: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleCreateReferral = async (referralData) => {
    try {
      await axios.post(`${API_URL}/api/referrals`, referralData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Referral sent successfully');
      setShowReferralModal(false);
      fetchReferrals();
    } catch (err) {
      alert('❌ Error sending referral: ' + err.message);
    }
  };

  const handleOpenReceiveResults = async (referral) => {
    try {
      setSelectedReferralForResults(referral);
      
      const res = await axios.get(`${API_URL}/api/referrals/${referral.id}/tests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setReferralTests(res.data || []);
      setManualResults({
        results_text: '',
        result_file: null,
        result_date: new Date().toISOString().split('T')[0],
        conducted_by: '',
        notes: '',
        test_results: (res.data || []).map(test => ({
          test_id: test.id,
          test_name: test.name,
          result_value: '',
          reference_range: test.reference_range || '',
          unit: test.unit || '',
          interpretation: 'normal',
          notes: ''
        }))
      });
      
      setShowReceiveResultsModal(true);
    } catch (err) {
      console.error('Error loading referral tests:', err);
      alert('Error loading referral tests: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveManualResults = async (e) => {
    e.preventDefault();
    
    if (!selectedReferralForResults) return;
    
    try {
      const hasResults = manualResults.test_results.some(tr => tr.result_value?.trim());
      if (!hasResults && !manualResults.results_text) {
        alert('Please enter at least one test result or summary text');
        return;
      }
      
      const formData = new FormData();
      formData.append('results_text', manualResults.results_text);
      formData.append('result_date', manualResults.result_date);
      formData.append('conducted_by', manualResults.conducted_by);
      formData.append('notes', manualResults.notes);
      formData.append('test_results', JSON.stringify(manualResults.test_results.filter(tr => tr.result_value?.trim())));
      
      if (manualResults.result_file) {
        formData.append('result_file', manualResults.result_file);
      }
      
      await axios.post(`${API_URL}/api/referrals/${selectedReferralForResults.id}/manual-results`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      
      alert('✅ Results saved successfully!');
      setShowReceiveResultsModal(false);
      setSelectedReferralForResults(null);
      fetchReferrals();
      
      if (window.confirm('Results saved. Would you like to print them now?')) {
        handlePrintReferralResults(selectedReferralForResults.id);
      }
    } catch (err) {
      console.error('Error saving manual results:', err);
      alert('❌ Error saving results: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleViewReferralResults = async (referral) => {
    try {
      const res = await axios.get(`${API_URL}/api/referrals/${referral.id}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferralResultsData(res.data);
      setShowViewReferralResults(true);
    } catch (err) {
      console.error('Error loading referral results:', err);
      alert('Error loading results: ' + (err.response?.data?.error || err.message));
    }
  };

  const handlePrintReferralResults = async (referralId) => {
    if (!referralId || referralId === 'undefined') {
      alert('❌ Invalid referral ID');
      return;
    }
    
    try {
      const res = await axios.get(`${API_URL}/api/referrals/${referralId}/results/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        };
      } else {
        alert('Popup blocked. Please allow popups or use the download button.');
        handleDownloadReferralResults(referralId);
      }
    } catch (err) {
      console.error('Error printing referral results:', err);
      alert('❌ Error printing results: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDownloadReferralResults = async (referralId) => {
    if (!referralId || referralId === 'undefined') {
      alert('❌ Invalid referral ID');
      return;
    }
    
    try {
      const res = await axios.get(`${API_URL}/api/referrals/${referralId}/results/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `referral_results_${referralId}_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading referral results:', err);
      alert('❌ Error downloading results: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleAddReferenceLab = async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const labData = {
      name: formData.get('name'),
      contact_person: formData.get('contact_person'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      address: formData.get('address'),
      turnaround_time: formData.get('turnaround_time')
    };
    
    try {
      await axios.post(`${API_URL}/api/reference-labs`, labData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('✅ Reference lab added successfully!');
      setShowAddReferenceLab(false);
      fetchReferenceLabs();
    } catch (err) {
      alert('❌ Error adding reference lab: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleOpenResults = async (order) => {
    try {
      setSelectedOrder(order);
      const res = await axios.get(`${API_URL}/api/orders/${order.id}/tests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedOrderTests(res.data);
      setShowTestResult(true);
    } catch (err) {
      console.error('Error loading tests:', err);
      alert('Error loading tests: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleViewResults = async (order) => {
    try {
      setSelectedOrder(order);
      const res = await axios.get(`${API_URL}/api/orders/${order.id}/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.data || res.data.length === 0) {
        alert('No results found for this order. Please enter results first.');
        return;
      }
      
      setViewResultsData(res.data);
      setShowViewResults(true);
    } catch (err) {
      console.error('Error loading results:', err);
      alert(`Error loading results: ${err.response?.data?.error || err.message}`);
    }
  };

  const handlePrintReceipt = async (orderId) => {
    try {
      if (!orderId) {
        alert('Invalid order ID');
        return;
      }

      const receiptsRes = await axios.get(`${API_URL}/api/orders/${orderId}/receipts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!receiptsRes.data || receiptsRes.data.length === 0) {
        alert('No receipt found for this order');
        return;
      }
      
      const receipt = receiptsRes.data[0];
      const pdfRes = await axios.get(`${API_URL}/api/receipts/${receipt.id}/pdf?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([pdfRes.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const printWindow = window.open(url);
      
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
          setTimeout(() => window.URL.revokeObjectURL(url), 1000);
        };
      } else {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = url;
        document.body.appendChild(iframe);
        iframe.onload = () => {
          iframe.contentWindow.print();
          setTimeout(() => {
            document.body.removeChild(iframe);
            window.URL.revokeObjectURL(url);
          }, 1000);
        };
      }
    } catch (err) {
      console.error('Error printing receipt:', err);
      alert('Error printing receipt: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleViewInvoice = async (invoiceId) => {
    try {
      const response = await axios.get(`${API_URL}/api/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url).onload = () => window.print();
    } catch (err) {
      console.error('Error viewing invoice:', err);
      alert('Error viewing invoice: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleExport = async (type) => {
    try {
      const res = await axios.get(`${API_URL}/api/export/${type}?format=csv`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      await fetchDashboardData();
    } catch (err) {
      alert('Export failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleBackup = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/backup`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_${Date.now()}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      fetchDashboardData();
    } catch (err) {
      alert('Backup failed: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRestore = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!window.confirm('⚠️ Restoring will overwrite current data. Continue?')) return;
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        await axios.post(`${API_URL}/api/restore`, JSON.parse(e.target.result), {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert(`✅ Restore completed!`);
        fetchDashboardData();
      } catch (err) {
        alert('Restore failed: ' + (err.response?.data?.error || err.message));
      }
    };
    reader.readAsText(file);
  };

  const handleLogoUpload = async () => {
    if (!logoFile) {
      alert('Please select a logo file');
      return;
    }
    
    if (logoFile.size > 2 * 1024 * 1024) {
      setLogoError('Logo file is too large. Maximum size is 2MB.');
      return;
    }
    
    if (!logoFile.type.startsWith('image/')) {
      setLogoError('Please select an image file.');
      return;
    }
    
    setLogoError('');
    
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const compressedImage = await compressImage(reader.result, 300, 300);
          
          await axios.post(`${API_URL}/api/labs/logo`, {
            logo_data: compressedImage,
            logo_filename: logoFile.name
          }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
          
          alert('✅ Logo uploaded successfully!');
          setShowLogoUpload(false);
          setLogoFile(null);
          setLogoPreview(null);
          
          // Force logo refresh by updating timestamp
          await fetchUserData();
        } catch (err) {
          console.error('Upload error:', err.response?.data || err);
          alert('❌ Error uploading logo: ' + (err.response?.data?.error || err.message));
          setLogoError(err.response?.data?.error || err.message);
        }
      };
      reader.readAsDataURL(logoFile);
    } catch (err) {
      console.error('Error reading file:', err);
      alert('Error reading file: ' + err.message);
    }
  };

  const applyFilters = async () => {
    try {
      const params = new URLSearchParams();
      if (filterAction) params.append('action', filterAction);
      if (filterEntity) params.append('entity_type', filterEntity);
      if (filterUser) params.append('user_id', filterUser);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);
      
      const res = await axios.get(`${API_URL}/api/activity-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setFilteredActivityLogs(res.data.logs || []);
      setActivityFilters(res.data.filters || { actions: [], entity_types: [] });
    } catch (err) {
      console.error('Error applying filters:', err);
    }
  };

  const clearFilters = () => {
    setFilterAction('');
    setFilterEntity('');
    setFilterUser('');
    setFilterStartDate('');
    setFilterEndDate('');
    setFilteredActivityLogs(activityLogs);
  };

  const resetLabForm = () => {
    setNewLab({ company_name: '', name: '', email: '', password: '', phone: '', address: '', website: '', subscription_plan: 'basic', kra_pin: '', business_reg: '' });
  };

  const resetPatientForm = () => {
    setNewPatient({ name: '', phone: '07', email: '', address: '', date_of_birth: '', gender: '', blood_group: '', id_number: '', emergency_contact: '', emergency_phone: '07' });
  };

  const resetTestForm = () => {
    setNewTest({ name: '', category: 'blood', price: '', description: '', turnaround_time: '24 hours', sample_type: 'Blood' });
  };

  const resetOrderForm = () => {
    setNewOrder({ patientId: '', testIds: [], notes: '', doctor_name: '', doctor_email: '', priority: 'normal' });
  };

  const resetPaymentForm = () => {
    setPayment({ amount: '', method: 'cash', mpesa_code: '', notes: '' });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('labId');
    window.location.reload();
  };

  // ==================== INITIAL DATA LOAD ====================
  useEffect(() => {
    fetchUserData();
    fetchDashboardData();
    fetchPOSProducts();
    fetchPOSSales();
    fetchNotificationSettings();
    
    socket.on('resultUpdated', (data) => {
      setNotifications(prev => [`🔬 Result updated for order #${data.orderId}`, ...prev.slice(0, 4)]);
      fetchDashboardData();
    });
    
    socket.on('newOrder', (data) => {
      setNotifications(prev => [`📋 New order #${data.orderId} created`, ...prev.slice(0, 4)]);
      fetchDashboardData();
    });
    
    socket.on('paymentReceived', (data) => {
      setNotifications(prev => [`💰 Payment of ${formatKES(data.amount)} received`, ...prev.slice(0, 4)]);
      fetchDashboardData();
    });

    socket.on('posSaleCompleted', () => {
      fetchPOSSales();
      fetchPOSProducts();
    });

    socket.on('stockUpdated', () => {
      fetchPOSProducts();
    });

    return () => {
      socket.off('resultUpdated');
      socket.off('newOrder');
      socket.off('paymentReceived');
      socket.off('posSaleCompleted');
      socket.off('stockUpdated');
    };
  }, [fetchUserData, fetchDashboardData, fetchPOSProducts, fetchPOSSales, fetchNotificationSettings]);

  // ==================== RENDER METHODS ====================
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Loading Dashboard...</h2>
          <p>Please wait while we fetch your data</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={{ padding: '0 25px 25px 25px', borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
          <LabLogo 
            labId={user?.labId}
            API_URL={API_URL}
            style={{ 
              width: '150px',
              height: '60px',
              marginBottom: '10px',
              backgroundColor: 'white',
              borderRadius: '4px',
              padding: '5px'
            }}
          />
          {user && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{user.name || user.email}</p>
              <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.7 }}>{user.role || 'User'}</p>
            </div>
          )}
        </div>
        
        <div style={styles.navSection}>
          {TABS.map(item => (
            <div
              key={item.id}
              style={{ ...styles.navItem, background: activeTab === item.id ? '#3b82f6' : 'transparent' }}
              onClick={() => {
                setActiveTab(item.id);
                if (item.id === 'referrals') {
                  fetchReferenceLabs();
                  fetchReferrals();
                }
              }}
            >
              {item.icon} {item.label}
            </div>
          ))}
        </div>

        <div style={styles.logoutSection}>
          <div style={{ ...styles.navItem, background: 'transparent', color: '#ef4444' }} onClick={handleLogout}>
            🚪 Logout
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.main}>
        {activeTab === 'overview' && (
          <OverviewTab
            user={user}
            labs={labs}
            patients={patients}
            tests={tests}
            orders={orders}
            posSales={posSales}
            lowStockProducts={lowStockProducts}
            showStockAlerts={showStockAlerts}
            setShowStockAlerts={setShowStockAlerts}
            setActiveTab={setActiveTab}
            setShowAddLab={setShowAddLab}
            setShowAddPatient={setShowAddPatient}
            setShowAddTest={setShowAddTest}
            setSelectedOrder={setSelectedOrder}
            setShowPayment={setShowPayment}
            handlePrintReceipt={handlePrintReceipt}
            handleDeleteSale={handleDeleteSale}
            formatKES={formatKES}
            combinedRevenue={combinedRevenue}
            labRevenue={labRevenue}
            posRevenue={posRevenue}
          />
        )}

        {activeTab === 'labs' && (
          <LabsTab
            user={user}
            labs={labs}
            setShowAddLab={setShowAddLab}
            handleDeleteLab={handleDeleteLab}
            formatKES={formatKES}
          />
        )}

        {activeTab === 'patients' && (
          <PatientsTab
            user={user}
            patients={patients}
            setShowAddPatient={setShowAddPatient}
            setEditingPatient={setEditingPatient}
            setShowEditPatient={setShowEditPatient}
            handleDeletePatient={handleDeletePatient}
          />
        )}

        {activeTab === 'tests' && (
          <TestsTab
            user={user}
            tests={tests}
            setShowAddTest={setShowAddTest}
            setEditingTest={setEditingTest}
            setShowEditTest={setShowEditTest}
            handleDeleteTest={handleDeleteTest}
            formatKES={formatKES}
          />
        )}

        {activeTab === 'orders' && (
          <OrdersTab
            orders={orders}
            setShowCreateOrder={setShowCreateOrder}
            handleOpenResults={handleOpenResults}
            handleViewResults={handleViewResults}
            setSelectedOrder={setSelectedOrder}
            setShowPayment={setShowPayment}
            handlePrintReceipt={handlePrintReceipt}
            handleGenerateInvoice={handleGenerateInvoice}
            handleDeleteOrder={handleDeleteOrder}
            user={user}
            formatKES={formatKES}
          />
        )}

        {activeTab === 'invoices' && (
          <InvoicesTab
            invoices={invoices}
            handleViewInvoice={handleViewInvoice}
            setSelectedOrder={setSelectedOrder}
            setShowPayment={setShowPayment}
            handlePrintReceipt={handlePrintReceipt}
            handleDeleteInvoice={handleDeleteInvoice}
            user={user}
            formatKES={formatKES}
          />
        )}

        {activeTab === 'analytics' && (
          <AnalyticsTab
            labRevenue={labRevenue}
            posRevenue={posRevenue}
            combinedRevenue={combinedRevenue}
            summary={summary}
            invoices={invoices}
            orders={orders}
            lowStockProducts={lowStockProducts}
            setActiveTab={setActiveTab}
            formatKES={formatKES}
          />
        )}

        {activeTab === 'activity' && (
          <ActivityTab
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            filterAction={filterAction}
            setFilterAction={setFilterAction}
            filterEntity={filterEntity}
            setFilterEntity={setFilterEntity}
            filterUser={filterUser}
            setFilterUser={setFilterUser}
            filterStartDate={filterStartDate}
            setFilterStartDate={setFilterStartDate}
            filterEndDate={filterEndDate}
            setFilterEndDate={setFilterEndDate}
            activityFilters={activityFilters}
            users={users}
            filteredActivityLogs={filteredActivityLogs}
            applyFilters={applyFilters}
            clearFilters={clearFilters}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            user={user}
            users={users}
            setShowAddUser={setShowAddUser}
          />
        )}

        {activeTab === 'pos' && (
          <POSDashboard
            token={token}
            API_URL={API_URL}
            formatKES={formatKES}
            user={user}
            onSaleComplete={() => {
              fetchPOSSales();
              fetchPOSProducts();
            }}
          />
        )}

        {activeTab === 'referrals' && (
          <ReferralsTab
            user={user}
            referenceLabs={referenceLabs}
            referrals={referrals}
            completedReferrals={completedReferrals}
            showArchive={showArchive}
            setShowArchive={setShowArchive}
            setShowAddReferenceLab={setShowAddReferenceLab}
            setShowReferralModal={setShowReferralModal}
            handleOpenReceiveResults={handleOpenReceiveResults}
            handleViewReferralResults={handleViewReferralResults}
            handlePrintReferralResults={handlePrintReferralResults}
            handleDownloadReferralResults={handleDownloadReferralResults}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            user={user}
            notificationSettings={notificationSettings}
            setShowNotificationSettings={setShowNotificationSettings}
            setShowLogoUpload={setShowLogoUpload}
            handleExport={handleExport}
            handleBackup={handleBackup}
            handleRestore={handleRestore}
            showExportLogs={showExportLogs}
            setShowExportLogs={setShowExportLogs}
            exportLogs={exportLogs}
            API_URL={API_URL}
          />
        )}
      </div>

      {/* Modals */}
      {showAddLab && (
        <AddLabModal
          newLab={newLab}
          setNewLab={setNewLab}
          onSubmit={handleAddLab}
          onClose={() => setShowAddLab(false)}
          styles={styles}
        />
      )}

      {showAddPatient && (
        <AddPatientModal
          newPatient={newPatient}
          setNewPatient={setNewPatient}
          onSubmit={handleAddPatient}
          onClose={() => setShowAddPatient(false)}
          styles={styles}
        />
      )}

      {showAddTest && (
        <AddTestModal
          newTest={newTest}
          setNewTest={setNewTest}
          onSubmit={handleAddTest}
          onClose={() => setShowAddTest(false)}
          styles={styles}
        />
      )}

      {showCreateOrder && (
        <CreateOrderModal
          newOrder={newOrder}
          setNewOrder={setNewOrder}
          patients={patients}
          tests={tests}
          onSubmit={handleCreateOrder}
          onClose={() => setShowCreateOrder(false)}
          formatKES={formatKES}
          styles={styles}
        />
      )}

      {showPayment && selectedOrder && (
        <PaymentModal
          selectedOrder={selectedOrder}
          payment={payment}
          setPayment={setPayment}
          onSubmit={handleAddPayment}
          onClose={() => { setShowPayment(false); resetPaymentForm(); }}
          formatKES={formatKES}
          styles={styles}
        />
      )}

      {showOverpaymentModal && (
        <OverpaymentModal
          overpaymentData={overpaymentData}
          onAction={handleOverpaymentAction}
          onClose={() => setShowOverpaymentModal(false)}
          formatKES={formatKES}
          styles={styles}
        />
      )}

      {showNotificationSettings && (
        <NotificationSettings
          token={token}
          API_URL={API_URL}
          labId={user?.labId}
          onClose={() => setShowNotificationSettings(false)}
          onSave={(settings) => {
            setNotificationSettings(settings);
            setShowNotificationSettings(false);
            fetchDashboardData();
          }}
        />
      )}

      {showTestResult && selectedOrder && (
        <TestResultsModal
          key={`results-${selectedOrder.id}`}
          order={selectedOrder}
          tests={selectedOrderTests}
          onClose={() => setShowTestResult(false)}
          onComplete={() => { setShowTestResult(false); fetchDashboardData(); }}
          token={token}
          API_URL={API_URL}
          formatKES={formatKES}
        />
      )}

      {showEditPatient && editingPatient && (
        <EditPatientModal
          patient={editingPatient}
          onClose={() => setShowEditPatient(false)}
          onSave={() => { setShowEditPatient(false); fetchDashboardData(); }}
          token={token}
          API_URL={API_URL}
          formatPhone={formatPhone}
        />
      )}

      {showEditTest && editingTest && (
        <EditTestModal
          test={editingTest}
          onClose={() => setShowEditTest(false)}
          onSave={() => { setShowEditTest(false); fetchDashboardData(); }}
          token={token}
          API_URL={API_URL}
          formatKES={formatKES}
        />
      )}

      {showViewResults && selectedOrder && (
        <ViewResultsModal
          order={selectedOrder}
          results={viewResultsData}
          onClose={() => setShowViewResults(false)}
          formatKES={formatKES}
        />
      )}

      {showAddUser && (
        <AddUserModal
          onClose={() => setShowAddUser(false)}
          onSave={() => { setShowAddUser(false); fetchDashboardData(); }}
          token={token}
          API_URL={API_URL}
        />
      )}

      {showLogoUpload && (
        <LogoUploadModal
          logoFile={logoFile}
          setLogoFile={setLogoFile}
          logoPreview={logoPreview}
          setLogoPreview={setLogoPreview}
          logoError={logoError}
          setLogoError={setLogoError}
          onUpload={handleLogoUpload}
          onClose={() => setShowLogoUpload(false)}
          styles={styles}
        />
      )}

      {showReferralModal && (
        <ReferralModal
          referenceLabs={referenceLabs}
          patients={patients}
          tests={tests}
          onSubmit={handleCreateReferral}
          onClose={() => setShowReferralModal(false)}
          styles={styles}
        />
      )}

      {showReceiveResultsModal && selectedReferralForResults && (
        <ReceiveResultsModal
          selectedReferralForResults={selectedReferralForResults}
          manualResults={manualResults}
          setManualResults={setManualResults}
          onSubmit={handleSaveManualResults}
          onClose={() => {
            setShowReceiveResultsModal(false);
            setSelectedReferralForResults(null);
          }}
          styles={styles}
        />
      )}

      {showViewReferralResults && referralResultsData && (
        <ViewReferralResultsModal
          referralResultsData={referralResultsData}
          onPrint={handlePrintReferralResults}
          onDownload={handleDownloadReferralResults}
          onClose={() => setShowViewReferralResults(false)}
          styles={styles}
        />
      )}

      {showAddReferenceLab && (
        <AddReferenceLabModal
          onSubmit={handleAddReferenceLab}
          onClose={() => setShowAddReferenceLab(false)}
          styles={styles}
        />
      )}
    </div>
  );
};

// ==================== TAB COMPONENTS ====================

const OverviewTab = ({
  user, labs, patients, tests, orders, posSales, lowStockProducts,
  showStockAlerts, setShowStockAlerts, setActiveTab,
  setShowAddLab, setShowAddPatient, setShowAddTest,
  setSelectedOrder, setShowPayment, handlePrintReceipt, handleDeleteSale,
  formatKES, combinedRevenue, labRevenue, posRevenue
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>Dashboard Overview</h1>
      <div>
        {user?.is_super_admin && (
          <button style={styles.button} onClick={() => setShowAddLab(true)}>➕ New Lab</button>
        )}
        <button style={{ ...styles.button, ...styles.buttonSuccess, marginLeft: '10px' }} onClick={() => setShowAddPatient(true)}>👤 New Patient</button>
        <button style={{ ...styles.button, background: '#8b5cf6', marginLeft: '10px' }} onClick={() => setShowAddTest(true)}>🔬 New Test</button>
      </div>
    </div>

    {lowStockProducts.length > 0 && showStockAlerts && (
      <div style={styles.alertCard}>
        <div style={styles.alertTitle}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <h3 style={{ margin: 0 }}>Low Stock Alerts ({lowStockProducts.length})</h3>
          <button style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} onClick={() => setShowStockAlerts(false)}>✕</button>
        </div>
        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
          {lowStockProducts.slice(0, 5).map(product => (
            <div key={product.id} style={styles.alertItem}>
              <span><strong>{product.name}</strong> - Stock: {product.stock_quantity} {product.unit}</span>
              <span style={{ color: '#dc3545', fontWeight: 'bold' }}>Below threshold ({product.low_stock_threshold})</span>
            </div>
          ))}
          {lowStockProducts.length > 5 && (
            <div style={{ padding: '8px', textAlign: 'center', color: '#856404' }}>
              ... and {lowStockProducts.length - 5} more items
            </div>
          )}
        </div>
        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          <button style={{ ...styles.button, ...styles.buttonWarning, fontSize: '12px', padding: '5px 10px' }} onClick={() => setActiveTab('pos')}>
            Go to POS to restock
          </button>
        </div>
      </div>
    )}

    <div style={styles.grid4}>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>Today's Revenue</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{formatKES(combinedRevenue.today)}</p>
        <div style={styles.revenueBreakdown}>
          <small>Lab: {formatKES(labRevenue.today || 0)} | POS: {formatKES(posRevenue.today || 0)}</small>
        </div>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>This Week</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{formatKES(combinedRevenue.week)}</p>
        <div style={styles.revenueBreakdown}>
          <small>Lab: {formatKES(labRevenue.week || 0)} | POS: {formatKES(posRevenue.week || 0)}</small>
        </div>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #5ea3ec 0%, #43e97b 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>This Month</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{formatKES(combinedRevenue.month)}</p>
        <div style={styles.revenueBreakdown}>
          <small>Lab: {formatKES(labRevenue.month || 0)} | POS: {formatKES(posRevenue.month || 0)}</small>
        </div>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>Total Revenue</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{formatKES(combinedRevenue.total)}</p>
        <div style={styles.revenueBreakdown}>
          <small>Lab: {formatKES(labRevenue.total || 0)} | POS: {formatKES(posRevenue.total || 0)}</small>
        </div>
      </div>
    </div>

    <div style={styles.grid4}>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>Total Labs</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{labs.length}</p>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #4ECDC4 0%, #556270 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>Total Patients</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{patients.length}</p>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #96C93D 0%, #00B09B 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>Tests Available</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{tests.length}</p>
      </div>
      <div style={{ ...styles.statCard, background: 'linear-gradient(135deg, #FFD93D 0%, #FF6B6B 100%)' }}>
        <h3 style={{ margin: '0 0 10px 0', opacity: 0.9 }}>POS Products</h3>
        <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>{lowStockProducts.length > 0 ? `${lowStockProducts.length} Low Stock` : 'All Stock OK'}</p>
      </div>
    </div>

    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Recent Orders</h2>
        <button style={styles.button} onClick={() => setActiveTab('orders')}>View All →</button>
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Order #</th>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Amount</th>
            <th style={styles.th}>Paid</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.slice(0, 5).map(order => (
            <tr key={order.id}>
              <td style={styles.td}>#{order.id}</td>
              <td style={styles.td}>{order.patient_name}</td>
              <td style={styles.td}>{formatKES(order.total_amount)}</td>
              <td style={styles.td}>{formatKES(order.paid_amount || 0)}</td>
              <td style={styles.td}>
                <span style={{ 
                  ...styles.badge, 
                  background: order.status === 'completed' || order.paid_amount >= order.total_amount ? '#d1fae5' : '#fed7aa', 
                  color: order.status === 'completed' || order.paid_amount >= order.total_amount ? '#065f46' : '#92400e' 
                }}>
                  {order.status === 'completed' || order.paid_amount >= order.total_amount ? 'completed' : 'pending'}
                </span>
              </td>
              <td style={styles.td}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px' }} onClick={() => { setSelectedOrder(order); setShowPayment(true); }}>Pay</button>
                  {order.paid_amount > 0 && (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => handlePrintReceipt(order.id)}>🖨️ Print</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {posSales.length > 0 && (
      <div style={styles.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0 }}>Recent POS Sales</h2>
          <button style={styles.button} onClick={() => setActiveTab('pos')}>Go to POS →</button>
        </div>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Receipt #</th>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Amount</th>
              <th style={styles.th}>Payment</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {posSales.slice(0, 5).map(sale => (
              <tr key={sale.id}>
                <td style={styles.td}>{sale.receipt_number}</td>
                <td style={styles.td}>{sale.customer_name || 'Walk-in'}</td>
                <td style={styles.td}>{formatKES(sale.total)}</td>
                <td style={styles.td}>{sale.payment_method}</td>
                <td style={styles.td}>{new Date(sale.created_at).toLocaleDateString()}</td>
                <td style={styles.td}>
                  {user?.role === 'admin' && (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeleteSale(sale.id, sale.receipt_number)}>🗑️ Delete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const LabsTab = ({ user, labs, setShowAddLab, handleDeleteLab }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>🏢 Lab Management</h1>
      {user?.is_super_admin && <button style={styles.button} onClick={() => setShowAddLab(true)}>➕ Register New Lab</button>}
    </div>
    
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Company</th>
            <th style={styles.th}>Lab Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Phone</th>
            <th style={styles.th}>KRA PIN</th>
            <th style={styles.th}>Plan</th>
            <th style={styles.th}>Status</th>
            {user?.is_super_admin && <th style={styles.th}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {labs.map(lab => (
            <tr key={lab.id}>
              <td style={styles.td}>#{lab.id}</td>
              <td style={styles.td}><strong>{lab.company_name || lab.name}</strong></td>
              <td style={styles.td}>{lab.name}</td>
              <td style={styles.td}>{lab.email || 'N/A'}</td>
              <td style={styles.td}>{lab.phone || 'N/A'}</td>
              <td style={styles.td}>{lab.kra_pin || 'N/A'}</td>
              <td style={styles.td}><span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>{lab.subscription_plan || 'basic'}</span></td>
              <td style={styles.td}><span style={{ ...styles.badge, background: lab.subscription_status === 'active' ? '#d1fae5' : '#fee2e2', color: lab.subscription_status === 'active' ? '#065f46' : '#991b1b' }}>{lab.subscription_status || 'active'}</span></td>
              {user?.is_super_admin && (
                <td style={styles.td}>
                  <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeleteLab(lab)}>Delete</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const PatientsTab = ({ user, patients, setShowAddPatient, setEditingPatient, setShowEditPatient, handleDeletePatient }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>👥 Patient Management</h1>
      <button style={{ ...styles.button, ...styles.buttonSuccess }} onClick={() => setShowAddPatient(true)}>➕ Add Patient</button>
    </div>
    
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>ID Number</th>
            <th style={styles.th}>Phone</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Blood Group</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {patients.map(patient => (
            <tr key={patient.id}>
              <td style={styles.td}>#{patient.id}</td>
              <td style={styles.td}><strong>{patient.name}</strong></td>
              <td style={styles.td}>{patient.id_number || 'N/A'}</td>
              <td style={styles.td}>{patient.phone}</td>
              <td style={styles.td}>{patient.email || 'N/A'}</td>
              <td style={styles.td}>{patient.blood_group || 'N/A'}</td>
              <td style={styles.td}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => { setEditingPatient(patient); setShowEditPatient(true); }}>Edit</button>
                  {(user?.role === 'admin' || user?.permissions?.can_delete) && (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeletePatient(patient)}>Delete</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const TestsTab = ({ user, tests, setShowAddTest, setEditingTest, setShowEditTest, handleDeleteTest, formatKES }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>🔬 Tests Catalog</h1>
      <button style={{ ...styles.button, background: '#8b5cf6' }} onClick={() => setShowAddTest(true)}>➕ Add Test</button>
    </div>
    
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>ID</th>
            <th style={styles.th}>Test Name</th>
            <th style={styles.th}>Category</th>
            <th style={styles.th}>Price (KES)</th>
            <th style={styles.th}>Sample Type</th>
            <th style={styles.th}>Turnaround</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {tests.map(test => (
            <tr key={test.id}>
              <td style={styles.td}>#{test.id}</td>
              <td style={styles.td}><strong>{test.name}</strong></td>
              <td style={styles.td}>{test.category}</td>
              <td style={styles.td}>{formatKES(test.price)}</td>
              <td style={styles.td}>{test.sample_type}</td>
              <td style={styles.td}>{test.turnaround_time}</td>
              <td style={styles.td}>
                <div style={{ display: 'flex', gap: '5px' }}>
                  <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => { setEditingTest(test); setShowEditTest(true); }}>Edit</button>
                  {(user?.role === 'admin' || user?.permissions?.can_delete) && (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeleteTest(test)}>Delete</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const OrdersTab = ({ orders, setShowCreateOrder, handleOpenResults, handleViewResults, setSelectedOrder, setShowPayment, handlePrintReceipt, handleGenerateInvoice, handleDeleteOrder, user, formatKES }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>📋 Orders</h1>
      <button style={{ ...styles.button, background: '#f59e0b' }} onClick={() => setShowCreateOrder(true)}>➕ Create Order</button>
    </div>
    
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Order #</th>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Tests</th>
            <th style={styles.th}>Total</th>
            <th style={styles.th}>Paid</th>
            <th style={styles.th}>Balance</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Invoice</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map(order => {
            const balance = order.total_amount - (order.paid_amount || 0);
            return (
              <tr key={order.id}>
                <td style={styles.td}>#{order.id}</td>
                <td style={styles.td}>{order.patient_name}</td>
                <td style={styles.td}>{order.tests?.length || 0} tests</td>
                <td style={styles.td}>{formatKES(order.total_amount)}</td>
                <td style={styles.td}>{formatKES(order.paid_amount || 0)}</td>
                <td style={{ ...styles.td, color: balance > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                  {formatKES(balance)}
                </td>
                <td style={styles.td}>
                  <span style={{ 
                    ...styles.badge, 
                    background: balance <= 0 ? '#d1fae5' : '#fed7aa', 
                    color: balance <= 0 ? '#065f46' : '#92400e' 
                  }}>
                    {balance <= 0 ? 'paid' : 'pending'}
                  </span>
                </td>
                <td style={styles.td}>
                  {order.invoice_id ? (
                    <span style={{ ...styles.badge, background: '#dbeafe', color: '#1e40af' }}>
                      #{order.invoice_number}
                    </span>
                  ) : (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#8b5cf6' }} 
                      onClick={() => handleGenerateInvoice(order.id)}>
                      Generate
                    </button>
                  )}
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#8b5cf6' }} onClick={() => handleOpenResults(order)}>🔬 Results</button>
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#3b82f6' }} onClick={() => handleViewResults(order)}>📊 View</button>
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: balance > 0 ? '#f59e0b' : '#64748b' }} 
                      onClick={() => { setSelectedOrder(order); setShowPayment(true); }}
                      disabled={balance <= 0}>
                      Pay
                    </button>
                    {order.paid_amount > 0 && (
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => handlePrintReceipt(order.id)}>🖨️ Print</button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.can_delete) && (
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeleteOrder(order)}>Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const InvoicesTab = ({ invoices, handleViewInvoice, setSelectedOrder, setShowPayment, handlePrintReceipt, handleDeleteInvoice, user, formatKES }) => (
  <div>
    <h1 style={{ marginBottom: '30px' }}>💰 Invoices</h1>
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Invoice #</th>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Amount</th>
            <th style={styles.th}>Paid</th>
            <th style={styles.th}>Balance</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Due Date</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(invoice => {
            const balance = invoice.total - (invoice.paid_amount || 0);
            return (
              <tr key={invoice.id}>
                <td style={styles.td}>{invoice.invoice_number}</td>
                <td style={styles.td}>{invoice.patient_name}</td>
                <td style={styles.td}>{formatKES(invoice.total)}</td>
                <td style={styles.td}>{formatKES(invoice.paid_amount || 0)}</td>
                <td style={{ ...styles.td, color: balance > 0 ? '#ef4444' : '#10b981', fontWeight: 'bold' }}>
                  {formatKES(balance)}
                </td>
                <td style={styles.td}>
                  <span style={{ 
                    ...styles.badge, 
                    background: balance <= 0 ? '#d1fae5' : '#fee2e2', 
                    color: balance <= 0 ? '#065f46' : '#991b1b' 
                  }}>
                    {balance <= 0 ? 'paid' : 'pending'}
                  </span>
                </td>
                <td style={styles.td}>{new Date(invoice.due_date).toLocaleDateString()}</td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px' }} onClick={() => handleViewInvoice(invoice.id)}>👁️ View</button>
                    {balance > 0 && (
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#f59e0b' }} onClick={() => { 
                        setSelectedOrder({ id: invoice.order_id, total_amount: invoice.total, paid_amount: invoice.paid_amount || 0 }); 
                        setShowPayment(true); 
                      }}>💰 Pay</button>
                    )}
                    {balance <= 0 && (
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => handlePrintReceipt(invoice.order_id)}>🖨️ Receipt</button>
                    )}
                    {(user?.role === 'admin' || user?.permissions?.can_delete_invoices) && (
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#ef4444' }} onClick={() => handleDeleteInvoice(invoice)}>🗑️ Delete</button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

const AnalyticsTab = ({ labRevenue, posRevenue, combinedRevenue, summary, invoices, orders, lowStockProducts, setActiveTab, formatKES }) => (
  <div>
    <h1 style={{ marginBottom: '30px' }}>📈 Analytics</h1>
    
    <div style={styles.grid4}>
      <div style={styles.card}>
        <h3>Lab Tests Revenue</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{formatKES(labRevenue.total || 0)}</p>
        <p>Today: {formatKES(labRevenue.today || 0)}</p>
        <p>This Week: {formatKES(labRevenue.week || 0)}</p>
        <p>This Month: {formatKES(labRevenue.month || 0)}</p>
      </div>
      
      <div style={styles.card}>
        <h3>POS Sales Revenue</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>{formatKES(posRevenue.total || 0)}</p>
        <p>Today: {formatKES(posRevenue.today || 0)}</p>
        <p>This Week: {formatKES(posRevenue.week || 0)}</p>
        <p>This Month: {formatKES(posRevenue.month || 0)}</p>
      </div>
      
      <div style={styles.card}>
        <h3>Combined Revenue</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>{formatKES(combinedRevenue.total || 0)}</p>
        <p>Today: {formatKES(combinedRevenue.today || 0)}</p>
        <p>This Week: {formatKES(combinedRevenue.week || 0)}</p>
        <p>This Month: {formatKES(combinedRevenue.month || 0)}</p>
      </div>
      
      <div style={styles.card}>
        <h3>Order Stats</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#f59e0b' }}>{summary.orders?.order_count || 0}</p>
        <p>Total Orders</p>
        <p>Completed: {summary.orders?.completed_count || 0}</p>
        <p>Pending: {summary.orders?.pending_count || 0}</p>
      </div>
    </div>

    <div style={styles.grid4}>
      <div style={styles.card}>
        <h3>Invoice Stats</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#3b82f6' }}>{invoices.length}</p>
        <p>Total Invoices</p>
        <p>Paid: {invoices.filter(i => i.paid_amount >= i.total).length}</p>
        <p>Pending: {invoices.filter(i => i.paid_amount < i.total).length}</p>
      </div>
      
      <div style={styles.card}>
        <h3>Outstanding Balance</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#ef4444' }}>
          {formatKES(invoices.reduce((sum, i) => sum + (i.total - (i.paid_amount || 0)), 0))}
        </p>
        <p>Total Unpaid</p>
      </div>
      
      <div style={styles.card}>
        <h3>Average Order Value</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
          {orders.length > 0 ? formatKES(orders.reduce((sum, o) => sum + o.total_amount, 0) / orders.length) : formatKES(0)}
        </p>
        <p>Per Order</p>
      </div>
      
      <div style={styles.card}>
        <h3>Collection Rate</h3>
        <p style={{ fontSize: '24px', fontWeight: 'bold', color: '#8b5cf6' }}>
          {orders.reduce((sum, o) => sum + o.total_amount, 0) > 0 
            ? Math.round((orders.reduce((sum, o) => sum + (o.paid_amount || 0), 0) / orders.reduce((sum, o) => sum + o.total_amount, 0)) * 100) 
            : 0}%
        </p>
        <p>Payment Rate</p>
      </div>
    </div>
    
    {lowStockProducts.length > 0 && (
      <div style={styles.card}>
        <h3>⚠️ Low Stock Products</h3>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Current Stock</th>
              <th style={styles.th}>Threshold</th>
              <th style={styles.th}>Action</th>
            </tr>
          </thead>
          <tbody>
            {lowStockProducts.map(product => (
              <tr key={product.id}>
                <td style={styles.td}>{product.name}</td>
                <td style={{ ...styles.td, color: '#dc3545', fontWeight: 'bold' }}>{product.stock_quantity} {product.unit}</td>
                <td style={styles.td}>{product.low_stock_threshold}</td>
                <td style={styles.td}>
                  <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => setActiveTab('pos')}>Go to POS</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ActivityTab = ({
  showFilters, setShowFilters, filterAction, setFilterAction,
  filterEntity, setFilterEntity, filterUser, setFilterUser,
  filterStartDate, setFilterStartDate, filterEndDate, setFilterEndDate,
  activityFilters, users, filteredActivityLogs, applyFilters, clearFilters
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>📝 Activity Log</h1>
      <button style={styles.button} onClick={() => setShowFilters(!showFilters)}>
        {showFilters ? 'Hide Filters' : 'Show Filters'}
      </button>
    </div>
    
    {showFilters && (
      <div style={{ ...styles.card, marginBottom: '20px' }}>
        <h3>Filter Activities</h3>
        <div style={styles.grid3}>
          <div>
            <label>Action Type</label>
            <select style={styles.select} value={filterAction} onChange={(e) => setFilterAction(e.target.value)}>
              <option value="">All Actions</option>
              {activityFilters?.actions?.map(action => <option key={action} value={action}>{action}</option>)}
            </select>
          </div>
          <div>
            <label>Entity Type</label>
            <select style={styles.select} value={filterEntity} onChange={(e) => setFilterEntity(e.target.value)}>
              <option value="">All Entities</option>
              {activityFilters?.entity_types?.map(type => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>
          <div>
            <label>User</label>
            <select style={styles.select} value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
              <option value="">All Users</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
            </select>
          </div>
        </div>
        
        <div style={styles.grid2}>
          <div>
            <label>Start Date</label>
            <input type="date" style={styles.input} value={filterStartDate} onChange={(e) => setFilterStartDate(e.target.value)} />
          </div>
          <div>
            <label>End Date</label>
            <input type="date" style={styles.input} value={filterEndDate} onChange={(e) => setFilterEndDate(e.target.value)} />
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
          <button style={{ ...styles.button, background: '#3b82f6' }} onClick={applyFilters}>Apply Filters</button>
          <button style={{ ...styles.button, background: '#64748b' }} onClick={clearFilters}>Clear Filters</button>
        </div>
      </div>
    )}
    
    <div style={styles.card}>
      {filteredActivityLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <p style={{ fontSize: '16px' }}>No activity logs match your filters</p>
        </div>
      ) : (
        filteredActivityLogs.map((log, index) => (
          <div key={index} style={{ padding: '15px', borderBottom: '1px solid #e2e8f0', backgroundColor: index === 0 ? '#f0f9ff' : 'transparent' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ margin: 0 }}><strong>{log.action}</strong></p>
              <span style={{ fontSize: '12px', color: '#64748b' }}>{new Date(log.created_at).toLocaleString()}</span>
            </div>
            <p style={{ margin: '5px 0', fontSize: '13px' }}>{log.details ? JSON.stringify(log.details) : ''}</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              By: {log.user_name || log.user_email || 'System'} {log.entity_type && ` • ${log.entity_type} #${log.entity_id}`}
            </p>
          </div>
        ))
      )}
    </div>
  </div>
);

const UsersTab = ({ user, users, setShowAddUser }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
      <h1 style={{ margin: 0 }}>👥 User Management</h1>
      {user?.role === 'admin' && (
        <button style={{ ...styles.button, ...styles.buttonSuccess }} onClick={() => setShowAddUser(true)}>➕ Add User</button>
      )}
    </div>
    
    <div style={styles.card}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Name</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Role</th>
            <th style={styles.th}>Permissions</th>
            <th style={styles.th}>Created</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={styles.td}>{u.name || u.email}</td>
              <td style={styles.td}>{u.email}</td>
              <td style={styles.td}>
                <span style={{ ...styles.badge, background: u.role === 'admin' ? '#fee2e2' : '#dbeafe', color: u.role === 'admin' ? '#991b1b' : '#1e40af' }}>
                  {u.role}
                </span>
              </td>
              <td style={styles.td}>
                {u.permissions ? Object.entries(u.permissions).filter(([_, value]) => value).map(([key]) => key.replace('can_', '')).join(', ') : 'Default'}
              </td>
              <td style={styles.td}>{new Date(u.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ReferralsTab = ({
  user, referenceLabs, referrals, completedReferrals, showArchive, setShowArchive,
  setShowAddReferenceLab, setShowReferralModal,
  handleOpenReceiveResults, handleViewReferralResults,
  handlePrintReferralResults, handleDownloadReferralResults
}) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h1>🔄 Reference Labs & Referrals</h1>
      <div>
        {user?.role === 'admin' && (
          <button style={{ ...styles.button, ...styles.buttonSuccess, marginRight: '10px' }} onClick={() => setShowAddReferenceLab(true)}>➕ Add Reference Lab</button>
        )}
        <button style={styles.button} onClick={() => setShowReferralModal(true)}>📤 New Referral</button>
      </div>
    </div>

    <div style={styles.card}>
      <h3>Reference Laboratories</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Lab Name</th>
            <th style={styles.th}>Contact</th>
            <th style={styles.th}>Phone</th>
            <th style={styles.th}>Email</th>
            <th style={styles.th}>Turnaround</th>
          </tr>
        </thead>
        <tbody>
          {referenceLabs.map(lab => (
            <tr key={lab.id}>
              <td style={styles.td}><strong>{lab.name}</strong></td>
              <td style={styles.td}>{lab.contact_person || 'N/A'}</td>
              <td style={styles.td}>{lab.phone}</td>
              <td style={styles.td}>{lab.email}</td>
              <td style={styles.td}>{lab.turnaround_time || 'N/A'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div style={styles.card}>
      <h3>Recent Referrals</h3>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Referral #</th>
            <th style={styles.th}>Patient</th>
            <th style={styles.th}>Reference Lab</th>
            <th style={styles.th}>Tests</th>
            <th style={styles.th}>Status</th>
            <th style={styles.th}>Date</th>
            <th style={styles.th}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {referrals.map(ref => (
            <tr key={ref.id}>
              <td style={styles.td}>{ref.referral_number}</td>
              <td style={styles.td}>{ref.patient_name}</td>
              <td style={styles.td}>{ref.reference_lab_name}</td>
              <td style={styles.td}>{ref.tests?.length || 0} tests</td>
              <td style={styles.td}>
                <span style={{ 
                  ...styles.badge, 
                  background: ref.status === 'completed' ? '#d1fae5' : 
                             ref.status === 'pending' ? '#fed7aa' : '#dbeafe',
                  color: ref.status === 'completed' ? '#065f46' : 
                         ref.status === 'pending' ? '#92400e' : '#1e40af'
                }}>
                  {ref.status}
                </span>
              </td>
              <td style={styles.td}>{new Date(ref.created_at).toLocaleDateString()}</td>
              <td style={styles.td}>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {ref.status === 'pending' && (
                    <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#8b5cf6' }} onClick={() => handleOpenReceiveResults(ref)}>
                      📥 Enter Results
                    </button>
                  )}
                  
                  {(ref.status === 'completed' || ref.status === 'in_progress') && (
                    <>
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#3b82f6' }} onClick={() => handleViewReferralResults(ref)}>
                        👁️ View
                      </button>
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => handlePrintReferralResults(ref.id)}>
                        🖨️ Print
                      </button>
                      <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#f59e0b' }} onClick={() => handleDownloadReferralResults(ref.id)}>
                        ⬇️ Download
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>📁 Results Archive ({completedReferrals.length})</h3>
        <button style={{ ...styles.button, background: '#3b82f6' }} onClick={() => setShowArchive(!showArchive)}>
          {showArchive ? 'Hide Archive' : 'Show Archive'}
        </button>
      </div>
      
      {showArchive && (
        <>
          {completedReferrals.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '8px' }}>
              <p style={{ color: '#64748b' }}>No completed referrals in archive yet.</p>
            </div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Referral #</th>
                  <th style={styles.th}>Patient</th>
                  <th style={styles.th}>Reference Lab</th>
                  <th style={styles.th}>Completed Date</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {completedReferrals.map(ref => (
                  <tr key={ref.id}>
                    <td style={styles.td}>{ref.referral_number}</td>
                    <td style={styles.td}>{ref.patient_name}</td>
                    <td style={styles.td}>{ref.reference_lab_name}</td>
                    <td style={styles.td}>{ref.completed_at ? new Date(ref.completed_at).toLocaleDateString() : new Date(ref.updated_at).toLocaleDateString()}</td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#3b82f6' }} onClick={() => handleViewReferralResults(ref)}>👁️ View</button>
                        <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#10b981' }} onClick={() => handlePrintReferralResults(ref.id)}>🖨️ Print</button>
                        <button style={{ ...styles.button, padding: '5px 10px', fontSize: '12px', background: '#f59e0b' }} onClick={() => handleDownloadReferralResults(ref.id)}>⬇️ Download</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  </div>
);

const SettingsTab = ({
  user, notificationSettings, setShowNotificationSettings, setShowLogoUpload,
  handleExport, handleBackup, handleRestore, showExportLogs, setShowExportLogs,
  exportLogs, API_URL
}) => (
  <div>
    <h1 style={{ marginBottom: '30px' }}>⚙️ Settings</h1>
    
    <div style={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>🔔 Notification Settings</h2>
        <button style={{ ...styles.button, background: '#8b5cf6' }} onClick={() => setShowNotificationSettings(true)}>
          Configure Notifications
        </button>
      </div>
      {notificationSettings && (
        <div style={{ marginTop: '15px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
          <p>
            <strong>Email:</strong> {notificationSettings.email_enabled ? '✅ Enabled' : '❌ Disabled'} | 
            <strong> SMS:</strong> {notificationSettings.sms_enabled ? '✅ Enabled' : '❌ Disabled'}
          </p>
        </div>
      )}
    </div>
    
    <div style={styles.card}>
      <h2>🏢 Lab Branding</h2>
      <button style={{ ...styles.button, background: '#8b5cf6' }} onClick={() => setShowLogoUpload(true)}>
        {user?.logo_url ? 'Update Logo' : 'Upload Logo'}
      </button>
      {user?.logo_url && (
        <div style={{ marginTop: '10px' }}>
          <img src={`${API_URL}${user.logo_url}`} alt="Lab Logo" style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain' }} />
        </div>
      )}
    </div>
    
    <div style={styles.card}>
      <h2>📊 Data Management</h2>
      
      <div style={{ marginBottom: '30px' }}>
        <h3>Export Data</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button style={{ ...styles.button, background: '#3b82f6' }} onClick={() => handleExport('patients')}>Export Patients</button>
          <button style={{ ...styles.button, background: '#10b981' }} onClick={() => handleExport('tests')}>Export Tests</button>
          <button style={{ ...styles.button, background: '#f59e0b' }} onClick={() => handleExport('orders')}>Export Orders</button>
          <button style={{ ...styles.button, background: '#8b5cf6' }} onClick={() => handleExport('payments')}>Export Payments</button>
          <button style={{ ...styles.button, background: '#ef4444' }} onClick={() => handleExport('invoices')}>Export Invoices</button>
        </div>
      </div>
      
      {user?.role === 'admin' && (
        <div>
          <h3>Backup & Restore</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={{ ...styles.button, background: '#10b981' }} onClick={handleBackup}>⬇️ Download Full Backup</button>
            
            <label style={{ ...styles.button, background: '#f59e0b', cursor: 'pointer', display: 'inline-block' }}>
              📤 Restore from Backup
              <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleRestore} />
            </label>
            
            <button style={{ ...styles.button, background: '#3b82f6' }} onClick={() => setShowExportLogs(!showExportLogs)}>
              📋 View Export History
            </button>
          </div>
          
          {showExportLogs && (
            <div style={{ marginTop: '20px', maxHeight: '300px', overflowY: 'auto' }}>
              <h4>Export History</h4>
              {exportLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', background: '#f8fafc', borderRadius: '8px' }}>
                  <p style={{ color: '#64748b' }}>No export history yet.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>Records</th>
                      <th style={{ textAlign: 'left', padding: '8px', borderBottom: '1px solid #e2e8f0' }}>File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{log.export_type}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{log.record_count}</td>
                        <td style={{ padding: '8px', borderBottom: '1px solid #e2e8f0' }}>{log.file_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

// ==================== MODAL COMPONENTS ====================

const AddLabModal = ({ newLab, setNewLab, onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Register New Lab</h2>
      <form onSubmit={onSubmit}>
        <div style={styles.grid2}>
          <div><label>Company Name *</label><input type="text" placeholder="Nairobi Diagnostics Ltd" value={newLab.company_name} onChange={(e) => setNewLab({ ...newLab, company_name: e.target.value })} style={styles.input} required /></div>
          <div><label>Lab Display Name *</label><input type="text" placeholder="Nairobi Lab" value={newLab.name} onChange={(e) => setNewLab({ ...newLab, name: e.target.value })} style={styles.input} required /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Admin Email *</label><input type="email" placeholder="admin@lab.co.ke" value={newLab.email} onChange={(e) => setNewLab({ ...newLab, email: e.target.value })} style={styles.input} required /></div>
          <div><label>Admin Password *</label><input type="password" placeholder="••••••••" value={newLab.password} onChange={(e) => setNewLab({ ...newLab, password: e.target.value })} style={styles.input} required /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Phone *</label><input type="tel" placeholder="07XX XXX XXX" value={newLab.phone} onChange={(e) => setNewLab({ ...newLab, phone: e.target.value })} style={styles.input} required /></div>
          <div><label>KRA PIN</label><input type="text" placeholder="P000XXXXXX" value={newLab.kra_pin} onChange={(e) => setNewLab({ ...newLab, kra_pin: e.target.value })} style={styles.input} /></div>
        </div>
        <div><label>Address</label><textarea placeholder="Physical address" value={newLab.address} onChange={(e) => setNewLab({ ...newLab, address: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} /></div>
        <div><label>Subscription Plan</label><select value={newLab.subscription_plan} onChange={(e) => setNewLab({ ...newLab, subscription_plan: e.target.value })} style={styles.select}>
          <option value="basic">Basic - KES 2,000/mo</option>
          <option value="professional">Professional - KES 5,000/mo</option>
          <option value="enterprise">Enterprise - KES 15,000/mo</option>
        </select></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Register Lab</button>
        </div>
      </form>
    </div>
  </div>
);

const AddPatientModal = ({ newPatient, setNewPatient, onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Add New Patient</h2>
      <form onSubmit={onSubmit}>
        <div style={styles.grid2}>
          <div><label>Full Name *</label><input type="text" placeholder="John Doe" value={newPatient.name} onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })} style={styles.input} required /></div>
          <div><label>ID Number</label><input type="text" placeholder="12345678" value={newPatient.id_number} onChange={(e) => setNewPatient({ ...newPatient, id_number: e.target.value })} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Phone *</label><input type="tel" placeholder="07XX XXX XXX" value={newPatient.phone} onChange={(e) => setNewPatient({ ...newPatient, phone: e.target.value })} style={styles.input} required /></div>
          <div><label>Email</label><input type="email" placeholder="john@example.com" value={newPatient.email} onChange={(e) => setNewPatient({ ...newPatient, email: e.target.value })} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Date of Birth</label><input type="date" value={newPatient.date_of_birth} onChange={(e) => setNewPatient({ ...newPatient, date_of_birth: e.target.value })} style={styles.input} /></div>
          <div><label>Gender</label><select value={newPatient.gender} onChange={(e) => setNewPatient({ ...newPatient, gender: e.target.value })} style={styles.select}>
            <option value="">Select</option><option value="male">Male</option><option value="female">Female</option>
          </select></div>
        </div>
        <div><label>Blood Group</label><select value={newPatient.blood_group} onChange={(e) => setNewPatient({ ...newPatient, blood_group: e.target.value })} style={styles.select}>
          <option value="">Select</option><option value="A+">A+</option><option value="A-">A-</option><option value="B+">B+</option><option value="B-">B-</option><option value="O+">O+</option><option value="O-">O-</option><option value="AB+">AB+</option><option value="AB-">AB-</option>
        </select></div>
        <div><label>Address</label><textarea placeholder="Physical address" value={newPatient.address} onChange={(e) => setNewPatient({ ...newPatient, address: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} /></div>
        <div style={styles.grid2}>
          <div><label>Emergency Contact</label><input type="text" placeholder="Next of kin" value={newPatient.emergency_contact} onChange={(e) => setNewPatient({ ...newPatient, emergency_contact: e.target.value })} style={styles.input} /></div>
          <div><label>Emergency Phone</label><input type="tel" placeholder="07XX XXX XXX" value={newPatient.emergency_phone} onChange={(e) => setNewPatient({ ...newPatient, emergency_phone: e.target.value })} style={styles.input} /></div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Add Patient</button>
        </div>
      </form>
    </div>
  </div>
);

const AddTestModal = ({ newTest, setNewTest, onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Add New Test</h2>
      <form onSubmit={onSubmit}>
        <div style={styles.grid2}>
          <div><label>Test Name *</label><input type="text" placeholder="e.g., Complete Blood Count" value={newTest.name} onChange={(e) => setNewTest({ ...newTest, name: e.target.value })} style={styles.input} required /></div>
          <div><label>Category</label><select value={newTest.category} onChange={(e) => setNewTest({ ...newTest, category: e.target.value })} style={styles.select}>
            <option value="blood">Blood Tests</option><option value="urine">Urine Tests</option><option value="imaging">Imaging</option><option value="cardiac">Cardiac</option><option value="hormone">Hormone</option>
          </select></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Price (KES) *</label><input type="number" step="100" placeholder="2000" value={newTest.price} onChange={(e) => setNewTest({ ...newTest, price: e.target.value })} style={styles.input} required /></div>
          <div><label>Sample Type</label><select value={newTest.sample_type} onChange={(e) => setNewTest({ ...newTest, sample_type: e.target.value })} style={styles.select}>
            <option value="Blood">Blood</option><option value="Urine">Urine</option><option value="Stool">Stool</option><option value="Saliva">Saliva</option>
          </select></div>
        </div>
        <div><label>Turnaround Time</label><select value={newTest.turnaround_time} onChange={(e) => setNewTest({ ...newTest, turnaround_time: e.target.value })} style={styles.select}>
          <option value="1 hour">1 hour</option><option value="2 hours">2 hours</option><option value="4 hours">4 hours</option><option value="8 hours">8 hours</option><option value="24 hours">24 hours</option><option value="48 hours">48 hours</option>
        </select></div>
        <div><label>Description</label><textarea placeholder="Test description, preparation instructions" value={newTest.description} onChange={(e) => setNewTest({ ...newTest, description: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Add Test</button>
        </div>
      </form>
    </div>
  </div>
);

const CreateOrderModal = ({ newOrder, setNewOrder, patients, tests, onSubmit, onClose, formatKES, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Create New Order</h2>
      <form onSubmit={onSubmit}>
        <div><label>Select Patient *</label><select value={newOrder.patientId} onChange={(e) => setNewOrder({ ...newOrder, patientId: parseInt(e.target.value) })} style={styles.select} required>
          <option value="">-- Select Patient --</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name} ({p.phone})</option>)}
        </select></div>
        <div><label>Select Tests *</label>
          <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '10px' }}>
            {tests.map(test => (
              <label key={test.id} style={{ display: 'block', padding: '5px' }}>
                <input type="checkbox" value={test.id} checked={newOrder.testIds.includes(test.id)} onChange={(e) => {
                  const testId = test.id;
                  if (e.target.checked) setNewOrder({ ...newOrder, testIds: [...newOrder.testIds, testId] });
                  else setNewOrder({ ...newOrder, testIds: newOrder.testIds.filter(id => id !== testId) });
                }} /> {test.name} - {formatKES(test.price)}
              </label>
            ))}
          </div>
        </div>
        <div style={styles.grid2}>
          <div><label>Doctor's Name</label><input type="text" placeholder="Dr. Smith" value={newOrder.doctor_name} onChange={(e) => setNewOrder({ ...newOrder, doctor_name: e.target.value })} style={styles.input} /></div>
          <div><label>Doctor's Email</label><input type="email" placeholder="doctor@clinic.co.ke" value={newOrder.doctor_email} onChange={(e) => setNewOrder({ ...newOrder, doctor_email: e.target.value })} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Priority</label><select value={newOrder.priority} onChange={(e) => setNewOrder({ ...newOrder, priority: e.target.value })} style={styles.select}>
            <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
          </select></div>
        </div>
        <div><label>Notes</label><textarea placeholder="Any special instructions" value={newOrder.notes} onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Create Order</button>
        </div>
      </form>
    </div>
  </div>
);

const PaymentModal = ({ selectedOrder, payment, setPayment, onSubmit, onClose, formatKES, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Add Payment - Order #{selectedOrder.id}</h2>
      <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Order Total:</span>
          <span style={{ fontWeight: 'bold' }}>{formatKES(selectedOrder.total_amount)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span>Paid So Far:</span>
          <span style={{ color: '#10b981', fontWeight: 'bold' }}>{formatKES(selectedOrder.paid_amount || 0)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', borderTop: '2px dashed #e2e8f0', fontWeight: 'bold', fontSize: '16px' }}>
          <span>Remaining Balance:</span>
          <span style={{ color: (selectedOrder.total_amount - (selectedOrder.paid_amount || 0)) > 0 ? '#ef4444' : '#10b981' }}>
            {formatKES(selectedOrder.total_amount - (selectedOrder.paid_amount || 0))}
          </span>
        </div>
      </div>
      <form onSubmit={onSubmit}>
        <div style={styles.grid2}>
          <div>
            <label>Amount (KES) *</label>
            <input type="number" step="any" min="1" placeholder="Enter amount" value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} style={styles.input} required />
          </div>
          <div>
            <label>Payment Method</label>
            <select value={payment.method} onChange={(e) => setPayment({ ...payment, method: e.target.value })} style={styles.select}>
              <option value="cash">Cash</option>
              <option value="mpesa">M-PESA</option>
              <option value="card">Card</option>
              <option value="bank">Bank Transfer</option>
            </select>
          </div>
        </div>
        {payment.method === 'mpesa' && (
          <div>
            <label>M-PESA Transaction Code</label>
            <input type="text" placeholder="e.g., OKJ4R7T8P9" value={payment.mpesa_code} onChange={(e) => setPayment({ ...payment, mpesa_code: e.target.value })} style={styles.input} required={payment.method === 'mpesa'} />
          </div>
        )}
        <div>
          <label>Notes (Optional)</label>
          <textarea placeholder="Any payment notes" value={payment.notes} onChange={(e) => setPayment({ ...payment, notes: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, background: '#3b82f6' }}>Process Payment</button>
        </div>
      </form>
    </div>
  </div>
);

const OverpaymentModal = ({ overpaymentData, onAction, onClose, formatKES, styles }) => (
  <div style={styles.modal}>
    <div style={{ ...styles.modalContent, maxWidth: '500px' }}>
      <h2 style={{ color: '#856404', margin: '0 0 20px 0' }}>⚠️ Overpayment Detected</h2>
      <div style={styles.warningCard}>
        <p style={{ fontSize: '16px', marginBottom: '15px' }}>
          You are trying to pay <strong>{formatKES(overpaymentData.amount)}</strong> but the remaining balance is <strong>{formatKES(overpaymentData.remainingBalance)}</strong>.
        </p>
        <p style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px' }}>
          Overage: <span style={{ color: '#ef4444' }}>{formatKES(overpaymentData.amount - overpaymentData.remainingBalance)}</span>
        </p>
        <p>How would you like to proceed?</p>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button style={{ ...styles.button, background: '#10b981', flex: 1 }} onClick={() => onAction('credit')}>💰 Add as Store Credit</button>
        <button style={{ ...styles.button, background: '#f59e0b', flex: 1 }} onClick={() => onAction('refund')}>↩️ Refund Overage</button>
      </div>
      <div style={{ marginTop: '10px', textAlign: 'center' }}>
        <button style={{ ...styles.button, background: '#64748b' }} onClick={onClose}>Cancel</button>
      </div>
    </div>
  </div>
);

const LogoUploadModal = ({ logoFile, setLogoFile, logoPreview, setLogoPreview, logoError, setLogoError, onUpload, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2>Upload Lab Logo</h2>
      <div>
        <input type="file" accept="image/*" onChange={(e) => {
          const file = e.target.files[0];
          setLogoFile(file);
          setLogoPreview(URL.createObjectURL(file));
          setLogoError('');
        }} />
        {logoError && <p style={styles.errorText}>{logoError}</p>}
        <p style={{ fontSize: '12px', color: '#64748b', marginTop: '5px' }}>
          Maximum file size: 2MB. Recommended size: 300x300px or smaller.
        </p>
      </div>
      {logoPreview && (
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <img src={logoPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: '200px', objectFit: 'contain' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
        <button style={{ ...styles.button, background: '#64748b' }} onClick={onClose}>Cancel</button>
        <button style={{ ...styles.button, ...styles.buttonSuccess }} onClick={onUpload}>Upload Logo</button>
      </div>
    </div>
  </div>
);

const ReferralModal = ({ referenceLabs, patients, tests, onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2>Create New Referral</h2>
      <form onSubmit={(e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const testCheckboxes = document.querySelectorAll('input[name="tests"]:checked');
        const selectedTests = Array.from(testCheckboxes).map(cb => ({
          id: parseInt(cb.value),
          name: cb.nextSibling?.textContent || 'Test'
        }));
        onSubmit({
          reference_lab_id: parseInt(formData.get('reference_lab_id')),
          patient_id: parseInt(formData.get('patient_id')),
          tests: selectedTests,
          priority: formData.get('priority'),
          clinical_notes: formData.get('clinical_notes'),
          expected_completion: formData.get('expected_completion')
        });
      }}>
        <div><label>Reference Lab *</label><select name="reference_lab_id" style={styles.select} required>
          <option value="">Select Lab</option>
          {referenceLabs.map(lab => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
        </select></div>
        <div><label>Patient *</label><select name="patient_id" style={styles.select} required>
          <option value="">Select Patient</option>
          {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select></div>
        <div><label>Tests *</label>
          <div style={{ maxHeight: '150px', overflowY: 'auto', border: '1px solid #e2e8f0', padding: '10px' }}>
            {tests.map(test => (
              <label key={test.id} style={{ display: 'block', padding: '5px' }}>
                <input type="checkbox" name="tests" value={test.id} /> {test.name}
              </label>
            ))}
          </div>
        </div>
        <div style={styles.grid2}>
          <div><label>Priority</label><select name="priority" style={styles.select}>
            <option value="normal">Normal</option><option value="urgent">Urgent</option><option value="stat">STAT</option>
          </select></div>
          <div><label>Expected Completion</label><input type="date" name="expected_completion" style={styles.input} /></div>
        </div>
        <div><label>Clinical Notes</label><textarea name="clinical_notes" style={{ ...styles.input, minHeight: '80px' }} /></div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button type="button" style={{ ...styles.button, background: '#64748b' }} onClick={onClose}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Send Referral</button>
        </div>
      </form>
    </div>
  </div>
);

const AddReferenceLabModal = ({ onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ margin: '0 0 20px 0' }}>Add Reference Laboratory</h2>
      <form onSubmit={onSubmit}>
        <div>
          <label>Lab Name *</label>
          <input type="text" name="name" placeholder="e.g., Nairobi Reference Lab" style={styles.input} required />
        </div>
        <div>
          <label>Contact Person</label>
          <input type="text" name="contact_person" placeholder="Dr. John Smith" style={styles.input} />
        </div>
        <div style={styles.grid2}>
          <div>
            <label>Phone *</label>
            <input type="tel" name="phone" placeholder="07XX XXX XXX" style={styles.input} required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" name="email" placeholder="info@referencelab.co.ke" style={styles.input} />
          </div>
        </div>
        <div>
          <label>Address</label>
          <textarea name="address" placeholder="Physical address" style={{ ...styles.input, minHeight: '60px' }} />
        </div>
        <div>
          <label>Typical Turnaround Time</label>
          <select name="turnaround_time" style={styles.select}>
            <option value="24 hours">24 hours</option>
            <option value="48 hours">48 hours</option>
            <option value="3 days">3 days</option>
            <option value="5 days">5 days</option>
            <option value="1 week">1 week</option>
          </select>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Add Reference Lab</button>
        </div>
      </form>
    </div>
  </div>
);

const ReceiveResultsModal = ({ selectedReferralForResults, manualResults, setManualResults, onSubmit, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={{ ...styles.modalContent, maxWidth: '800px' }}>
      <h2 style={{ margin: '0 0 20px 0' }}>
        Enter Results for Referral #{selectedReferralForResults?.referral_number}
      </h2>
      
      <form onSubmit={onSubmit}>
        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
            <div><strong>Patient:</strong> {selectedReferralForResults?.patient_name}</div>
            <div><strong>Reference Lab:</strong> {selectedReferralForResults?.reference_lab_name}</div>
            <div><strong>Referral Date:</strong> {new Date(selectedReferralForResults?.created_at).toLocaleDateString()}</div>
            <div><strong>Status:</strong> {selectedReferralForResults?.status}</div>
          </div>
        </div>
        
        <h3>Test Results</h3>
        <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '20px' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Test Name</th>
                <th style={styles.th}>Result</th>
                <th style={styles.th}>Reference Range</th>
                <th style={styles.th}>Unit</th>
                <th style={styles.th}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {manualResults.test_results.map((test, index) => (
                <tr key={test.test_id}>
                  <td style={styles.td}>{test.test_name}</td>
                  <td style={styles.td}>
                    <input type="text" value={test.result_value} onChange={(e) => {
                      const updatedTests = [...manualResults.test_results];
                      updatedTests[index].result_value = e.target.value;
                      setManualResults({ ...manualResults, test_results: updatedTests });
                    }} style={{ ...styles.input, margin: 0 }} placeholder="Enter result" />
                  </td>
                  <td style={styles.td}>
                    <input type="text" value={test.reference_range} onChange={(e) => {
                      const updatedTests = [...manualResults.test_results];
                      updatedTests[index].reference_range = e.target.value;
                      setManualResults({ ...manualResults, test_results: updatedTests });
                    }} style={{ ...styles.input, margin: 0 }} placeholder="e.g., 4.0-11.0" />
                  </td>
                  <td style={styles.td}>
                    <input type="text" value={test.unit} onChange={(e) => {
                      const updatedTests = [...manualResults.test_results];
                      updatedTests[index].unit = e.target.value;
                      setManualResults({ ...manualResults, test_results: updatedTests });
                    }} style={{ ...styles.input, margin: 0 }} placeholder="Unit" />
                  </td>
                  <td style={styles.td}>
                    <select value={test.interpretation} onChange={(e) => {
                      const updatedTests = [...manualResults.test_results];
                      updatedTests[index].interpretation = e.target.value;
                      setManualResults({ ...manualResults, test_results: updatedTests });
                    }} style={styles.select}>
                      <option value="normal">Normal</option>
                      <option value="abnormal">Abnormal</option>
                      <option value="critical">Critical</option>
                      <option value="pending">Pending</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={styles.grid2}>
          <div>
            <label>Result Date *</label>
            <input type="date" value={manualResults.result_date} onChange={(e) => setManualResults({ ...manualResults, result_date: e.target.value })} style={styles.input} required />
          </div>
          <div>
            <label>Conducted By</label>
            <input type="text" value={manualResults.conducted_by} onChange={(e) => setManualResults({ ...manualResults, conducted_by: e.target.value })} style={styles.input} placeholder="e.g., Dr. Smith" />
          </div>
        </div>
        
        <div>
          <label>Summary/Additional Results</label>
          <textarea value={manualResults.results_text} onChange={(e) => setManualResults({ ...manualResults, results_text: e.target.value })} style={{ ...styles.input, minHeight: '80px' }} placeholder="Enter any additional results or notes that don't fit in the table above" />
        </div>
        
        <div>
          <label>Upload Result File (Optional)</label>
          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => setManualResults({ ...manualResults, result_file: e.target.files[0] })} style={styles.input} />
          <small style={{ color: '#64748b' }}>Upload scanned results, PDF reports, or images</small>
        </div>
        
        <div>
          <label>Additional Notes</label>
          <textarea value={manualResults.notes} onChange={(e) => setManualResults({ ...manualResults, notes: e.target.value })} style={{ ...styles.input, minHeight: '60px' }} placeholder="Any additional notes about these results" />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} style={{ ...styles.button, background: '#64748b' }}>Cancel</button>
          <button type="submit" style={{ ...styles.button, ...styles.buttonSuccess }}>Save Results</button>
        </div>
      </form>
    </div>
  </div>
);

const ViewReferralResultsModal = ({ referralResultsData, onPrint, onDownload, onClose, styles }) => (
  <div style={styles.modal}>
    <div style={{ ...styles.modalContent, maxWidth: '900px' }}>
      <h2 style={{ margin: '0 0 20px 0' }}>
        Referral Results - {referralResultsData?.referral_number}
      </h2>
      
      {referralResultsData && (
        <>
          <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              <div><strong>Patient:</strong> {referralResultsData.patient_name}</div>
              <div><strong>Lab:</strong> {referralResultsData.reference_lab_name}</div>
              <div><strong>Result Date:</strong> {new Date(referralResultsData.result_date).toLocaleDateString()}</div>
              <div><strong>Conducted By:</strong> {referralResultsData.conducted_by || 'N/A'}</div>
            </div>
          </div>
          
          {referralResultsData.test_results?.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Test Results</h3>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Test</th>
                    <th style={styles.th}>Result</th>
                    <th style={styles.th}>Reference Range</th>
                    <th style={styles.th}>Unit</th>
                    <th style={styles.th}>Interpretation</th>
                  </tr>
                </thead>
                <tbody>
                  {referralResultsData.test_results.map((test, index) => (
                    <tr key={index}>
                      <td style={styles.td}>{test.test_name}</td>
                      <td style={styles.td}>{test.result_value}</td>
                      <td style={styles.td}>{test.reference_range}</td>
                      <td style={styles.td}>{test.unit}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.badge,
                          background: test.interpretation === 'normal' ? '#d1fae5' :
                                     test.interpretation === 'abnormal' ? '#fed7aa' :
                                     test.interpretation === 'critical' ? '#fee2e2' : '#e2e8f0',
                          color: test.interpretation === 'normal' ? '#065f46' :
                                 test.interpretation === 'abnormal' ? '#92400e' :
                                 test.interpretation === 'critical' ? '#991b1b' : '#475569'
                        }}>
                          {test.interpretation}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {referralResultsData.results_text && (
            <div style={{ marginBottom: '20px' }}>
              <h3>Results Summary</h3>
              <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '8px', whiteSpace: 'pre-wrap' }}>
                {referralResultsData.results_text}
              </div>
            </div>
          )}
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button style={{ ...styles.button, background: '#10b981' }} onClick={() => onPrint(referralResultsData.referral_id)}>🖨️ Print</button>
            <button style={{ ...styles.button, background: '#f59e0b' }} onClick={() => onDownload(referralResultsData.referral_id)}>⬇️ Download</button>
            <button style={{ ...styles.button, background: '#64748b' }} onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </div>
  </div>
);

export default Dashboard;