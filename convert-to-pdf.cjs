const fs = require('fs');
const { marked } = require('marked');

const md = fs.readFileSync('AI_Engineer_Roadmap.md', 'utf8');
const htmlBody = marked.parse(md);

const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>AI Engineer Roadmap</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#1a1a2e;line-height:1.7;padding:40px 60px;max-width:900px;margin:0 auto;font-size:13px}
h1{font-size:28px;font-weight:900;margin:30px 0 10px;color:#0f0f23;border-bottom:3px solid #667eea;padding-bottom:8px}
h2{font-size:20px;font-weight:700;margin:24px 0 8px;color:#1a1a4e}
h3{font-size:16px;font-weight:600;margin:16px 0 6px;color:#333}
h4{font-size:14px;font-weight:600;margin:12px 0 4px;color:#444}
p{margin:6px 0}
ul,ol{margin:4px 0 4px 20px}
li{margin:2px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:12px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#667eea;color:#fff;font-weight:600}
tr:nth-child(even){background:#f8f9ff}
hr{border:none;border-top:2px solid #e0e0e0;margin:20px 0}
blockquote{border-left:4px solid #667eea;padding:8px 16px;margin:12px 0;background:#f0f2ff;font-style:italic}
code{background:#f0f0f0;padding:1px 4px;border-radius:3px;font-size:12px}
input[type="checkbox"]{margin-right:6px}
@media print{body{padding:20px 30px;font-size:11px}h1{font-size:24px}h2{font-size:17px}h3{font-size:14px}}
</style></head><body>${htmlBody}</body></html>`;

fs.writeFileSync('AI_Engineer_Roadmap.html', html);
console.log('HTML created: AI_Engineer_Roadmap.html');
console.log('Open this file in Chrome and use Ctrl+P > Save as PDF');
