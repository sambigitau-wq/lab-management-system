import React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  return (
    <div>
      {!token ? <Login setToken={setToken} /> : <Dashboard token={token} />}
    </div>
  );
}

export default App;