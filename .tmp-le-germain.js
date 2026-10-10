import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto('https://www.germainhotels.com/en/le-germain-hotel/ottawa', {
  waitUntil: 'networkidle2',
  timeout: 60000,
});

// Get the href of the Check availability link
const href = await page.evaluate(() => {
  const els = [...document.querySelectorAll('a')];
  const check = els.find(e => e.textContent.trim().toLowerCase() === 'check availability');
  return check ? check.getAttribute('href') : null;
});
console.log('Check availability href:', href);

await browser.close();
