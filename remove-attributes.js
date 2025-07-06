const fs = require('fs');
const path = require('path');

// Read the file as string
const filePath = path.join(__dirname, 'library.json');
let jsonContent = fs.readFileSync(filePath, 'utf8');

// Parse JSON to work with the actual structure
let jsonObj = JSON.parse(jsonContent);

// Attributes to remove
const attributesToRemove = ['seats', 'dwellTime', 'openingHours'];

// Recursive function to remove specified attributes from all levels
function removeAttributes(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => removeAttributes(item));
    } else if (typeof obj === 'object' && obj !== null) {
        const newObj = {};
        for (const [key, value] of Object.entries(obj)) {
            if (!attributesToRemove.includes(key)) {
                newObj[key] = removeAttributes(value);
            }
        }
        return newObj;
    }
    return obj;
}

// Process the JSON object
jsonObj = removeAttributes(jsonObj);

// Convert back to string with proper formatting
const updatedJson = JSON.stringify(jsonObj, null, 4);

// Write back to file
fs.writeFileSync(filePath, updatedJson, 'utf8');

console.log(`Successfully removed ${attributesToRemove.join(', ')} and their children from library.json`); 