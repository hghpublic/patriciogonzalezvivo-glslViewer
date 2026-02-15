// GitHub Integration Module
// Handles authentication, gist loading/saving, and author attribution

export class GitHubIntegration {
    constructor() {
        this.token = localStorage.getItem('github_token');
        this.user = null;
        this.currentGistId = null;
        this.gistHistory = [];
        this.currentGistAuthors = { 
            first: null, 
            firstGistId: null, 
            last: null, 
            lastGistId: null 
        };
        
        // Load gist history from localStorage
        this.loadGistHistory();
    }

    loadGistHistory() {
        try {
            const savedHistory = localStorage.getItem('gist_history');
            if (savedHistory) {
                this.gistHistory = JSON.parse(savedHistory);
                console.log('Loaded gist history from localStorage:', this.gistHistory);
            }
        } catch (e) {
            console.error('Error loading gist history:', e);
        }
    }

    saveGistHistory() {
        try {
            localStorage.setItem('gist_history', JSON.stringify(this.gistHistory));
            console.log('Saved gist history to localStorage');
        } catch (e) {
            console.error('Error saving gist history:', e);
        }
    }

    async checkToken() {
        if (this.token) {
            try {
                const response = await fetch('https://api.github.com/user', {
                    headers: { 'Authorization': 'token ' + this.token }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.user = data.login;
                    return true;
                } else {
                    throw new Error('Invalid token');
                }
            } catch (err) {
                console.warn('GitHub token invalid:', err);
                this.logout();
                return false;
            }
        }
        return false;
    }

    login() {
        if (this.user) {
            // Already logged in, this is a logout
            this.logout();
            return false;
        } else {
            const token = prompt('Please enter your GitHub Personal Access Token:');
            if (token) {
                this.token = token;
                localStorage.setItem('github_token', token);
                this.checkToken();
                return true;
            }
        }
        return false;
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('github_token');
    }

    getUser() {
        return this.user;
    }

    isLoggedIn() {
        return this.user !== null;
    }

    promptForGistId() {
        const id = prompt('Please enter Gist ID or URL:');
        if (id) {
            // Extract ID if full URL
            return id.split('/').pop();
        }
        return null;
    }

    async fetchGitHubUserInfo(usernameOrId) {
        try {
            let url;
            if (typeof usernameOrId === 'number' || /^\d+$/.test(usernameOrId)) {
                url = `https://api.github.com/user/${usernameOrId}`;
            } else {
                url = `https://api.github.com/users/${usernameOrId}`;
            }
            
            const response = await fetch(url);
            if (!response.ok) {
                console.warn('Failed to fetch user info for:', usernameOrId);
                return null;
            }
            
            const user = await response.json();
            return {
                login: user.login,
                name: user.name || user.login,
                avatar_url: user.avatar_url,
                blog: user.blog || `https://github.com/${user.login}`,
                html_url: user.html_url
            };
        } catch (error) {
            console.error('Error fetching GitHub user info:', error);
            return null;
        }
    }

    updateAuthorInfo() {
        const infoDiv = document.getElementById('author-info');
        if (!infoDiv) return;

        if (!this.currentGistAuthors.last) {
            infoDiv.style.display = 'none';
            return;
        }

        let html = '';
        
        if (this.currentGistAuthors.last) {
            const lastAuthor = this.currentGistAuthors.last;
            const lastUrl = lastAuthor.blog || lastAuthor.html_url;
            html += `By <a href="${lastUrl}" target="_blank" class="author-link">${lastAuthor.name}`;
            html += `<img src="${lastAuthor.avatar_url}" class="author-avatar" alt="${lastAuthor.name}" />`;
            html += `</a>`;
        }

        if (this.currentGistAuthors.first && this.currentGistAuthors.firstGistId &&
            this.currentGistAuthors.firstGistId !== this.currentGistAuthors.lastGistId) {
            const firstAuthor = this.currentGistAuthors.first;
            const firstUrl = firstAuthor.blog || firstAuthor.html_url;
            const firstGistUrl = `${window.location.origin}${window.location.pathname}?gist=${this.currentGistAuthors.firstGistId}`;
            html += `,<br />based on <a href="${firstGistUrl}" target="_blank" class="author-link">this shader </a>`;
            html += `by <a href="${firstUrl}" target="_blank" class="author-link">`;
            html += `<img src="${firstAuthor.avatar_url}" class="author-avatar" alt="${firstAuthor.name}" />`;
            html += `</a>`;
        }

        infoDiv.innerHTML = html;
        infoDiv.style.display = 'block';
    }

    async pruneGistHistory() {
        if (this.gistHistory.length === 0) return;
        
        console.log('Pruning gist history...');
        const validHistory = [];
        
        for (const entry of this.gistHistory) {
            try {
                const response = await fetch(`https://api.github.com/gists/${entry.gistId}`);
                if (response.ok) {
                    validHistory.push(entry);
                } else {
                    console.log(`Gist ${entry.gistId} no longer exists, removing from history`);
                }
            } catch (error) {
                console.warn(`Error checking gist ${entry.gistId}:`, error);
                validHistory.push(entry);
            }
        }
        
        this.gistHistory = validHistory;
        this.saveGistHistory();
    }

    async loadGist(id, callbacks = {}) {
        if (this.currentGistId === id) {
            console.log('Gist ' + id + ' already loading/loaded.');
            return;
        }
        
        this.currentGistId = id;
        
        if (callbacks.onStart) callbacks.onStart();
        
        console.log('Loading Gist:', id);
        
        try {
            const response = await fetch('https://api.github.com/gists/' + id);
            if (!response.ok) throw new Error(response.statusText);
            
            const data = await response.json();
            
            const currentGistOwnerInfo = {
                gistId: id,
                owner: data.owner ? {
                    login: data.owner.login,
                    id: data.owner.id,
                    avatar_url: data.owner.avatar_url
                } : null,
                loadedAt: new Date().toISOString()
            };
            
            // Look for shader.json
            let shaderFile = null;
            if (data.files['shader.json']) {
                shaderFile = data.files['shader.json'];
            } else {
                const names = Object.keys(data.files);
                for (let name of names) {
                    if (name.endsWith('.json')) {
                        shaderFile = data.files[name];
                        break;
                    }
                }
            }

            if (!shaderFile) {
                throw new Error('No valid shader JSON found in Gist');
            }

            let jsonContent;
            if (shaderFile.truncated) {
                if (callbacks.onUpdate) callbacks.onUpdate("Fetching raw Gist content...");
                const rawResponse = await fetch(shaderFile.raw_url);
                jsonContent = await rawResponse.text();
            } else {
                jsonContent = shaderFile.content;
            }

            const json = JSON.parse(jsonContent);
            
            // Load history from the gist JSON
            if (json.history && Array.isArray(json.history)) {
                this.gistHistory = json.history;
                console.log('Loaded gist history from JSON:', this.gistHistory);
            } else {
                this.gistHistory = [];
                console.log('No history found in gist JSON, starting with empty history');
            }
            
            // Add current gist to history chain
            const existingIndex = this.gistHistory.findIndex(h => h.gistId === id);
            if (existingIndex >= 0) {
                this.gistHistory[existingIndex] = currentGistOwnerInfo;
            } else {
                this.gistHistory.push(currentGistOwnerInfo);
            }
            
            this.saveGistHistory();
            
            // Determine first and last authors
            let firstOwner = this.gistHistory.length > 0 && this.gistHistory[0].owner 
                ? this.gistHistory[0].owner 
                : currentGistOwnerInfo.owner;
            let firstGistId = this.gistHistory.length > 0 && this.gistHistory[0].gistId 
                ? this.gistHistory[0].gistId 
                : id;
            let lastOwner = currentGistOwnerInfo.owner;
            let lastGistId = id;
            
            // Fetch full user info
            if (lastOwner) {
                this.currentGistAuthors.last = await this.fetchGitHubUserInfo(lastOwner.login);
                this.currentGistAuthors.lastGistId = lastGistId;
            }
            if (firstOwner && firstOwner.login) {
                this.currentGistAuthors.first = await this.fetchGitHubUserInfo(firstOwner.login);
                this.currentGistAuthors.firstGistId = firstGistId;
            }
            
            this.updateAuthorInfo();
            
            if (callbacks.onSuccess) {
                callbacks.onSuccess(json);
            }
            
        } catch (error) {
            console.error('Error loading Gist:', error);
            this.currentGistId = null;
            if (callbacks.onError) {
                callbacks.onError(error.message);
            }
        }
    }

    async saveGist(payload, filename = 'shader') {
        if (!this.token) {
            alert('Please login first');
            return null;
        }

        if (!filename.endsWith('.json')) {
            filename += '.json';
        }

        await this.pruneGistHistory();

        payload.history = this.gistHistory;

        let contentString;
        try {
            contentString = JSON.stringify(payload, null, 2);
        } catch (e) {
            throw new Error('Error preparing JSON: ' + e.toString());
        }

        let files = {};
        files[filename] = { content: contentString };

        const data = {
            description: "glslViewer Shader: " + filename.replace('.json', ''),
            public: true,
            files: files
        };

        try {
            const response = await fetch('https://api.github.com/gists', {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + this.token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                throw new Error('Save failed: ' + response.statusText);
            }
            
            const result = await response.json();
            const id = result.id;
            
            console.log('Saved Gist:', id);
            
            const ownerInfo = {
                gistId: id,
                owner: result.owner ? {
                    login: result.owner.login,
                    id: result.owner.id,
                    avatar_url: result.owner.avatar_url
                } : null,
                savedAt: new Date().toISOString()
            };
            
            const existingIndex = this.gistHistory.findIndex(h => h.gistId === id);
            if (existingIndex >= 0) {
                this.gistHistory[existingIndex] = ownerInfo;
            } else {
                this.gistHistory.push(ownerInfo);
            }
            
            this.saveGistHistory();
            console.log('Gist history:', this.gistHistory);
            
            return id;
            
        } catch (error) {
            console.error(error);
            throw error;
        }
    }

    getGistHistory() {
        return this.gistHistory;
    }
}
