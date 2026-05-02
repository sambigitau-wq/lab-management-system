CREATE TABLE labs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tests (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  patient_id INTEGER REFERENCES patients(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending', -- pending, completed, referred
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_tests (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
  result TEXT,
  is_referred BOOLEAN DEFAULT false,
  referred_to_lab_id INTEGER, -- external lab id (could be another lab in system)
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE receipts (
  id SERIAL PRIMARY KEY,
  payment_id INTEGER REFERENCES payments(id) ON DELETE CASCADE,
  lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  receipt_number TEXT UNIQUE NOT NULL,
  pdf_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE referrals (
  id SERIAL PRIMARY KEY,
  order_test_id INTEGER REFERENCES order_tests(id) ON DELETE CASCADE,
  from_lab_id INTEGER REFERENCES labs(id) ON DELETE CASCADE,
  to_lab_id INTEGER, -- external lab identifier (could be another lab in system)
  status TEXT DEFAULT 'sent',
  result TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);