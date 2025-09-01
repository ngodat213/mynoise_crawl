const puppeteer = require("puppeteer");
const fs = require("fs");

async function scrapeLinks(url) {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto(url);
  // select the <a> tag that has the 'ele' class
  const eleLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a.hint"));
    return links.map((link) => link.href);
  });
  console.log(eleLinks);
  
  // Create data folder if it doesn't exist
  if (!fs.existsSync('./data')) {
    fs.mkdirSync('./data', { recursive: true });
  }
  
  // Write links to data/link.json
  fs.writeFileSync('./data/link.json', JSON.stringify(eleLinks, null, 2));
  console.log('Links saved to data/link.json');
  
  await browser.close();
}

module.exports = scrapeLinks;
