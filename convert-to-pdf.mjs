import fs from 'fs';
import { marked } from 'marked';

const md = fs.readFileSync('AI_Engineer_Roadmap.md', 'utf8');
const htmlBody = marked.parse(md);

const css = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;color:#1a1a2e;line-height:1.65;padding:40px 50px;max-width:850px;margin:0 auto;font-size:12.5px}
h1{font-size:26px;font-weight:900;margin:28px 0 8px;color:#0f0f23;border-bottom:3px solid #667eea;padding-bottom:6px}
h2{font-size:19px;font-weight:700;margin:20px 0 6px;color:#1a1a4e}
h3{font-size:15px;font-weight:600;margin:14px 0 4px;color:#333}
h4{font-size:13px;font-weight:600;margin:10px 0 3px;color:#444}
p{margin:5px 0}
ul,ol{margin:3px 0 3px 18px}
li{margin:1.5px 0}
table{width:100%;border-collapse:collapse;margin:10px 0;font-size:11.5px}
th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
th{background:#667eea;color:#fff;font-weight:600}
tr:nth-child(even){background:#f8f9ff}
hr{border:none;border-top:2px solid #e0e0e0;margin:18px 0}
blockquote{border-left:4px solid #667eea;padding:8px 14px;margin:10px 0;background:#f0f2ff;font-style:italic}
code{background:#f0f0f0;padding:1px 3px;border-radius:3px;font-size:11.5px}
@media print{body{padding:15px 25px;font-size:11px}h1{font-size:22px;break-after:avoid}h2{font-size:16px;break-after:avoid}h3{font-size:13px;break-after:avoid}table{break-inside:avoid}}
`;

const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>AI Engineer Roadmap</title><style>' + css + '</style></head><body>' + htmlBody + '</body></html>';

fs.writeFileSync('AI_Engineer_Roadmap.html', html);
console.log('Created: AI_Engineer_Roadmap.html');
