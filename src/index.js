const scrapeLinks = require('./scrape_links');
const infos = require('./infos');
// scrapeLinks('https://mynoise.net/noiseMachines.php').catch(console.error);
infos().catch(console.error);