const fs = require('fs');
const path = require('path');

const srcFile = path.join(__dirname, 'src', 'gantt_planner_markdown_driven_react.tsx');
const outFile = path.join(__dirname, 'gantt_planner_standalone.html');

const htmlTemplate = (appCode) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Gantt Planner Standalone</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script crossorigin src="https://unpkg.com/react@18/umd/react.development.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    body { background: #f8fafc; }
    .gantt-scrollbar::-webkit-scrollbar { height: 8px; background: #e2e8f0; }
    .gantt-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
  </style>
</head>
<body class="min-h-screen">
  <div id="root"></div>
  <script type="text/babel">

const { useState, useEffect, useMemo, useRef } = React;

${appCode}

// Mount the app
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
  </script>
</body>
</html>
`;

let code = fs.readFileSync(srcFile, 'utf8');

// Remove import statements
code = code.replace(/import[^;]+;/g, '');

// Remove interface declarations
code = code.replace(/interface [^{]+\{[^}]+\}/g, '');

// Remove type declarations section and any orphaned type syntax
code = code.replace(/\/\/ -------------------- Types --------------------[\s\S]*?\/\/ -------------------- Scheduling Core --------------------/g, '// -------------------- Scheduling Core --------------------');

// Remove TypeScript-specific syntax - minimal and safe approach
// Remove generic type parameters from React hooks
code = code.replace(/useState<[^>]+>/g, 'useState');
code = code.replace(/useMemo<[^>]+>/g, 'useMemo');
code = code.replace(/useEffect<[^>]+>/g, 'useEffect');
code = code.replace(/useRef<[^>]+>/g, 'useRef');

// Remove type annotations from Map/Set constructors
code = code.replace(/new Map<[^>]+>/g, 'new Map');
code = code.replace(/new Set<[^>]+>/g, 'new Set');
code = code.replace(/new Int16Array/g, 'new Int16Array');

// Remove array type annotations like Date[]
code = code.replace(/: Date\[\]/g, '');
code = code.replace(/: Task\[\]/g, '');

// Remove type assertions (as Type)
code = code.replace(/\(([^)]+) as [^)]+\)/g, '($1)');

// Remove function parameter type annotations
code = code.replace(/(\w+): [^,)]+/g, '$1');
code = code.replace(/\{([^}]+)\}: \{[^}]+\}/g, '{$1}');

// Remove variable type annotations
code = code.replace(/: ScheduleResult\["rows"\]/g, '');

// Remove return type annotations from function declarations
code = code.replace(/\): [^{]+{/g, ') {');

// Replace export default function App() with function App()
code = code.replace(/export default function App\(\)/, 'function App()');

// Write the HTML file
fs.writeFileSync(outFile, htmlTemplate(code), 'utf8');
console.log('Standalone HTML generated:', outFile);
