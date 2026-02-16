// UI Module
// Handles all UI controls, buttons, console, fullscreen, and canvas focus management

export function getQueryVariable(variable) {
    var query = window.location.search.substring(1);
    var vars = query.split('&');
    for (var i = 0; i < vars.length; i++) {
        var pair = vars[i].split('=');
        if (decodeURIComponent(pair[0]) == variable) {
            return decodeURIComponent(pair[1]);
        }
    }
    return null;
}

export class UIManager {
    constructor() {
        this.loader = document.getElementById('loader');
        this.loaderContent = this.loader ? this.loader.querySelector('.loader-content') : null;
        this.loaderCount = 0;
        this.consoleOutput = document.getElementById('console-output');
        
        // Expose loader methods globally
        window.glslViewerLoader = { 
            show: this.showLoader.bind(this), 
            hide: this.hideLoader.bind(this), 
            update: this.updateLoader.bind(this) 
        };
    }

    showLoader(text) {
        this.loaderCount++;
        if (text && this.loaderContent) this.loaderContent.innerText = text;
        if (this.loader && this.loaderCount > 0) this.loader.classList.add('visible');
    }

    updateLoader(text) {
        if (text && this.loaderContent) this.loaderContent.innerText = text;
    }

    hideLoader() {
        this.loaderCount--;
        if (this.loader && this.loaderCount <= 0) {
            this.loader.classList.remove('visible');
            this.loaderCount = 0;
            if (this.loaderContent) this.loaderContent.innerText = "Loading...";
        }
    }

    logToConsole(text, isError = false) {
        if (!this.consoleOutput) return;
        const msg = document.createElement('div');
        msg.textContent = text;
        if (isError) msg.style.color = '#ff5555';
        this.consoleOutput.appendChild(msg);
        this.consoleOutput.scrollTop = this.consoleOutput.scrollHeight;
    }

    clearConsole() {
        if (this.consoleOutput) {
            this.consoleOutput.innerHTML = '';
        }
    }

    setupConsoleEvents() {
        window.addEventListener('wasm-stdout', (e) => {
            this.logToConsole(e.detail, false);
        });

        window.addEventListener('wasm-stderr', (e) => {
            this.logToConsole(e.detail, true);
        });
    }

    getFullscreen() {
        const wrapper = document.getElementById('wrapper');
        return wrapper && wrapper.classList.contains('fullscreen');
    }

    setFullscreen(isFullscreen) {
        const wrapper = document.getElementById('wrapper');
        const editorContainer = document.getElementById('editor-container');
        const consoleOutput = document.getElementById('console-output');
        
        if (wrapper) {
            if (isFullscreen) {
                wrapper.classList.add('fullscreen');
                wrapper.classList.remove('windowed');
                document.body.classList.remove('windowed-mode');
                wrapper.style.transform = "none";
                if (editorContainer) editorContainer.style.display = 'none';
                if (consoleOutput && consoleOutput.parentElement) 
                    consoleOutput.parentElement.style.display = 'none';
            } else {
                wrapper.classList.remove('fullscreen');
                wrapper.classList.add('windowed');
                document.body.classList.add('windowed-mode');
                if (editorContainer) editorContainer.style.display = 'block';
                if (consoleOutput && consoleOutput.parentElement) 
                    consoleOutput.parentElement.style.display = 'flex';
            }
        }
    }

    setupCanvasFocus(editorContainerId) {
        const canvas = document.getElementById('canvas');
        const wrapper = document.getElementById('wrapper');
        const editorContainer = document.getElementById(editorContainerId);
        
        // Blur canvas when clicking on editor or console
        if (editorContainer) {
            editorContainer.addEventListener('mousedown', () => {
                if (canvas) canvas.blur();
            });
        }

        // Focus canvas when mouse is over it or wrapper
        if (wrapper && canvas) {
            wrapper.addEventListener('mouseenter', () => {
                canvas.focus();
            });
            wrapper.addEventListener('mouseleave', () => {
                if (document.activeElement === canvas) {
                    canvas.blur();
                }
            });
        }

        // Stop keyboard events from propagating to the module when in editor/console
        function stopPropagation(e) {
            e.stopPropagation();
        }

        if (editorContainer) {
            editorContainer.addEventListener('keydown', stopPropagation);
            editorContainer.addEventListener('keypress', stopPropagation);
            editorContainer.addEventListener('keyup', stopPropagation);
        }

        const consoleInput = document.getElementById('console-input');
        if (consoleInput) {
            consoleInput.addEventListener('keydown', stopPropagation);
            consoleInput.addEventListener('keypress', stopPropagation);
            consoleInput.addEventListener('keyup', stopPropagation);
        }

        const consoleDiv = document.getElementById('console');
        if (consoleDiv) {
            consoleDiv.addEventListener('mousedown', () => {
                if (canvas) canvas.blur();
            });
        }
    }

    setupTabSwitching(editorManager) {
        const tabFrag = document.querySelector('.tab[data-type="frag"]');
        const tabVert = document.querySelector('.tab[data-type="vert"]');

        const switchTab = (type) => {
            if (this.getFullscreen()) {
                this.setFullscreen(false);
            }
            
            editorManager.switchTab(type, () => {
                // This is the onSwitch callback
            });
            
            // Update UI
            if (type === 'frag') {
                if (tabFrag) tabFrag.classList.add('active');
                if (tabVert) tabVert.classList.remove('active');
            } else {
                if (tabFrag) tabFrag.classList.remove('active');
                if (tabVert) tabVert.classList.add('active');
            }
        };

        if (tabFrag) {
            tabFrag.addEventListener('click', () => switchTab('frag'));
        }
        if (tabVert) {
            tabVert.style.display = 'inline-block';
            tabVert.addEventListener('click', () => switchTab('vert'));
        }
    }

    setupResizeButton(onToggle) {
        const btn = document.getElementById('resize-btn');
        const wrapper = document.getElementById('wrapper');
        
        if (btn && wrapper) {
            wrapper.classList.remove('fullscreen');
            wrapper.classList.add('windowed');
            document.body.classList.add('windowed-mode');

            btn.addEventListener('click', () => {
                const newState = !this.getFullscreen();
                this.setFullscreen(newState);
                if (onToggle) onToggle(newState);
            });
        }
    }

    setupScreenshotButton() {
        const screenshotBtn = document.getElementById('screenshot-btn');
        if (screenshotBtn) {
            screenshotBtn.addEventListener('click', () => {
                const canvas = document.getElementById('canvas');
                if (!canvas) return;
                
                try {
                    canvas.toBlob((blob) => {
                        if (!blob) {
                            console.error('Failed to create screenshot blob');
                            return;
                        }
                        
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
                        link.download = `glslviewer-screenshot-${timestamp}.png`;
                        link.href = url;
                        link.click();
                        
                        setTimeout(() => URL.revokeObjectURL(url), 100);
                        
                        this.logToConsole('Screenshot saved');
                    }, 'image/png');
                } catch (error) {
                    console.error('Error taking screenshot:', error);
                    this.logToConsole('Error taking screenshot: ' + error.message, true);
                }
            });
        }
    }

    async uploadCanvasToLygia(gistId) {
        const canvas = document.getElementById('canvas');
        if (!canvas) {
            console.error('Canvas not found');
            return false;
        }

        try {
            // Wait for next animation frame to ensure WebGL has finished rendering
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Log original canvas dimensions
            console.log(`Original canvas size: ${canvas.width}x${canvas.height}`);
            
            // Create a 128x128 canvas for the thumbnail
            const thumbnailCanvas = document.createElement('canvas');
            thumbnailCanvas.width = 128;
            thumbnailCanvas.height = 128;
            const ctx = thumbnailCanvas.getContext('2d');
            
            // Fill with black background (in case canvas has transparency)
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 128, 128);
            
            // Draw the original canvas scaled down to 128x128
            // This will stretch/squash to fit exactly 128x128
            ctx.drawImage(canvas, 0, 0, 128, 128);
            
            console.log(`Thumbnail canvas size: ${thumbnailCanvas.width}x${thumbnailCanvas.height}`);
            
            // Convert to PNG blob
            const blob = await new Promise((resolve, reject) => {
                thumbnailCanvas.toBlob((blob) => {
                    if (blob) {
                        console.log(`PNG blob created: ${blob.size} bytes, type: ${blob.type}`);
                        resolve(blob);
                    }
                    else reject(new Error('Failed to create thumbnail blob'));
                }, 'image/png');
            });
            
            // Verify blob is PNG
            if (blob.type !== 'image/png') {
                throw new Error(`Expected image/png, got ${blob.type}`);
            }
            
            // Create form data with the correct filename
            const formData = new FormData();
            formData.append('file', blob, `${gistId}.png`);
            
            console.log(`Uploading ${gistId}.png (128x128) to lygia.xyz...`);
            
            // Upload to lygia.xyz
            const response = await fetch(`https://lygia.xyz/upload/gist/${gistId}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Upload failed (${response.status}): ${errorText}`);
            }
            
            this.logToConsole(`Canvas thumbnail (128x128 PNG) uploaded to lygia.xyz`);
            console.log(`Successfully uploaded 128x128 thumbnail for gist ${gistId}`);
            return true;
            
        } catch (error) {
            console.error('Error uploading to lygia.xyz:', error);
            this.logToConsole(`Error uploading thumbnail: ${error.message}`, true);
            return false;
        }
    }

    setupResizeObserver() {
        const wrapper = document.getElementById('wrapper');
        if (wrapper) {
            const resizeObserver = new ResizeObserver(() => {
                window.dispatchEvent(new Event('resize'));
            });
            resizeObserver.observe(wrapper);
        }
    }

    setupConsoleInput(onCommand) {
        const consoleInput = document.getElementById('console-input');
        if (consoleInput) {
            consoleInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const cmd = consoleInput.value.trim();
                    if (cmd) {
                        onCommand(cmd);
                        consoleInput.value = '';
                    }
                }
            });
        }
    }

    setupViewDropdown(glslviewer) {
        const viewBtn = document.getElementById('view-btn');
        const viewDropdown = document.getElementById('view-dropdown');
        
        if (!viewBtn || !viewDropdown) return;

        const cmds_state = glslviewer.getCommandsState();
        const cmds_plot_modes = glslviewer.getPlotModes();

        const updateViewDropdown = () => {
            viewDropdown.innerHTML = '';
            cmds_state.forEach((cmd) => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                
                const checkbox = document.createElement('span');
                checkbox.className = 'checkbox';
                checkbox.textContent = '☐';
                
                const label = document.createElement('span');
                label.textContent = cmd.replace('_', ' ');
                
                item.appendChild(checkbox);
                item.appendChild(label);
                
                item.addEventListener('click', () => {
                    if (cmd === 'plot') {
                        let currentState = glslviewer.query(cmd) || 'off';
                        const currentIndex = cmds_plot_modes.indexOf(currentState);
                        const nextIndex = (currentIndex + 1) % cmds_plot_modes.length;
                        const newState = cmds_plot_modes[nextIndex];
                        glslviewer.sendCommand(cmd + ',' + newState);
                    } else if (cmd === 'fullscreen') {
                        const currentState = this.getFullscreen() ? 'on' : 'off';
                        const newState = (currentState === 'on') ? 'off' : 'on';
                        this.setFullscreen(newState === 'on');
                    } else {
                        let currentState = glslviewer.query(cmd) || 'off';
                        const newState = (currentState === 'on') ? 'off' : 'on';
                        glslviewer.sendCommand(cmd + ',' + newState);
                    }
                    
                    setTimeout(updateViewDropdownStates, 100);
                });
                
                viewDropdown.appendChild(item);
            });
            updateViewDropdownStates();
        };
        
        const updateViewDropdownStates = () => {
            const items = viewDropdown.querySelectorAll('.dropdown-item');
            items.forEach((item, index) => {
                const cmd = cmds_state[index];
                const checkbox = item.querySelector('.checkbox');
                
                let state = 'off';
                if (cmd === 'fullscreen') {
                    state = this.getFullscreen() ? 'on' : 'off';
                } else {
                    state = glslviewer.query(cmd) || 'off';
                }
                
                if (cmd === 'plot') {
                    checkbox.textContent = state;
                } else {
                    checkbox.textContent = (state === 'on') ? '☑' : '☐';
                }
            });
        };
        
        viewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = viewDropdown.style.display === 'block';
            viewDropdown.style.display = isVisible ? 'none' : 'block';
            if (!isVisible) {
                updateViewDropdown();
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!viewBtn.contains(e.target) && !viewDropdown.contains(e.target)) {
                viewDropdown.style.display = 'none';
            }
        });
    }

    setupGitHubButtons(github, callbacks) {
        const newBtn = document.getElementById('new-btn');
        const loginBtn = document.getElementById('login-btn');
        const saveBtn = document.getElementById('save-btn');
        const openBtn = document.getElementById('open-btn');

        const updateUI = () => {
            if (github.isLoggedIn()) {
                loginBtn.textContent = 'Log out (' + github.getUser() + ')';
                saveBtn.style.display = 'block';
            } else {
                loginBtn.textContent = 'Login';
                saveBtn.style.display = 'none';
            }
        };

        if (newBtn) {
            newBtn.addEventListener('click', () => {
                if (confirm('Create a new shader? This will clear your current work.')) {
                    window.location.href = window.location.pathname;
                }
            });
        }
        
        if (loginBtn) {
            loginBtn.addEventListener('click', () => {
                github.login();
                updateUI();
            });
        }
        
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                if (callbacks.onSave) callbacks.onSave();
            });
        }
        
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                const gistId = github.promptForGistId();
                if (gistId) {
                    window.location.search = '?gist=' + gistId;
                }
            });
        }

        // Initial UI update
        github.checkToken().then(updateUI);
    }

    setupFileDragDrop(onDrop) {
        const handleDrop = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const files = e.dataTransfer.files;
            if (onDrop) {
                onDrop(files);
            }
        };
        
        document.body.addEventListener('dragover', (e) => { 
            e.preventDefault(); 
            e.stopPropagation(); 
        });
        document.body.addEventListener('drop', handleDrop);
    }
}
