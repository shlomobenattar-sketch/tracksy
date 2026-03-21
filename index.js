const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

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
   MAIN DETECT ROUTE
======================== */

app.post('/detect', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.json({ error: 'Missing url' });
  }

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;
  const store = detectStore(fullUrl);

  console.log('Checking URL:', fullUrl);
  console.log('Detected store:', store);

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    console.log('Status:', response.status);

    if (!response.ok) {
      throw new Error('Fetch failed: ' + response.status);
    }

    const html = await response.text();

    /* ========================
       EXTRACT NAME
    ======================== */

    let name = '';

    const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{2,}?)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']{2,}?)["'][^>]+property=["']og:title["']/i);

    if (og) name = og[1];

    if (!name) {
      const tw = html.match(/<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']{2,}?)["']/i)
              || html.match(/<meta[^>]+content=["']([^"']{2,}?)["'][^>]+name=["']twitter:title["']/i);
      if (tw) name = tw[1];
    }

    if (!name) {
      const t = html.match(/<title[^>]*>([^<]{2,120}?)<\/title>/i);
      if (t) name = t[1];
    }

    name = name
      .replace(/\s*[\|–\-].*$/i, '')
      .replace(/&amp;/g,'&')
      .replace(/&quot;/g,'"')
      .replace(/&#39;/g,"'")
      .trim();

    /* ========================
       EXTRACT PRICE
    ======================== */

    let priceNum = null;
    let currency = 'ILS';

    const jld = [...html.matchAll(/"price"\s*:\s*["']?([\d.]+)["']?/gi)]
      .map(m => parseFloat(m[1]))
      .filter(p => p > 0.5 && p < 100000);

    if (jld.length) priceNum = Math.min(...jld);

    if (!priceNum) {
      const ogp = html.match(/product:price:amount[^>]+content=["']([\d.,]+)["']/i);
      if (ogp) priceNum = parseFloat(ogp[1].replace(/,/g,''));
    }

    if (!priceNum) {
      const cs = html.match(/[\$₪€£]\s*(\d{1,5}[.,]\d{2})/);
      if (cs) priceNum = parseFloat(cs[1].replace(/,/g,''));
    }

    /* ========================
       DETECT CURRENCY
    ======================== */

    if (html.match(/\$\s*\d|"USD"/)) currency = 'USD';
    else if (html.match(/€\s*\d|"EUR"/)) currency = 'EUR';
    else if (html.match(/£\s*\d|"GBP"/)) currency = 'GBP';
    else if (html.match(/₪|"ILS"|שקל/)) currency = 'ILS';

    const sym = { USD:'$', EUR:'€', GBP:'£', ILS:'₪' }[currency] || '₪';

    /* ========================
       RESPONSE
    ======================== */

    res.json({
      name: name || null,
      price: priceNum || null,
      currency,
      displayPrice: priceNum ? sym + priceNum.toFixed(2) : null,
      store
    });

  } catch (e) {
    console.log('ERROR:', e.message);

    res.json({
      error: e.message,
      name: null,
      price: null,
      store
    });
  }
});

/* ========================
   START SERVER
======================== */

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
