const fs = require('fs');
const { marked } = require('marked');
const md = fs.readFileSync('./AI_Engineer_Roadmap.md', 'utf-8');
const body = marked.parse(md);
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>AI Engineer Roadmap</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:#0f0f1a;color:#e0e0ef;padding:40px 60px;line-height:1.7;font-size:14px}
h1{font-size:28px;background:linear-gradient(135deg,#6366f1,#a855f7,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin:30px 0 10px;font-weight:900}
h2{font-size:20px;color:#a78bfa;margin:25px 0 8px;border-bottom:1px solid #2d2d44;padding-bottom:6px}
h3{font-size:16px;color:#67e8f9;margin:18px 0 6px}
h4{font-size:14px;color:#fbbf24;margin:14px 0 4px}
p{margin:6px 0}
ul,ol{margin:4px 0 4px 20px}
li{margin:2px 0}
table{width:100%;border-collapse:collapse;margin:12px 0;font-size:13px}
th{background:#1e1e36;color:#a78bfa;padding:8px 12px;text-align:left;border:1px solid #2d2d44}
td{padding:8px 12px;border:1px solid #2d2d44;background:#16162a}
code{background:#1e1e36;color:#67e8f9;padding:2px 6px;border-radius:4px;font-size:13px}
blockquote{border-left:3px solid #a855f7;padding:10px 16px;margin:12px 0;background:#1a1a2e;border-radius:0 8px 8px 0}
hr{border:none;border-top:1px solid #2d2d44;margin:20px 0}
input[type=checkbox]{accent-color:#a855f7;margin-right:6px}
strong{color:#f0abfc}
a{color:#818cf8}
@media print{body{background:#0f0f1a;-webkit-print-color-adjust:exact;print-color-adjust:exact}h1,h2{break-after:avoid}table{break-inside:avoid}}
</style></head><body>${body}</body></html>`;
fs.writeFileSync('./AI_Engineer_Roadmap.html', html);
console.log('Done! Open AI_Engineer_Roadmap.html in browser and Ctrl+P to save as PDF');
