const puppeteer = require("puppeteer");
const fs = require("fs");

async function info(url) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set user agent
  await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  // Set extra headers to look more like a real browser
  await page.setExtraHTTPHeaders({
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Upgrade-Insecure-Requests': '1'
  });

  // Increase timeout and wait for page to load
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  let infos = await page.evaluate(() => {
    let name = document.querySelector("span#titleName")?.innerText || "";
    let subTitle = document.querySelector("div.subTitle")?.innerText || "";
    let imageLink =
      document.querySelector("meta[property='og:image']")?.content || "";
    let categories = imageLink ? imageLink.split("/")[4] || "" : "";
    let demo = `https://mynoise.world/Data/${categories}/demo.ogg`;

    // Find actual sound files used in the page source
    let sounds = [];

    // Look for sound file URLs in the page source
    const pageSource = document.documentElement.outerHTML;

    // Find all URLs that match the pattern: https://mynoise.world/Data/CATEGORY/NUMBERa.ogg or NUMBERb.ogg
    const soundUrlPatternOgg =
      /https:\/\/mynoise\.world\/Data\/([^\/]+)\/(\d+[ab])\.ogg/g;
    let match;

    while ((match = soundUrlPatternOgg.exec(pageSource)) !== null) {
      const fullUrl = match[0];
      sounds.push(fullUrl);
    }

    // Also find .mp3 files
    const soundUrlPatternMp3 =
      /https:\/\/mynoise\.world\/Data\/([^\/]+)\/(\d+[ab])\.mp3/g;
    while ((match = soundUrlPatternMp3.exec(pageSource)) !== null) {
      const fullUrl = match[0];
      sounds.push(fullUrl);
    }

    // Also try to find any .ogg files that might be referenced
    const anyOggPattern =
      /https:\/\/mynoise\.world\/Data\/([^\/]+)\/([^"'\s]+)\.ogg/g;
    while ((match = anyOggPattern.exec(pageSource)) !== null) {
      const fullUrl = match[0];
      if (!sounds.includes(fullUrl)) {
        sounds.push(fullUrl);
      }
    }

    // Remove duplicates
    sounds = [...new Set(sounds)];

    // If no sounds found in page source, try to find in JavaScript code
    if (sounds.length === 0) {
      // Look for JavaScript code that defines sound files
      const scriptPattern = /sourceFileA\[(\d+)\]\s*=\s*['"]([^'"]+)['"]/g;
      let scriptMatch;

      while ((scriptMatch = scriptPattern.exec(pageSource)) !== null) {
        const index = scriptMatch[1];
        let url = scriptMatch[2];
        if (url.includes("mynoise.world/Data/")) {
          // Ensure URL has .ogg extension
          if (!url.endsWith(".ogg") && !url.endsWith(".mp3")) {
            url = url + ".ogg";
          }
          sounds.push(url);
        }
      }

      // Also look for sourceFileB
      const scriptPatternB = /sourceFileB\[(\d+)\]\s*=\s*['"]([^'"]+)['"]/g;
      while ((scriptMatch = scriptPatternB.exec(pageSource)) !== null) {
        const index = scriptMatch[1];
        let url = scriptMatch[2];
        if (url.includes("mynoise.world/Data/")) {
          // Ensure URL has .ogg extension
          if (!url.endsWith(".ogg") && !url.endsWith(".mp3")) {
            url = url + ".ogg";
          }
          sounds.push(url);
        }
      }
    }

    // Ensure all URLs have proper extensions
    sounds = sounds.map((url) => {
      if (!url.endsWith(".ogg") && !url.endsWith(".mp3")) {
        return url + ".ogg";
      }
      return url;
    });

    // Extract preset information from actionlink elements
    let presets = [];
    const actionLinks = document.querySelectorAll("span.actionlink");
    actionLinks.forEach((link) => {
      const onclick = link.getAttribute("onclick");
      if (onclick && onclick.includes("setPreset(")) {
        // Extract preset numbers from setPreset function
        const presetMatch = onclick.match(/setPreset\(([^)]+)\)/);
        if (presetMatch) {
          const presetNumbers = presetMatch[1]
            .split(",")
            .map((num) => parseFloat(num.trim()));
          const title = link.textContent.trim();

          // Skip presets with title "●"
          if (title !== "●") {
            presets.push({
              numbers: presetNumbers,
              title: title,
            });
          }
        }
      }
    });

    return { name, subTitle, imageLink, categories, sounds, demo, presets };
  });

  console.log(infos);
  await browser.close();

  return infos;
}

async function infos() {
  let links = JSON.parse(fs.readFileSync("data/link.json", "utf8"));
  let infos = [];

  // Load existing infos if file exists
  try {
    if (fs.existsSync("data/infos.json")) {
      infos = JSON.parse(fs.readFileSync("data/infos.json", "utf8"));
      console.log(`Loaded ${infos.length} existing items from data/infos.json`);
    }
  } catch (error) {
    console.log("No existing infos.json found, starting fresh");
  }

  // Process all items
  console.log(`Processing ${links.length} total links`);

  for (let i = 40; i < links.length; i++) {
    const link = links[i];
    console.log(`Processing item ${i + 1}/${links.length}: ${link}`);

    let infoData = await info(link);

    // Check if name is empty, if so break and save current data
    if (!infoData.name || infoData.name.trim() === "") {
      console.log(
        `Empty name found at item ${
          i + 1
        }, stopping crawl and saving current data...`
      );
      break;
    }

    infos.push(infoData);

    // Add random delay between requests to avoid detection (30-60 seconds)
    if (i < 39) { // Since we're limiting to 40 items
      const minDelay = 30000; // 30 seconds minimum
      const maxDelay = 60000; // 60 seconds maximum
      const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
      console.log(`Waiting ${delay / 1000}s before next request...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Write the collected infos to data/infos.json (append mode)
  fs.writeFileSync("data/infos.json", JSON.stringify(infos, null, 2));
  console.log(`Total ${infos.length} items saved to data/infos.json`);

  return infos;
}

module.exports = infos;
