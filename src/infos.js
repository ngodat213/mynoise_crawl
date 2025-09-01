const puppeteer = require("puppeteer");
const fs = require("fs");

async function info(url) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Increase timeout and wait for page to load
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  let infos = await page.evaluate(() => {
    let name = document.querySelector("span#titleName")?.innerText || "";
    let subTitle = document.querySelector("div.subTitle")?.innerText || "";
    let imageLink =
      document.querySelector("meta[property='og:image']")?.content || "";
    let categories = imageLink ? imageLink.split("/")[4] || "" : "";
    let demo = `https://mynoise.world/Data/${categories}/demo.ogg`

    // Find actual sound files used in the page source
    let sounds = [];
    
    // Look for sound file URLs in the page source
    const pageSource = document.documentElement.outerHTML;
    
    // Find all URLs that match the pattern: https://mynoise.world/Data/CATEGORY/NUMBERa.ogg or NUMBERb.ogg
    const soundUrlPatternOgg = /https:\/\/mynoise\.world\/Data\/([^\/]+)\/(\d+[ab])\.ogg/g;
    let match;
    
    while ((match = soundUrlPatternOgg.exec(pageSource)) !== null) {
      const fullUrl = match[0];
      sounds.push(fullUrl);
    }
    
    // Also find .mp3 files
    const soundUrlPatternMp3 = /https:\/\/mynoise\.world\/Data\/([^\/]+)\/(\d+[ab])\.mp3/g;
    while ((match = soundUrlPatternMp3.exec(pageSource)) !== null) {
      const fullUrl = match[0];
      sounds.push(fullUrl);
    }
    
    // Also try to find any .ogg files that might be referenced
    const anyOggPattern = /https:\/\/mynoise\.world\/Data\/([^\/]+)\/([^"'\s]+)\.ogg/g;
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
        if (url.includes('mynoise.world/Data/')) {
          // Ensure URL has .ogg extension
          if (!url.endsWith('.ogg') && !url.endsWith('.mp3')) {
            url = url + '.ogg';
          }
          sounds.push(url);
        }
      }
      
      // Also look for sourceFileB
      const scriptPatternB = /sourceFileB\[(\d+)\]\s*=\s*['"]([^'"]+)['"]/g;
      while ((scriptMatch = scriptPatternB.exec(pageSource)) !== null) {
        const index = scriptMatch[1];
        let url = scriptMatch[2];
        if (url.includes('mynoise.world/Data/')) {
          // Ensure URL has .ogg extension
          if (!url.endsWith('.ogg') && !url.endsWith('.mp3')) {
            url = url + '.ogg';
          }
          sounds.push(url);
        }
      }
    }
    
    // Ensure all URLs have proper extensions
    sounds = sounds.map(url => {
      if (!url.endsWith('.ogg') && !url.endsWith('.mp3')) {
        return url + '.ogg';
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

  // Process all items
  console.log(
    `Processing ${links.length} total links`
  );

  for (let i = 0; i < 50; i++) {
    const link = links[i];
    console.log(`Processing item ${i + 1}/${links.length}: ${link}`);

    let infoData = await info(link);
    
    // Check if name is empty, if so break and save current data
    if (!infoData.name || infoData.name.trim() === '') {
      console.log(`Empty name found at item ${i + 1}, stopping crawl and saving current data...`);
      break;
    }
    
    infos.push(infoData);

    // Add delay between requests (10 seconds)
    if (i < 49) { // Since we're limiting to 50 items
      const delay = 10000; // 10 seconds
      console.log(`Waiting ${delay / 1000}s before next request...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Write the collected infos to data/infos.json
  fs.writeFileSync("data/infos.json", JSON.stringify(infos, null, 2));
  console.log("Infos saved to data/infos.json");

  return infos;
}

module.exports = infos;
