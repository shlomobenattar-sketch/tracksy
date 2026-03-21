const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* ========================
   TEMP STORAGE (MVP)
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
   DETECT ROUTE
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error('Fetch failed: ' + response.status);
    }

    const html = await response.text();

    let name = '';
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) name = titleMatch[1].trim();

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
   ADD PRODUCT (AUTO)
======================== */

app.post('/products', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.json({ error: 'Missing url' });
  }

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  const store = detectStore(fullUrl);

  let name = 'Unknown product';
  let price = null;

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html'
      }
    });

    if (response.ok) {
      const html = await response.text();

      // extract name
      const titleMatch = html.match(/<title>(.*?)<\/title>/i);
      if (titleMatch) {
        name = titleMatch[1].trim();
      }

      // basic price detection
      const priceMatch = html.match(/[\$₪€£]\s*(\d+[.,]?\d*)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(',', '.'));
      }
    }

  } catch (e) {
    console.log('Auto fetch failed:', e.message);
  }

  const newProduct = {
    id: Date.now(),
    url: fullUrl,
    name,
    price,
    store,
    createdAt: new Date()
  };

  products.push(newProduct);

  res.json({
    message: 'Product added automatically',
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
