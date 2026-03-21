const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

let products = [];

/* =========================
   BASIC ROUTES
========================= */

app.get('/', (req, res) => {
  res.send('Tracksy API is running 🚀');
});

app.get('/products', (req, res) => {
  res.json(products);
});

/* =========================
   DETECT STORE
========================= */

function detectStore(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.includes('zara')) return 'zara';
    if (host.includes('ksp')) return 'ksp';
    if (host.includes('iherb')) return 'iherb';
    if (host.includes('amazon')) return 'amazon';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/* =========================
   FETCH HTML (NO BLOCK)
========================= */

async function fetchHTML(url) {
  const fetch = (await import('node-fetch')).default;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
    }
  });

  if (!response.ok) {
    throw new Error('Fetch failed: ' + response.status);
  }

  return await response.text();
}

/* =========================
   EXTRACT PRICE
========================= */

function extractPrice(html) {
  // JSON-LD price
  const jsonPrice = html.match(/"price"\s*:\s*"?([\d.]+)"?/i);
  if (jsonPrice) return parseFloat(jsonPrice[1]);

  // meta price
  const metaPrice = html.match(/product:price:amount.*?content="([\d.,]+)"/i);
  if (metaPrice) return parseFloat(metaPrice[1].replace(',', ''));

  // ₪ price
  const ils = html.match(/₪\s?([\d,]+(\.\d{1,2})?)/);
  if (ils) return parseFloat(ils[1].replace(',', ''));

  return null;
}

/* =========================
   EXTRACT NAME
========================= */

function extractName(html) {
  const og = html.match(/<meta property="og:title" content="([^"]+)"/i);
  if (og) return og[1];

  const title = html.match(/<title>([^<]+)<\/title>/i);
  if (title) return title[1];

  return null;
}

/* =========================
   DETECT ENDPOINT
========================= */

app.post('/detect', async (req, res) => {
  try {
    let { url } = req.body;

    if (!url) {
      return res.json({ error: 'Missing url' });
    }

    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }

    const store = detectStore(url);

    const html = await fetchHTML(url);

    const price = extractPrice(html);
    const name = extractName(html);

    res.json({
      name,
      price,
      store
    });

  } catch (err) {
    res.json({
      error: err.message
    });
  }
});

/* =========================
   ADD PRODUCT
========================= */

app.post('/products', async (req, res) => {
  const { url, name, price } = req.body;

  const product = {
    id: Date.now(),
    url,
    name,
    price,
    store: detectStore(url),
    createdAt: new Date()
  };

  products.push(product);

  res.json({
    message: 'Product added',
    product
  });
});

/* =========================
   SERVER
========================= */

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
