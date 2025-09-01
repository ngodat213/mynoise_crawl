const fs = require('fs');

function clearPresets() {
  try {
    // Read the JSON file
    const filePath = 'data/infos copy.json';
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    let totalRemoved = 0;
    let totalPresets = 0;
    
    // Process each item
    data.forEach((item, itemIndex) => {
      if (item.presets && Array.isArray(item.presets)) {
        totalPresets += item.presets.length;
        
        // Filter out presets with title "●"
        const originalLength = item.presets.length;
        item.presets = item.presets.filter(preset => preset.title !== "●");
        const removed = originalLength - item.presets.length;
        totalRemoved += removed;
        
        if (removed > 0) {
          console.log(`Item ${itemIndex + 1}: Removed ${removed} preset(s) with title "●"`);
        }
      }
    });
    
    // Write the cleaned data back to file
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    console.log(`\nCleaning completed!`);
    console.log(`Total presets before: ${totalPresets}`);
    console.log(`Total presets removed: ${totalRemoved}`);
    console.log(`Total presets remaining: ${totalPresets - totalRemoved}`);
    console.log(`File saved: ${filePath}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the cleaning function
clearPresets();
