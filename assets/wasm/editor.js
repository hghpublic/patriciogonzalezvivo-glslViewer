// CodeMirror Editor Module
// Handles editor setup, configuration, and Lygia autocomplete

function getJSON(url, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'json';
    xhr.onload = function() {
        var status = xhr.status;
        if (status === 200) {
            callback(null, xhr.response);
        } else {
            callback(status, xhr.response);
        }
    };
    xhr.send();
}

export class EditorManager {
    constructor(containerId, defaultContent) {
        this.activeTab = 'frag';
        this.content = {
            frag: defaultContent.frag,
            vert: defaultContent.vert
        };
        this.updateTimeout = null;
        this.lygiaGlob = null;
        this.lygiaFetching = false;
        
        this.editor = this.initializeEditor(containerId);
        this.setupLygiaAutocomplete();
    }

    initializeEditor(containerId) {
        const editorContainer = document.getElementById(containerId);
        if (!editorContainer) {
            throw new Error('Editor container not found');
        }

        const editor = CodeMirror(editorContainer, {
            value: this.content.frag,
            mode: 'x-shader/x-fragment',
            theme: 'monokai',
            lineNumbers: true,
            matchBrackets: true,
            keyMap: 'sublime',
            tabSize: 4,
            indentUnit: 4,
            extraKeys: {
                "Cmd-/": "toggleComment",
                "Ctrl-/": "toggleComment",
                "Alt-Up": "swapLineUp",
                "Alt-Down": "swapLineDown"
            }
        });
        editor.setSize(null, "100%");
        
        return editor;
    }

    setupLygiaAutocomplete() {
        this.editor.on('inputRead', (cm, change) => {
            let cur = cm.getCursor();
            let line = cm.getLine(cur.line);
            let trimmedLine = line.trim();
              
            if (trimmedLine.startsWith('#include')) {
                let path = line.substring(10);
                if (this.lygiaGlob === null) {
                    getJSON('https://lygia.xyz/glsl.json', (err, data) => {
                        if (err === null) {
                            this.lygiaGlob = data;
                        }
                    });
                }
                console.log('autocomplete for', path);

                let result = [];

                if (this.lygiaGlob !== null) {
                    this.lygiaGlob.forEach((w) => {
                        if (w.startsWith(path)) {
                            result.push('#include "' + w + '"');
                        }
                    });
                    result.sort();
                }

                if (result.length > 0) {
                    CodeMirror.showHint(cm, () => {
                        let start = line.indexOf('#include');
                        let end = cur.ch;
                        if (line.length > end && line[end] === '"') {
                            end++;
                        }

                        let rta = {
                            list: result, 
                            from: CodeMirror.Pos(cur.line, start),
                            to: CodeMirror.Pos(cur.line, end)
                        };
                        
                        console.log(rta);
                        return rta;
                    }, {completeSingle: true, alignWithWord: true});
                }
            }
        });
    }

    setupErrorHighlighting() {
        window.addEventListener('wasm-stderr', (e) => {
            const text = e.detail;
            
            // Regex to match GLSL errors
            const errorRegex = /^0:(\d+):(.*)$/;
            const match = text.match(errorRegex);
            
            if (match) {
                const line = parseInt(match[1], 10);
                const cmLine = line - 1;
                
                if (this.editor) {
                    if (cmLine >= 0 && cmLine < this.editor.lineCount()) {
                        this.editor.addLineClass(cmLine, 'background', 'error-line');
                    }
                }
            }
        });
    }

    clearErrorHighlighting() {
        this.editor.eachLine((lineHandle) => {
            this.editor.removeLineClass(lineHandle, 'background', 'error-line');
        });
    }

    onChange(callback, debounceMs = 300) {
        this.editor.on('change', () => {
            this.clearErrorHighlighting();

            if (this.updateTimeout) clearTimeout(this.updateTimeout);

            this.updateTimeout = setTimeout(() => {
                const currentCode = this.editor.getValue();
                if (currentCode !== this.content[this.activeTab]) {
                    callback();
                }
                this.updateTimeout = null;
            }, debounceMs);
        });
    }

    switchTab(type, onSwitch) {
        if (type === this.activeTab) return;
        
        // Flush pending updates
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            if (onSwitch) onSwitch();
        }

        // Save current content
        this.content[this.activeTab] = this.editor.getValue();
        
        // Switch state
        this.activeTab = type;
        
        // Update editor mode
        if (type === 'frag') {
            this.editor.setOption('mode', 'x-shader/x-fragment');
        } else {
            this.editor.setOption('mode', 'x-shader/x-vertex');
        }
        
        // Set new content
        this.editor.setValue(this.content[this.activeTab]);
    }

    getValue() {
        return this.editor.getValue();
    }

    setValue(value) {
        this.editor.setValue(value);
    }

    getContent(type) {
        return this.content[type || this.activeTab];
    }

    setContent(type, value) {
        this.content[type] = value;
        if (type === this.activeTab) {
            this.editor.setValue(value);
        }
    }

    getAllContent() {
        // Save current editor content first
        this.content[this.activeTab] = this.editor.getValue();
        return { ...this.content };
    }

    getActiveTab() {
        return this.activeTab;
    }

    getEditor() {
        return this.editor;
    }
}
