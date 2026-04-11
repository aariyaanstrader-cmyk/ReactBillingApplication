require('dotenv').config({ path: process.env.HOME + '/billing-app/backend/.env' });
const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// SSL certificate
const sslOptions = {
  key: fs.readFileSync(process.env.HOME + '/billing-app/backend/ssl/server.key'),
  cert: fs.readFileSync(process.env.HOME + '/billing-app/backend/ssl/server.cert')
};

const authRoutes      = require('./routes/auth');
const ratesRoutes     = require('./routes/rates');
const customersRoutes = require('./routes/customers');
const itemsRoutes     = require('./routes/items');
const taxesRoutes     = require('./routes/taxes');
const ordersRoutes    = require('./routes/orders');
const dataLoadRoutes  = require('./routes/dataLoad');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected OK');
    ratesRoutes.startMarketPolling();
  })
  .catch(err => console.error('MongoDB error:', err.message));

app.use('/api/auth',      authRoutes);
app.use('/api/rates',     ratesRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/items',     itemsRoutes);
app.use('/api/taxes',     taxesRoutes);
app.use('/api/orders',    ordersRoutes);
app.use('/api/data-load', dataLoadRoutes);

app.get('/api/health', (req, res) => res.json({
  status: 'OK',
  mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  node: process.version,
  time: new Date()
}));


const path = require("path");
const distPath = path.join(process.env.HOME, "billing-frontend/dist");

// Hashed assets (js/css/images) — cache forever (filename changes on each build)
app.use("/assets", express.static(path.join(distPath, "assets"), {
  maxAge: "1y",
  immutable: true
}));

// Static files except index.html
app.use(express.static(distPath, {
  maxAge: "1h",
  index: false  // don't serve index.html from static — we handle it below with no-cache
}));

// SPA fallback — index.html must NEVER be cached so browser always gets latest asset references
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  res.sendFile(path.join(distPath, "index.html"));
});
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

// HTTPS server on port 443 (or configured port)
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
https.createServer(sslOptions, app).listen(HTTPS_PORT, () => {
  console.log('HTTPS server running on port ' + HTTPS_PORT);
});

// HTTP redirect server — redirects all HTTP to HTTPS
const HTTP_PORT = process.env.PORT || 3001;
const httpApp = express();
httpApp.all('*', (req, res) => {
  res.redirect(301, 'https://' + req.headers.host.replace(/:\d+$/, '') + (HTTPS_PORT != 443 ? ':' + HTTPS_PORT : '') + req.url);
});
http.createServer(httpApp).listen(HTTP_PORT, () => {
  console.log('HTTP redirect server running on port ' + HTTP_PORT + ' -> HTTPS');
});
