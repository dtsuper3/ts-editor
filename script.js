const editor = CodeMirror.fromTextArea(document.getElementById('codeEditor'), {
    mode: 'javascript',
    theme: 'default',
    lineNumbers: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    lineWrapping: true,
    autofocus: true
});

const STORAGE_KEY = 'js-editor-code';
const THEME_KEY = 'js-editor-theme';
const LANG_KEY = 'js-editor-language';

const defaultCode = `// Welcome to JS Editor!
// Write your JavaScript/TypeScript code here and click Run

console.log("Hello, World!");

function greet(name) {
    return \`Hello, \${name}!\`;
}

console.log(greet("Developer"));
`;

function updateEditorTheme(isLight) {
    editor.setOption('theme', isLight ? 'default' : 'default');
    document.body.classList.toggle('light-theme', isLight);
}

function loadSettings() {
    const savedCode = localStorage.getItem(STORAGE_KEY);
    if (savedCode) {
        editor.setValue(savedCode);
    } else {
        editor.setValue(defaultCode);
    }

    const savedTheme = localStorage.getItem(THEME_KEY);
    const isLight = savedTheme === 'light';
    updateEditorTheme(isLight);
    document.getElementById('themeToggle').textContent = isLight ? '☀️' : '🌙';

    const savedLang = localStorage.getItem(LANG_KEY);
    if (savedLang) {
        document.getElementById('languageSelect').value = savedLang;
        updateMode(savedLang);
    }
}

function updateMode(lang) {
    const mode = lang === 'typescript' ? 'javascript' : 'javascript';
    editor.setOption('mode', mode);
}

function saveCode() {
    localStorage.setItem(STORAGE_KEY, editor.getValue());
}

function clearOutput() {
    document.getElementById('output').innerHTML = '';
}

function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString('en-US', { hour12: false });
}

function logToOutput(type, ...args) {
    const output = document.getElementById('output');
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;

    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = `[${getTimestamp()}]`;
    entry.appendChild(timestamp);

    const text = args.map(arg => {
        if (typeof arg === 'object') {
            try {
                return JSON.stringify(arg, null, 2);
            } catch {
                return String(arg);
            }
        }
        return String(arg);
    }).join(' ');

    entry.appendChild(document.createTextNode(text));
    output.appendChild(entry);
    output.scrollTop = output.scrollHeight;
}

function showTranspileStatus(message, isError = false) {
    const status = document.getElementById('transpileStatus');
    status.textContent = message;
    status.style.color = isError ? '#f48771' : '#6a9955';
    status.style.fontSize = '12px';
    setTimeout(() => { status.textContent = ''; }, 3000);
}

function transpileTypeScript(code) {
    try {
        const result = ts.transpileModule(code, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2020,
                strict: false,
                esModuleInterop: true,
                skipLibCheck: true,
                forceConsistentCasingInFileNames: true
            },
            reportDiagnostics: true
        });

        if (result.diagnostics && result.diagnostics.length > 0) {
            const errors = result.diagnostics.map(d => {
                const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
                if (d.file && d.start !== undefined) {
                    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
                    return `TS${d.code}: Line ${line + 1}:${character + 1} - ${message}`;
                }
                return `TS${d.code}: ${message}`;
            }).join('\n');
            showTranspileStatus('TypeScript errors', true);
            throw new Error(errors);
        }

        showTranspileStatus('TypeScript transpiled');
        return result.outputText;
    } catch (error) {
        throw error;
    }
}

function executeCode() {
    clearOutput();
    const code = editor.getValue();
    const lang = document.getElementById('languageSelect').value;

    let execCode = code;
    if (lang === 'typescript') {
        try {
            execCode = transpileTypeScript(code);
        } catch (error) {
            logToOutput('error', error.message);
            return;
        }
    }

    const customConsole = {
        log: (...args) => logToOutput('log', ...args),
        error: (...args) => logToOutput('error', ...args),
        warn: (...args) => logToOutput('warn', ...args),
        info: (...args) => logToOutput('info', ...args),
        clear: () => clearOutput()
    };

    try {
        const fn = new Function('console', execCode);
        fn(customConsole);
    } catch (error) {
        logToOutput('error', `Runtime Error: ${error.message}`);
    }
}

document.getElementById('runBtn').addEventListener('click', executeCode);
document.getElementById('clearBtn').addEventListener('click', clearOutput);
document.getElementById('themeToggle').addEventListener('click', () => {
    const isLight = document.body.classList.toggle('light-theme');
    document.getElementById('themeToggle').textContent = isLight ? '☀️' : '🌙';
    localStorage.setItem(THEME_KEY, isLight ? 'light' : 'dark');
});

document.getElementById('languageSelect').addEventListener('change', (e) => {
    updateMode(e.target.value);
    localStorage.setItem(LANG_KEY, e.target.value);
});

editor.on('change', saveCode);

const resizer = document.querySelector('.resizer');
const editorPane = document.querySelector('.editor-pane');
const outputPane = document.querySelector('.output-pane');
let isResizing = false;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const container = document.querySelector('.editor-container');
    const containerRect = container.getBoundingClientRect();
    const percentage = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    const clamped = Math.max(20, Math.min(80, percentage));
    editorPane.style.flex = `0 0 ${clamped}%`;
    outputPane.style.flex = `0 0 ${100 - clamped}%`;
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});

document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        executeCode();
    }
});

loadSettings();
