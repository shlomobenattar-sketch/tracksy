const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

/* =========================
   TEMP STORAGE (MVP)
========================= */
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

app.post('/products', (req, res) => {
  const { url, name, price } = req.body;

  const product = {
    id: Date.now(),
    url,
    name: name || 'Unknown product',
    price: price || null,
    createdAt: new Date()
  };

  products.push(product);

  res.json({
    message: 'Product added',
    product
  });
});

/* =========================
   PLAYWRIGHT DETECT
========================= */

app.post('/detect', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.json({ error: 'Missing url' });
  }

  let browser;

  try {
    browser = await chromium.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    });

    const page = await browser.newPage();

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 25000
    });

    // ===== NAME =====
    let name = null;

    try {
      name = await page.locator('h1').first().textContent();
    } catch {}

    if (!name) {
      try {
        name = await page.title();
      } catch {}
    }

    if (name) {
      name = name.trim();
    }

    // ===== PRICE =====
    let price = null;

    const selectors = [
      '[class*="price"]',
      '[data-testid*="price"]',
      '[class*="Price"]',
      'span'
    ];

    for (const sel of selectors) {
      try {
        const text = await page.locator(sel).first().textContent();

        if (text && text.match(/[0-9]/)) {
          const clean = text.replace(/[^\d.]/g, '');
          if (clean) {
            price = Number(clean);
            break;
          }
        }
      } catch {}
    }

    await browser.close();

    res.json({
      name: name || null,
      price: price || null
    });

  } catch (err) {
    console.error(err);

    if (browser) await browser.close();

    res.json({
      error: 'Playwright failed',
      name: null,
      price: null
    });
  }
});

/* =========================
   START SERVER
========================= */

app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
