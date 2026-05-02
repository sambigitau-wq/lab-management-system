import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

// ------------------ Helper Components ------------------
const StatCard = ({ title, value, color, bgColor }) => (
  <div style={{ ...styles.statCard, background: bgColor || 'white' }}>
    <h3>{title}</h3>
    <p style={{ fontSize: '24px', fontWeight: 'bold', color: color || '#000' }}>{value}</p>
  </div>
);

const Badge = ({ children, type }) => {
  const getStyles = () => {
    switch(type) {
      case 'success': return { background: '#d1fae5', color: '#065f46' };
      case 'warning': return { background: '#fee2e2', color: '#991b1b' };
      case 'info': return { background: '#dbeafe', color: '#1e40af' };
      default: return { background: '#e2e8f0', color: '#334155' };
    }
  };
  return <span style={{ ...styles.badge, ...getStyles() }}>{children}</span>;
};

const Button = ({ children, onClick, variant = 'primary', style, ...props }) => {
  const getVariantStyle = () => {
    switch(variant) {
      case 'success': return { background: '#10b981' };
      case 'danger': return { background: '#ef4444' };
      case 'warning': return { background: '#f59e0b' };
      case 'secondary': return { background: '#64748b' };
      default: return { background: '#3b82f6' };
    }
  };
  return (
    <button
      onClick={onClick}
      style={{ ...styles.button, ...getVariantStyle(), ...style }}
      {...props}
    >
      {children}
    </button>
  );
};

// ------------------ Main Component ------------------
const POSDashboard = ({ token, API_URL, formatKES, user, onSaleComplete }) => {
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [inventoryTransactions, setInventoryTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState([]);
  
  // Report states
  const [reportType, setReportType] = useState('sales');
  const [todaySales, setTodaySales] = useState(0);
  const [weekSales, setWeekSales] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  
  // Form states
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [newProduct, setNewProduct] = useState({
    name: '', description: '', sku: '', barcode: '', category: 'general',
    price: '', cost_price: '', tax_rate: 0, stock_quantity: 0,
    low_stock_threshold: 10, unit: 'piece'
  });
  const [checkoutData, setCheckoutData] = useState({
    customer_name: '', customer_phone: '', customer_email: '',
    payment_method: 'cash', mpesa_code: '', discount: 0, notes: ''
  });

  // Profit report date range
  const [profitDateFrom, setProfitDateFrom] = useState(() => {
    const date = new Date(); date.setDate(1); return date.toISOString().split('T')[0];
  });
  const [profitDateTo, setProfitDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [profitData, setProfitData] = useState({
    totalRevenue: 0, totalCost: 0, grossProfit: 0, profitMargin: 0,
    profitPercentage: 0, totalTransactions: 0, totalItems: 0,
    averageOrder: 0, profitPerItem: 0, productBreakdown: []
  });

  // ------------------ Data Fetching ------------------
  const fetchProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProducts(res.data);
      const cats = [...new Set(res.data.map(p => p.category))];
      setCategories(cats);
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  }, [API_URL, token]);

  const fetchCart = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pos/cart`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCart(res.data);
      setCartItems(res.data.items || []);
    } catch (err) {
      console.error('Error fetching cart:', err);
    }
  }, [API_URL, token]);

  const fetchSales = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/pos/sales?limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const salesWithNumbers = res.data.map(sale => ({
        ...sale,
        subtotal: parseFloat(sale.subtotal) || 0,
        tax_total: parseFloat(sale.tax_total) || 0,
        discount_total: parseFloat(sale.discount_total) || 0,
        total: parseFloat(sale.total) || 0
      }));
      setSales(salesWithNumbers);
    } catch (err) {
      console.error('Error fetching sales:', err);
    }
  }, [API_URL, token]);

  const fetchInventoryTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/api/inventory/transactions?limit=50`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInventoryTransactions(res.data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    }
  }, [API_URL, token]);

  const fetchReportData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const salesRes = await axios.get(`${API_URL}/api/pos/sales?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const salesData = salesRes.data;
      
      const todayTotal = salesData
        .filter(s => new Date(s.created_at).toISOString().split('T')[0] === today)
        .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const weekTotal = salesData
        .filter(s => new Date(s.created_at) >= weekAgo)
        .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      
      const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthTotal = salesData
        .filter(s => new Date(s.created_at) >= monthAgo)
        .reduce((sum, s) => sum + (parseFloat(s.total) || 0), 0);
      
      setTodaySales(todayTotal);
      setWeekSales(weekTotal);
      setMonthSales(monthTotal);
    } catch (err) {
      console.error('Error fetching report data:', err);
    }
  }, [API_URL, token]);

  useEffect(() => {
    fetchProducts();
    fetchCart();
    fetchSales();
    fetchInventoryTransactions();
    fetchReportData();
  }, [fetchProducts, fetchCart, fetchSales, fetchInventoryTransactions, fetchReportData]);

  // ------------------ Profit Report ------------------
  const fetchProfitData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all sales in date range
      const salesRes = await axios.get(`${API_URL}/api/pos/sales?limit=1000`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filteredSales = salesRes.data.filter(sale => {
        const saleDate = new Date(sale.created_at).toISOString().split('T')[0];
        return saleDate >= profitDateFrom && saleDate <= profitDateTo;
      });

      // Fetch products to get cost prices
      const productsRes = await axios.get(`${API_URL}/api/products`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const productMap = {};
      productsRes.data.forEach(p => {
        productMap[p.id] = {
          name: p.name,
          cost_price: Number(p.cost_price) || 0
        };
      });

      // Fetch all sale items for these sales (if backend supports filtering by sale IDs)
      // For efficiency, we'll fetch items per sale (N+1) but you can optimize with a batch endpoint
      let totalRevenue = 0, totalCost = 0, totalTransactions = filteredSales.length, totalItems = 0;
      const productProfit = {};

      for (const sale of filteredSales) {
        totalRevenue += Number(sale.total) || 0;
        try {
          const itemsRes = await axios.get(`${API_URL}/api/pos/sales/${sale.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const items = itemsRes.data.items || [];
          items.forEach(item => {
            totalItems += Number(item.quantity) || 0;
            const productId = item.product_id;
            const quantity = Number(item.quantity) || 0;
            const unitPrice = Number(item.unit_price) || 0;
            const costPrice = productMap[productId]?.cost_price || 0;
            
            const itemRevenue = unitPrice * quantity;
            const itemCost = costPrice * quantity;
            totalCost += itemCost;

            if (!productProfit[productId]) {
              productProfit[productId] = {
                name: productMap[productId]?.name || item.product_name,
                quantity: 0, revenue: 0, cost: 0
              };
            }
            productProfit[productId].quantity += quantity;
            productProfit[productId].revenue += itemRevenue;
            productProfit[productId].cost += itemCost;
          });
        } catch (err) {
          console.error('Error fetching sale items for sale', sale.id, err);
        }
      }

      const grossProfit = totalRevenue - totalCost;
      const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : 0;
      const profitPercentage = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(0) : 0;
      const averageOrder = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
      const profitPerItem = totalItems > 0 ? grossProfit / totalItems : 0;

      const productBreakdown = Object.values(productProfit).map(p => ({
        name: p.name,
        quantity: p.quantity,
        revenue: p.revenue,
        cost: p.cost,
        profit: p.revenue - p.cost,
        margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(1) : 0
      })).sort((a, b) => b.profit - a.profit);

      setProfitData({
        totalRevenue, totalCost, grossProfit, profitMargin, profitPercentage,
        totalTransactions, totalItems, averageOrder, profitPerItem, productBreakdown
      });
    } catch (err) {
      console.error('Error fetching profit data:', err);
      alert('Error generating profit report');
    } finally {
      setLoading(false);
    }
  }, [API_URL, token, profitDateFrom, profitDateTo]);

  useEffect(() => {
    if (activeTab === 'reports' && reportType === 'profit') {
      fetchProfitData();
    }
  }, [activeTab, reportType, fetchProfitData]);

  // ------------------ Cart Actions ------------------
  const handleAddToCart = async (product, quantity = 1) => {
    try {
      const res = await axios.post(`${API_URL}/api/pos/cart/items`, {
        product_id: product.id, quantity
      }, { headers: { Authorization: `Bearer ${token}` } });
      setCartItems(res.data.items);
      alert(`✅ Added ${product.name} to cart`);
    } catch (err) {
      alert('❌ Error adding to cart: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleRemoveFromCart = async (productId) => {
    try {
      const res = await axios.delete(`${API_URL}/api/pos/cart/items/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCartItems(res.data.items);
    } catch (err) {
      alert('❌ Error removing from cart: ' + err.message);
    }
  };

  const updateCartItemQuantity = async (productId, newQuantity) => {
    if (newQuantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }
    try {
      // Simpler: remove and re-add (or use a PUT endpoint if available)
      await axios.delete(`${API_URL}/api/pos/cart/items/${productId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const product = products.find(p => p.id === productId);
      await axios.post(`${API_URL}/api/pos/cart/items`, {
        product_id: productId, quantity: newQuantity
      }, { headers: { Authorization: `Bearer ${token}` } });
      fetchCart(); // refresh
    } catch (err) {
      alert('Error updating quantity: ' + err.message);
    }
  };

  // ------------------ Product Actions ------------------
  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setNewProduct({
      name: product.name, description: product.description || '', sku: product.sku || '',
      barcode: product.barcode || '', category: product.category || 'general',
      price: product.price, cost_price: product.cost_price || '',
      tax_rate: product.tax_rate || 0, stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold || 10, unit: product.unit || 'piece'
    });
    setShowAddProduct(true);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      if (selectedProduct) {
        await axios.put(`${API_URL}/api/products/${selectedProduct.id}`, newProduct, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Product updated successfully!');
      } else {
        await axios.post(`${API_URL}/api/products`, newProduct, {
          headers: { Authorization: `Bearer ${token}` }
        });
        alert('✅ Product added successfully!');
      }
      setShowAddProduct(false);
      setSelectedProduct(null);
      setNewProduct({ name: '', description: '', sku: '', barcode: '', category: 'general',
        price: '', cost_price: '', tax_rate: 0, stock_quantity: 0,
        low_stock_threshold: 10, unit: 'piece' });
      fetchProducts();
    } catch (err) {
      alert('❌ Error: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleUpdateStock = async (product) => {
    const quantity = prompt(`Enter quantity to add/remove for ${product.name} (use negative for removal):`, "0");
    if (quantity === null) return;
    const parsedQty = parseInt(quantity);
    if (isNaN(parsedQty)) {
      alert('Please enter a valid number');
      return;
    }
    try {
      await axios.post(`${API_URL}/api/products/${product.id}/stock`, {
        quantity: parsedQty,
        transaction_type: parsedQty > 0 ? 'purchase' : 'sale',
        notes: 'Manual stock adjustment'
      }, { headers: { Authorization: `Bearer ${token}` } });
      alert(`✅ Stock updated successfully!`);
      fetchProducts();
      fetchInventoryTransactions();
    } catch (err) {
      alert('❌ Error updating stock: ' + (err.response?.data?.error || err.message));
    }
  };

  // ------------------ Checkout ------------------
  const handleCheckout = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(`${API_URL}/api/pos/checkout`, checkoutData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert(`✅ Sale completed! Receipt #: ${res.data.receipt_number}`);
      setShowCheckout(false);
      setCheckoutData({ customer_name: '', customer_phone: '', customer_email: '',
        payment_method: 'cash', mpesa_code: '', discount: 0, notes: '' });
      fetchCart();
      fetchSales();
      fetchReportData();
      if (typeof onSaleComplete === 'function') onSaleComplete();
    } catch (err) {
      alert('❌ Checkout failed: ' + (err.response?.data?.error || err.message));
    }
  };

  // ------------------ Receipt Printing (fixed) ------------------
  const handlePrintReceipt = async (sale) => {
    try {
      // Fetch sale items
      const itemsRes = await axios.get(`${API_URL}/api/pos/sales/${sale.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const items = itemsRes.data.items || [];

      const formatKESLocal = (amount) => {
        return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
      };

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt ${sale.receipt_number}</title>
            <style>
              body { font-family: Arial; padding: 20px; max-width: 400px; margin: 0 auto; }
              .header { text-align: center; margin-bottom: 20px; }
              .lab-name { font-size: 24px; font-weight: bold; }
              .receipt-details { margin-bottom: 20px; }
              .items { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
              .items th { text-align: left; border-bottom: 2px solid #000; }
              .items td { padding: 5px 0; border-bottom: 1px solid #ccc; }
              .total { font-weight: bold; font-size: 18px; text-align: right; margin-top: 20px; }
              .footer { text-align: center; margin-top: 30px; font-size: 12px; color: #666; }
              .no-print { text-align: center; margin-top: 20px; }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="header">
              <div class="lab-name">${user?.lab_name || 'Laboratory'}</div>
              <p>${user?.lab_address || ''}</p>
              <p>Tel: ${user?.lab_phone || ''}</p>
            </div>
            <div class="receipt-details">
              <p><strong>Receipt:</strong> ${sale.receipt_number}</p>
              <p><strong>Date:</strong> ${new Date(sale.created_at).toLocaleString()}</p>
              <p><strong>Cashier:</strong> ${user?.name || user?.email || 'Staff'}</p>
              <p><strong>Customer:</strong> ${sale.customer_name || 'Walk-in'}</p>
            </div>
            <table class="items">
              <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}</td>
                    <td>${formatKESLocal(item.unit_price)}</td>
                    <td>${formatKESLocal(item.total)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="total">
              <p>Total: ${formatKESLocal(sale.total)}</p>
              <p>Payment: ${sale.payment_method}</p>
            </div>
            <div class="footer">
              <p>Thank you for your business!</p>
              <p>Goods sold are not returnable</p>
            </div>
            <div class="no-print">
              <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Receipt</button>
              <button onclick="window.close()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch (err) {
      alert('Error fetching receipt details');
    }
  };

// Add this with your other handle functions (around line 200-220)
const handleDeleteProduct = async (productId, productName) => {
  if (user?.role !== 'admin') {
    alert('❌ Only admins can delete products');
    return;
  }
  
  try {
    await axios.delete(`${API_URL}/api/products/${productId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    alert(`✅ Product "${productName}" deleted successfully`);
    fetchProducts(); // Refresh the product list
    
  } catch (err) {
    alert('❌ Error deleting product: ' + (err.response?.data?.error || err.message));
  }
};

  // ------------------ Profit Report Export (fixed) ------------------
  const exportProfitToCSV = () => {
    const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
    let csv = 'Product,Quantity Sold,Revenue,Cost,Profit,Margin\n';
    profitData.productBreakdown.forEach(item => {
      csv += `${escapeCSV(item.name)},${item.quantity},${item.revenue},${item.cost},${item.profit},${item.margin}%\n`;
    });
    csv += `\nSummary,,,,,\n`;
    csv += `Total Revenue,,${profitData.totalRevenue},,,\n`;
    csv += `Total Cost,,${profitData.totalCost},,,\n`;
    csv += `Gross Profit,,${profitData.grossProfit},,,\n`;
    csv += `Profit Margin,,${profitData.profitMargin}%,,,\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `profit-report-${profitDateFrom}-to-${profitDateTo}.csv`;
    link.click();
  };

  // ------------------ Profit Report Print (fixed) ------------------
  // Find this function (around line 540)
const printProfitReport = () => {
  const formatKESLocal = (amount) => {
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  // Try to get logo
  let logoHtml = '';
  if (labLogoUrl) {
    logoHtml = `<img src="${labLogoUrl}" style="max-width: 120px; max-height: 60px; margin-bottom: 10px;" />`;
  }

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Profit & Loss Report</title>
        <style>
          body { font-family: Arial; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          h1 { text-align: center; }
          .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
          .card { padding: 15px; border-radius: 5px; text-align: center; }
          .revenue { background: #dbeafe; }
          .cost { background: #fee2e2; }
          .profit { background: #dcfce7; }
          .margin { background: #fef9c3; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background: #f3f4f6; padding: 10px; text-align: left; }
          td { padding: 8px; border-bottom: 1px solid #ddd; }
          .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          ${logoHtml}
          <h1>Profit & Loss Report</h1>
          <p>Period: ${new Date(profitDateFrom).toLocaleDateString()} to ${new Date(profitDateTo).toLocaleDateString()}</p>
        </div>
        <div class="summary">
          <div class="card revenue"><h3>Total Revenue</h3><p style="font-size: 24px;">${formatKESLocal(profitData.totalRevenue)}</p></div>
          <div class="card cost"><h3>Total Cost</h3><p style="font-size: 24px;">${formatKESLocal(profitData.totalCost)}</p></div>
          <div class="card profit"><h3>Gross Profit</h3><p style="font-size: 24px;">${formatKESLocal(profitData.grossProfit)}</p></div>
          <div class="card margin"><h3>Profit Margin</h3><p style="font-size: 24px;">${profitData.profitMargin}%</p></div>
        </div>
        <h3>Profit Breakdown by Product</h3>
        <table>
          <thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th><th>Cost</th><th>Profit</th><th>Margin</th></tr></thead>
          <tbody>
            ${profitData.productBreakdown.map(item => `
              <tr>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${formatKESLocal(item.revenue)}</td>
                <td>${formatKESLocal(item.cost)}</td>
                <td style="color: ${item.profit >= 0 ? '#10b981' : '#ef4444'}; font-weight: bold;">${formatKESLocal(item.profit)}</td>
                <td>${item.margin}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          <p>Report generated on ${new Date().toLocaleString()}</p>
        </div>
        <div class="no-print" style="text-align: center; margin-top: 20px;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #3b82f6; color: white; border: none; border-radius: 5px; cursor: pointer;">Print Report</button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #64748b; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">Close</button>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};
  // ------------------ Memoized values ------------------
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (p.barcode && p.barcode.includes(searchTerm));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + (parseFloat(item.total) || 0), 0), [cartItems]);
  const cartTax = useMemo(() => cartItems.reduce((sum, item) => sum + ((parseFloat(item.total) || 0) * ((item.tax_rate || 0) / 100)), 0), [cartItems]);

  const lowStockProducts = useMemo(() => products.filter(p => p.stock_quantity <= p.low_stock_threshold), [products]);

  // ------------------ Render ------------------
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1>🛒 Point of Sale</h1>
        <div>
          <Button onClick={() => setActiveTab('pos')} variant={activeTab === 'pos' ? 'primary' : 'secondary'}>POS</Button>
          <Button onClick={() => setActiveTab('products')} variant={activeTab === 'products' ? 'success' : 'secondary'}>Products</Button>
          <Button onClick={() => setActiveTab('sales')} variant={activeTab === 'sales' ? 'warning' : 'secondary'}>Sales</Button>
          <Button onClick={() => setActiveTab('inventory')} variant={activeTab === 'inventory' ? 'primary' : 'secondary'}>Inventory</Button>
          <Button onClick={() => setActiveTab('reports')} variant={activeTab === 'reports' ? 'danger' : 'secondary'}>Reports</Button>
        </div>
      </div>

      {/* POS Tab */}
      {activeTab === 'pos' && (
        <div style={styles.posGrid}>
          <ProductList
            products={filteredProducts}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            categories={categories}
            onAddToCart={handleAddToCart}
            formatKES={formatKES}
          />
          <Cart
            cartItems={cartItems}
            cartTotal={cartTotal}
            cartTax={cartTax}
            onUpdateQuantity={updateCartItemQuantity}
            onRemove={handleRemoveFromCart}
            onCheckout={() => setShowCheckout(true)}
            formatKES={formatKES}
          />
        </div>
      )}

      {/* Products Tab */}
      {activeTab === 'products' && (
        <ProductsTab
          products={products}
          onEdit={handleEditProduct}
          onUpdateStock={handleUpdateStock}
          onAdd={() => {
            setSelectedProduct(null);
            setNewProduct({ name: '', description: '', sku: '', barcode: '', category: 'general',
              price: '', cost_price: '', tax_rate: 0, stock_quantity: 0,
              low_stock_threshold: 10, unit: 'piece' });
            setShowAddProduct(true);
          }}
          formatKES={formatKES}
user={user}                    // ← ADD THIS
    onDeleteProduct={handleDeleteProduct}  // ← ADD THIS
        />
      )}

      {/* Sales Tab */}
      {activeTab === 'sales' && (
        <SalesTab
          sales={sales}
          onView={(sale) => alert(`Sale Details:
Receipt: ${sale.receipt_number}
Date: ${new Date(sale.created_at).toLocaleString()}
Customer: ${sale.customer_name || 'Walk-in'}
Items: ${sale.item_count}
Total: ${formatKES(sale.total)}
Payment: ${sale.payment_method}`)}
          onPrint={handlePrintReceipt}
          formatKES={formatKES}
        />
      )}

      {/* Inventory Tab */}
      {activeTab === 'inventory' && (
        <InventoryTab
          lowStockProducts={lowStockProducts}
          inventoryTransactions={inventoryTransactions}
          onRestock={handleUpdateStock}
          onRefresh={fetchInventoryTransactions}
          formatKES={formatKES}
        />
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <ReportsTab
          reportType={reportType}
          setReportType={setReportType}
          todaySales={todaySales}
          weekSales={weekSales}
          monthSales={monthSales}
          productsCount={products.length}
          sales={sales}
          products={products}
          profitDateFrom={profitDateFrom}
          setProfitDateFrom={setProfitDateFrom}
          profitDateTo={profitDateTo}
          setProfitDateTo={setProfitDateTo}
          profitData={profitData}
          onGenerateProfit={fetchProfitData}
          onExportCSV={exportProfitToCSV}
          onPrintReport={printProfitReport}
          formatKES={formatKES}
          loading={loading}
        />
      )}

      {/* Modals */}
      {showAddProduct && (
        <ProductModal
          product={newProduct}
          setProduct={setNewProduct}
          onSubmit={handleAddProduct}
          onClose={() => setShowAddProduct(false)}
          isEdit={!!selectedProduct}
        />
      )}

      {showCheckout && (
        <CheckoutModal
          checkoutData={checkoutData}
          setCheckoutData={setCheckoutData}
          onSubmit={handleCheckout}
          onClose={() => setShowCheckout(false)}
          cartTotal={cartTotal}
          cartTax={cartTax}
          formatKES={formatKES}
        />
      )}
    </div>
  );
};

// ------------------ Subcomponents (simplified for brevity, you can move to separate files) ------------------
const ProductList = ({ products, searchTerm, setSearchTerm, selectedCategory, setSelectedCategory, categories, onAddToCart, formatKES }) => (
  <div>
    <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
      <input
        type="text"
        placeholder="Search products..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{ ...styles.input, flex: 1 }}
      />
      <select
        value={selectedCategory}
        onChange={(e) => setSelectedCategory(e.target.value)}
        style={{ ...styles.select, width: '200px' }}
      >
        <option value="all">All Categories</option>
        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
      </select>
    </div>
    <div style={styles.productsGrid}>
      {products.map(product => (
        <div key={product.id} style={styles.productCard} onClick={() => onAddToCart(product)}>
          <h3 style={{ margin: '0 0 10px 0' }}>{product.name}</h3>
          <p style={{ margin: '5px 0', color: '#64748b' }}>{product.category}</p>
          <p style={{ margin: '5px 0', fontSize: '18px', fontWeight: 'bold' }}>{formatKES(product.price)}</p>
          <p style={{ margin: '5px 0', fontSize: '12px' }}>Stock: {product.stock_quantity} {product.unit}</p>
          {product.stock_quantity <= product.low_stock_threshold && (
            <Badge type="warning">Low Stock</Badge>
          )}
        </div>
      ))}
    </div>
  </div>
);

const Cart = ({ cartItems, cartTotal, cartTax, onUpdateQuantity, onRemove, onCheckout, formatKES }) => (
  <div style={styles.cartCard}>
    <h2 style={{ margin: '0 0 20px 0' }}>🛒 Current Sale</h2>
    {cartItems.length === 0 ? (
      <p style={{ color: '#94a3b8', textAlign: 'center', padding: '20px' }}>Cart is empty. Click on products to add.</p>
    ) : (
      <>
        {cartItems.map((item, idx) => (
          <div key={idx} style={styles.cartItem}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>{item.name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '5px' }}>
                <button onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)} style={styles.qtyBtn}>−</button>
                <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                <button onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)} style={styles.qtyBtn}>+</button>
                <span style={{ marginLeft: '10px', fontWeight: 'bold' }}>{formatKES(item.total)}</span>
              </div>
            </div>
            <button onClick={() => onRemove(item.product_id)} style={styles.removeBtn}>✕</button>
          </div>
        ))}
        <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '2px solid #e2e8f0' }}>
          <div style={styles.summaryRow}><span>Subtotal:</span><span>{formatKES(cartTotal)}</span></div>
          <div style={styles.summaryRow}><span>Tax:</span><span>{formatKES(cartTax)}</span></div>
          <div style={{ ...styles.summaryRow, fontSize: '18px', fontWeight: 'bold' }}><span>Total:</span><span>{formatKES(cartTotal + cartTax)}</span></div>
          <Button variant="success" style={{ width: '100%', marginTop: '20px' }} onClick={onCheckout}>Checkout</Button>
        </div>
      </>
    )}
  </div>
);

const ProductsTab = ({ products, onEdit, onUpdateStock, onAdd, formatKES, user, onDeleteProduct }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
      <h2>Product Catalog</h2>
      <Button variant="success" onClick={onAdd}>➕ Add Product</Button>
    </div>
    <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#f8fafc' }}>
          <th style={styles.th}>Name</th><th style={styles.th}>SKU</th><th style={styles.th}>Category</th>
          <th style={styles.th}>Price</th><th style={styles.th}>Stock</th><th style={styles.th}>Status</th><th style={styles.th}>Actions</th>
        </tr></thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={styles.td}>{p.name}</td>
              <td style={styles.td}>{p.sku || '-'}</td>
              <td style={styles.td}>{p.category}</td>
              <td style={styles.td}>{formatKES(p.price)}</td>
              <td style={styles.td}>
                <Badge type={p.stock_quantity <= p.low_stock_threshold ? 'warning' : 'success'}>
                  {p.stock_quantity} {p.unit}
                </Badge>
              </td>
              <td style={styles.td}>{p.is_active ? 'Active' : 'Inactive'}</td>
              <td style={styles.td}>
                <Button style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => onEdit(p)}>Edit</Button>
                <Button variant="success" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => onUpdateStock(p)}>Stock</Button>
                {/* ADD THIS DELETE BUTTON */}
                {user?.role === 'admin' && (
                  <Button 
                    variant="danger" 
                    style={{ padding: '5px 10px', fontSize: '12px', marginLeft: '5px' }}
                    onClick={() => {
                      if(window.confirm(`Are you sure you want to delete ${p.name}?`)) {
                        onDeleteProduct(p.id, p.name);
                      }
                    }}
                  >
                    🗑️ Delete
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
 </div>
);

  
const SalesTab = ({ sales, onView, onPrint, formatKES }) => (
  <div>
    <h2>Sales History</h2>
    <div style={{ background: 'white', borderRadius: '8px', overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#f8fafc' }}>
          <th style={styles.th}>Receipt #</th><th style={styles.th}>Date</th><th style={styles.th}>Customer</th>
          <th style={styles.th}>Items</th><th style={styles.th}>Total</th><th style={styles.th}>Payment</th><th style={styles.th}>Actions</th>
        </tr></thead>
        <tbody>
          {sales.map(sale => (
            <tr key={sale.id}>
              <td style={styles.td}>{sale.receipt_number}</td>
              <td style={styles.td}>{new Date(sale.created_at).toLocaleString()}</td>
              <td style={styles.td}>{sale.customer_name || 'Walk-in'}</td>
              <td style={styles.td}>{sale.item_count || 0} items</td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>{formatKES(sale.total)}</td>
              <td style={styles.td}>{sale.payment_method}</td>
              <td style={styles.td}>
                <Button style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => onView(sale)}>View</Button>
                <Button variant="success" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => onPrint(sale)}>Print</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const InventoryTab = ({ lowStockProducts, inventoryTransactions, onRestock, onRefresh, formatKES }) => (
  <div>
    <h2>Inventory Management</h2>
    {lowStockProducts.length > 0 && (
      <div style={{ ...styles.card, marginBottom: '20px', background: '#fff3cd', border: '1px solid #ffeeba' }}>
        <h3 style={{ color: '#856404' }}>⚠️ Low Stock Alerts ({lowStockProducts.length})</h3>
        <table style={styles.table}>
          <thead><tr><th style={styles.th}>Product</th><th style={styles.th}>Current Stock</th><th style={styles.th}>Threshold</th><th style={styles.th}>Action</th></tr></thead>
          <tbody>
            {lowStockProducts.map(p => (
              <tr key={p.id}>
                <td style={styles.td}>{p.name}</td>
                <td style={{ ...styles.td, color: '#dc3545', fontWeight: 'bold' }}>{p.stock_quantity}</td>
                <td style={styles.td}>{p.low_stock_threshold}</td>
                <td style={styles.td}>
                  <Button variant="success" style={{ padding: '5px 10px', fontSize: '12px' }} onClick={() => onRestock(p)}>Restock</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    <div style={styles.card}>
      <h3>Recent Stock Movements</h3>
      <Button variant="info" style={{ marginBottom: '15px' }} onClick={onRefresh}>Refresh</Button>
      <table style={styles.table}>
        <thead><tr>
          <th style={styles.th}>Date</th><th style={styles.th}>Product</th><th style={styles.th}>Type</th>
          <th style={styles.th}>Quantity</th><th style={styles.th}>Previous</th><th style={styles.th}>New</th><th style={styles.th}>User</th>
        </tr></thead>
        <tbody>
          {inventoryTransactions.map(t => (
            <tr key={t.id}>
              <td style={styles.td}>{new Date(t.created_at).toLocaleString()}</td>
              <td style={styles.td}>{t.product_name}</td>
              <td style={styles.td}>
                <Badge type={t.transaction_type === 'purchase' ? 'success' : 'warning'}>
                  {t.transaction_type}
                </Badge>
              </td>
              <td style={{ ...styles.td, fontWeight: 'bold' }}>{t.quantity > 0 ? `+${t.quantity}` : t.quantity}</td>
              <td style={styles.td}>{t.previous_stock}</td>
              <td style={styles.td}>{t.new_stock}</td>
              <td style={styles.td}>{t.user_name || 'System'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

const ReportsTab = ({
  reportType, setReportType, todaySales, weekSales, monthSales, productsCount,
  sales, products, profitDateFrom, setProfitDateFrom, profitDateTo, setProfitDateTo,
  profitData, onGenerateProfit, onExportCSV, onPrintReport, formatKES, loading
}) => (
  <div>
    <h1>📊 Reports Dashboard</h1>
    <div style={styles.grid4}>
      <StatCard title="Today's Sales" value={formatKES(todaySales)} color="#10b981" />
      <StatCard title="This Week" value={formatKES(weekSales)} color="#3b82f6" />
      <StatCard title="This Month" value={formatKES(monthSales)} color="#8b5cf6" />
      <StatCard title="Total Products" value={productsCount} color="#f59e0b" />
    </div>

    <div style={{ marginBottom: '20px', marginTop: '30px' }}>
      <Button onClick={() => setReportType('sales')} variant={reportType === 'sales' ? 'primary' : 'secondary'}>Sales Report</Button>
      <Button onClick={() => setReportType('inventory')} variant={reportType === 'inventory' ? 'primary' : 'secondary'}>Inventory Report</Button>
      <Button onClick={() => setReportType('tax')} variant={reportType === 'tax' ? 'primary' : 'secondary'}>Tax Report</Button>
      <Button onClick={() => setReportType('profit')} variant={reportType === 'profit' ? 'primary' : 'secondary'}>Profit & Loss</Button>
    </div>

    <div style={styles.card}>
      {reportType === 'sales' && (
        <>
          <h3>Sales Report</h3>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Date</th><th style={styles.th}>Receipt</th><th style={styles.th}>Customer</th><th style={styles.th}>Items</th><th style={styles.th}>Total</th><th style={styles.th}>Payment</th></tr></thead>
            <tbody>
              {sales.slice(0, 10).map(sale => (
                <tr key={sale.id}>
                  <td style={styles.td}>{new Date(sale.created_at).toLocaleDateString()}</td>
                  <td style={styles.td}>{sale.receipt_number}</td>
                  <td style={styles.td}>{sale.customer_name || 'Walk-in'}</td>
                  <td style={styles.td}>{sale.item_count || 0}</td>
                  <td style={styles.td}>{formatKES(sale.total)}</td>
                  <td style={styles.td}>{sale.payment_method}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {reportType === 'inventory' && (
        <>
          <h3>Inventory Report</h3>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Product</th><th style={styles.th}>SKU</th><th style={styles.th}>Category</th><th style={styles.th}>Stock</th><th style={styles.th}>Value</th><th style={styles.th}>Status</th></tr></thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id}>
                  <td style={styles.td}>{p.name}</td>
                  <td style={styles.td}>{p.sku || '-'}</td>
                  <td style={styles.td}>{p.category}</td>
                  <td style={styles.td}>{p.stock_quantity} {p.unit}</td>
                  <td style={styles.td}>{formatKES(p.stock_quantity * p.price)}</td>
                  <td style={styles.td}>
                    <Badge type={p.stock_quantity <= p.low_stock_threshold ? 'warning' : 'success'}>
                      {p.stock_quantity <= p.low_stock_threshold ? 'Low Stock' : 'In Stock'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {reportType === 'tax' && (
        <>
          <h3>Tax Report</h3>
          <p>Total Tax Collected: {formatKES(sales.reduce((sum, s) => sum + (parseFloat(s.tax_total) || 0), 0))}</p>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Receipt</th><th style={styles.th}>Date</th><th style={styles.th}>Subtotal</th><th style={styles.th}>Tax</th><th style={styles.th}>Total</th></tr></thead>
            <tbody>
              {sales.filter(s => s.tax_total > 0).map(sale => (
                <tr key={sale.id}>
                  <td style={styles.td}>{sale.receipt_number}</td>
                  <td style={styles.td}>{new Date(sale.created_at).toLocaleDateString()}</td>
                  <td style={styles.td}>{formatKES(sale.subtotal)}</td>
                  <td style={styles.td}>{formatKES(sale.tax_total)}</td>
                  <td style={styles.td}>{formatKES(sale.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {reportType === 'profit' && (
        <>
          <h3>Profit & Loss Report</h3>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div><label>From:</label><input type="date" value={profitDateFrom} onChange={(e) => setProfitDateFrom(e.target.value)} style={styles.input} /></div>
            <div><label>To:</label><input type="date" value={profitDateTo} onChange={(e) => setProfitDateTo(e.target.value)} style={styles.input} /></div>
            <Button onClick={onGenerateProfit} disabled={loading}>{loading ? 'Loading...' : 'Generate Report'}</Button>
          </div>

          <div style={styles.grid4}>
            <StatCard title="Total Revenue" value={formatKES(profitData.totalRevenue)} bgColor="#dbeafe" />
            <StatCard title="Total Cost" value={formatKES(profitData.totalCost)} bgColor="#fee2e2" />
            <StatCard title="Gross Profit" value={formatKES(profitData.grossProfit)} bgColor="#dcfce7" />
            <StatCard title="Margin" value={`${profitData.profitMargin}%`} bgColor="#fef9c3" />
          </div>

          <div style={{ ...styles.card, marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', padding: '20px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: `conic-gradient(#10b981 0deg ${profitData.profitPercentage * 3.6}deg, #ef4444 ${profitData.profitPercentage * 3.6}deg 360deg)`, margin: '0 auto 10px' }}></div>
                <p><span style={{ color: '#10b981' }}>●</span> Profit ({profitData.profitPercentage}%)</p>
                <p><span style={{ color: '#ef4444' }}>●</span> Cost ({100 - profitData.profitPercentage}%)</p>
              </div>
              <div style={{ textAlign: 'left' }}>
                <p><strong>Total Sales:</strong> {profitData.totalTransactions} transactions</p>
                <p><strong>Items Sold:</strong> {profitData.totalItems} items</p>
                <p><strong>Average Order Value:</strong> {formatKES(profitData.averageOrder)}</p>
                <p><strong>Profit per Item:</strong> {formatKES(profitData.profitPerItem)}</p>
              </div>
            </div>
          </div>

          <div style={styles.card}>
            <h4>Profit Breakdown by Product</h4>
            <table style={styles.table}>
              <thead><tr><th style={styles.th}>Product</th><th style={styles.th}>Qty Sold</th><th style={styles.th}>Revenue</th><th style={styles.th}>Cost</th><th style={styles.th}>Profit</th><th style={styles.th}>Margin</th></tr></thead>
              <tbody>
                {profitData.productBreakdown.map((item, idx) => (
                  <tr key={idx}>
                    <td style={styles.td}>{item.name}</td>
                    <td style={styles.td}>{item.quantity}</td>
                    <td style={styles.td}>{formatKES(item.revenue)}</td>
                    <td style={styles.td}>{formatKES(item.cost)}</td>
                    <td style={{ ...styles.td, fontWeight: 'bold', color: item.profit >= 0 ? '#10b981' : '#ef4444' }}>{formatKES(item.profit)}</td>
                    <td style={styles.td}><Badge type={item.margin >= 30 ? 'success' : item.margin >= 10 ? 'info' : 'warning'}>{item.margin}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="success" onClick={onExportCSV}>📥 Export CSV</Button>
            <Button onClick={onPrintReport}>🖨️ Print Report</Button>
          </div>
        </>
      )}
    </div>
  </div>
);

const ProductModal = ({ product, setProduct, onSubmit, onClose, isEdit }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ marginTop: 0 }}>{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
      <form onSubmit={onSubmit}>
        <div><label>Product Name *</label><input type="text" value={product.name} onChange={(e) => setProduct({...product, name: e.target.value})} style={styles.input} required /></div>
        <div style={styles.grid2}>
          <div><label>SKU</label><input type="text" value={product.sku} onChange={(e) => setProduct({...product, sku: e.target.value})} style={styles.input} /></div>
          <div><label>Barcode</label><input type="text" value={product.barcode} onChange={(e) => setProduct({...product, barcode: e.target.value})} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Category</label>
            <select value={product.category} onChange={(e) => setProduct({...product, category: e.target.value})} style={styles.select}>
              <option value="general">General</option><option value="consumables">Consumables</option><option value="equipment">Equipment</option><option value="pharmacy">Pharmacy</option>
            </select>
          </div>
          <div><label>Unit</label>
            <select value={product.unit} onChange={(e) => setProduct({...product, unit: e.target.value})} style={styles.select}>
              <option value="piece">Piece</option><option value="box">Box</option><option value="pack">Pack</option><option value="liter">Liter</option><option value="kg">Kilogram</option>
            </select>
          </div>
        </div>
        <div style={styles.grid2}>
          <div><label>Selling Price (KES) *</label><input type="number" step="100" value={product.price} onChange={(e) => setProduct({...product, price: e.target.value})} style={styles.input} required /></div>
          <div><label>Cost Price (KES)</label><input type="number" step="100" value={product.cost_price} onChange={(e) => setProduct({...product, cost_price: e.target.value})} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Tax Rate (%)</label><input type="number" step="0.1" value={product.tax_rate} onChange={(e) => setProduct({...product, tax_rate: e.target.value})} style={styles.input} /></div>
          <div><label>Initial Stock</label><input type="number" value={product.stock_quantity} onChange={(e) => setProduct({...product, stock_quantity: e.target.value})} style={styles.input} /></div>
        </div>
        <div><label>Low Stock Alert Threshold</label><input type="number" value={product.low_stock_threshold} onChange={(e) => setProduct({...product, low_stock_threshold: e.target.value})} style={styles.input} /></div>
        <div><label>Description</label><textarea value={product.description} onChange={(e) => setProduct({...product, description: e.target.value})} style={{...styles.input, minHeight: '80px'}} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" type="submit">{isEdit ? 'Update Product' : 'Add Product'}</Button>
        </div>
      </form>
    </div>
  </div>
);

const CheckoutModal = ({ checkoutData, setCheckoutData, onSubmit, onClose, cartTotal, cartTax, formatKES }) => (
  <div style={styles.modal}>
    <div style={styles.modalContent}>
      <h2 style={{ marginTop: 0 }}>Checkout</h2>
      <form onSubmit={onSubmit}>
        <div><label>Customer Name</label><input type="text" value={checkoutData.customer_name} onChange={(e) => setCheckoutData({...checkoutData, customer_name: e.target.value})} style={styles.input} /></div>
        <div style={styles.grid2}>
          <div><label>Phone</label><input type="tel" value={checkoutData.customer_phone} onChange={(e) => setCheckoutData({...checkoutData, customer_phone: e.target.value})} style={styles.input} /></div>
          <div><label>Email</label><input type="email" value={checkoutData.customer_email} onChange={(e) => setCheckoutData({...checkoutData, customer_email: e.target.value})} style={styles.input} /></div>
        </div>
        <div style={styles.grid2}>
          <div><label>Payment Method</label>
            <select value={checkoutData.payment_method} onChange={(e) => setCheckoutData({...checkoutData, payment_method: e.target.value})} style={styles.select}>
              <option value="cash">Cash</option><option value="mpesa">M-PESA</option><option value="card">Card</option><option value="bank">Bank Transfer</option>
            </select>
          </div>
          <div><label>Discount (KES)</label><input type="number" value={checkoutData.discount} onChange={(e) => setCheckoutData({...checkoutData, discount: parseInt(e.target.value) || 0})} style={styles.input} /></div>
        </div>
        {checkoutData.payment_method === 'mpesa' && (
          <div><label>M-PESA Transaction Code *</label><input type="text" placeholder="e.g., OKJ4R7T8P9" value={checkoutData.mpesa_code} onChange={(e) => setCheckoutData({...checkoutData, mpesa_code: e.target.value})} style={styles.input} required /></div>
        )}
        <div><label>Notes</label><textarea value={checkoutData.notes} onChange={(e) => setCheckoutData({...checkoutData, notes: e.target.value})} style={{...styles.input, minHeight: '60px'}} /></div>
        <div style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
          <h3>Order Summary</h3>
          <p>Subtotal: {formatKES(cartTotal)}</p>
          <p>Tax: {formatKES(cartTax)}</p>
          <p>Discount: -{formatKES(checkoutData.discount)}</p>
          <p style={{ fontSize: '18px', fontWeight: 'bold' }}>Total: {formatKES(cartTotal + cartTax - checkoutData.discount)}</p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="success" type="submit">Complete Sale</Button>
        </div>
      </form>
    </div>
  </div>
);

// ------------------ Styles ------------------
const styles = {
  container: { padding: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' },
  posGrid: { display: 'grid', gridTemplateColumns: '1fr 400px', gap: '20px' },
  productsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' },
  productCard: { background: 'white', padding: '15px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer', transition: 'transform 0.2s' },
  cartCard: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', position: 'sticky', top: '20px' },
  cartItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #e2e8f0' },
  button: { padding: '10px 20px', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', margin: '5px' },
  input: { width: '100%', padding: '10px', margin: '8px 0', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' },
  select: { width: '100%', padding: '10px', margin: '8px 0', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white' },
  modal: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalContent: { background: 'white', padding: '30px', borderRadius: '12px', width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  grid4: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' },
  badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500' },
  statCard: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  card: { background: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', marginBottom: '20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '12px', textAlign: 'left', background: '#f8fafc', borderBottom: '2px solid #e2e8f0' },
  td: { padding: '12px', borderBottom: '1px solid #e2e8f0' },
  qtyBtn: { width: '30px', height: '30px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer' },
  removeBtn: { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '18px' },
  summaryRow: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }
};

export default POSDashboard;