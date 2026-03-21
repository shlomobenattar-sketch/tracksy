const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ========================
   STORAGE (temporary)
======================== */

let products = [];

/* ========================
   BASIC ROUTES
======================== */

app.get('/', (req, res) => {
  res.send('Tracksy API is running 🚀');
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

/* ========================
   DETECT STORE
======================== */

function detectStore(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();

    if (hostname.includes('amazon.')) return 'amazon';
    if (hostname.includes('zara.com')) return 'zara';
    if (hostname.includes('ksp.co.il')) return 'ksp';
    if (hostname.includes('terminalx.com')) return 'terminalx';
    if (hostname.includes('iherb.com')) return 'iherb';

    return 'unknown';
  } catch {
    return 'invalid';
  }
}

/* ========================
   DETECT (existing)
======================== */

app.post('/detect', async (req, res) => {
  const { url } = req.body;

  if (!url) return res.json({ error: 'Missing url' });

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  const store = detectStore(fullUrl);

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html',
      }
    });

    if (!response.ok) throw new Error('Fetch failed: ' + response.status);

    const html = await response.text();

    let name = '';
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) name = titleMatch[1];

    res.json({
      name,
      price: null,
      currency: null,
      displayPrice: null,
      store
    });

  } catch (e) {
    res.json({
      error: e.message,
      store
    });
  }
});

/* ========================
   ADD PRODUCT
======================== */

app.post('/products', (req, res) => {
  const { url, name, price } = req.body;

  if (!url) {
    return res.json({ error: 'Missing url' });
  }

  const store = detectStore(url);

  const newProduct = {
    id: Date.now(),
    url,
    name: name || 'Unknown product',
    price: price || null,
    store,
    createdAt: new Date()
  };

  products.push(newProduct);

  res.json({
    message: 'Product added',
    product: newProduct
  });
});

/* ========================
   GET PRODUCTS
======================== */

app.get('/products', (req, res) => {
  res.json(products);
});

/* ========================
   START SERVER
======================== */

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
