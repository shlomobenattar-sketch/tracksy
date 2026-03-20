const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

app.post('/detect', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.json({ error: 'Missing url' });

  const fullUrl = url.startsWith('http') ? url : 'https://' + url;

  try {
    const fetch = (await import('node-fetch')).default;

    const response = await fetch(fullUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) throw new Error('Fetch failed: ' + response.status);
    const html = await response.text();

    // Extract NAME
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
      .replace(/\s*[\|–\-]\s*(amazon|uniqlo|ksp|zap|bug|ivory|aliexpress|walmart|bestbuy|ebay|adidas|nike|shein|asos|zara|terminalx|mango|h&m)[^]*/gi, '')
      .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();

    // Extract PRICE
    let priceNum = null;
    let currency = 'ILS';

    const jld = [...html.matchAll(/"price"\s*:\s*["']?([\d.]+)["']?/gi)]
      .map(m => parseFloat(m[1])).filter(p => p > 0.5 && p < 100000);
    if (jld.length) priceNum = Math.min(...jld);

    if (!priceNum) {
      const ogp = html.match(/property=["']product:price:amount["'][^>]+content=["']([\d.,]+)["']/i)
               || html.match(/content=["']([\d.,]+)["'][^>]+property=["']product:price:amount["']/i);
      if (ogp) priceNum = parseFloat(ogp[1].replace(/,/g,''));
    }

    if (!priceNum) {
      const ip = html.match(/itemprop=["']price["'][^>]*content=["']([\d.,]+)["']/i);
      if (ip) priceNum = parseFloat(ip[1].replace(/,/g,''));
    }

    if (!priceNum) {
      const dp = html.match(/data-price=["']([\d.,]+)["']/i);
      if (dp) priceNum = parseFloat(dp[1].replace(/,/g,''));
    }

    if (!priceNum) {
      const cs = html.match(/[\$₪€£]\s*(\d{1,5}[.,]\d{2})/);
      if (cs) priceNum = parseFloat(cs[1].replace(/,/g,''));
    }

    const ogCur = html.match(/"priceCurrency"\s*:\s*["']([A-Z]{3})["']/i)
               || html.match(/property=["']product:price:currency["'][^>]+content=["']([A-Z]{3})["']/i)
               || html.match(/content=["']([A-Z]{3})["'][^>]+property=["']product:price:currency["']/i);
    if (ogCur) currency = ogCur[1];
    else if (html.match(/\$\s*\d|"USD"/)) currency = 'USD';
    else if (html.match(/€\s*\d|"EUR"/)) currency = 'EUR';
    else if (html.match(/£\s*\d|"GBP"/)) currency = 'GBP';
    else if (html.match(/₪|"ILS"|שקל/)) currency = 'ILS';

    const sym = { USD:'$', EUR:'€', GBP:'£', ILS:'₪' }[currency] || '₪';

    res.json({
      name: name || null,
      price: priceNum ? sym + priceNum.toFixed(2) : null,
      priceNum: priceNum || null,
      currency,
    });

  } catch(e) {
    res.json({ error: e.message, name: null, price: null });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port', PORT));
