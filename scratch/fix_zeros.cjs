const fs = require('fs');
const path = 'src/pages/CreateTripPage.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(/value={stop\.startDay}/g, 'value={stop.startDay || \'\'}');
content = content.replace(/value={stop\.endDay}/g, 'value={stop.endDay || \'\'}');
fs.writeFileSync(path, content);
console.log('Replaced successfully');
