class GiphyModal {
    constructor() {
        this.modal = document.getElementById('giphyModal');
        this.searchInput = document.getElementById('giphySearch');
        this.searchButton = document.getElementById('searchGiphyBtn');
        this.resultsContainer = document.getElementById('giphyResults');
        this.closeButton = this.modal.querySelector('.close-button');
        this.imageUrlInput = document.getElementById('imageUrl');
        this.setupEventListeners();
    }
    setupEventListeners() {
        // Open modal
        const openButton = document.getElementById('openGiphyBtn');
        openButton === null || openButton === void 0 ? void 0 : openButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.show();
        });
        // Close modal
        this.closeButton.addEventListener('click', () => this.hide());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.hide();
            }
        });
        // Search functionality
        this.searchButton.addEventListener('click', () => this.search());
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.search();
            }
        });
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('show')) {
                this.hide();
            }
        });
    }
    async search() {
        const query = this.searchInput.value.trim();
        if (!query)
            return;
        this.resultsContainer.innerHTML = '<div class="loading">Searching...</div>';
        try {
            const response = await fetch(`/api/search-gifs?q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data.status === 'success' && data.gifs) {
                this.displayResults(data.gifs);
            }
            else {
                throw new Error(data.message || 'Failed to fetch GIFs');
            }
        }
        catch (error) {
            console.error('Error searching GIFs:', error);
            this.resultsContainer.innerHTML = '<div class="error">Failed to load GIFs. Please try again.</div>';
        }
    }
    displayResults(gifs) {
        this.resultsContainer.innerHTML = '';
        if (gifs.length === 0) {
            this.resultsContainer.innerHTML = '<div class="no-results">No GIFs found. Try a different search.</div>';
            return;
        }
        gifs.forEach(gif => {
            const item = document.createElement('div');
            item.className = 'gif-item';
            const img = document.createElement('img');
            img.src = gif.preview;
            img.alt = gif.title;
            item.appendChild(img);
            item.addEventListener('click', () => {
                this.imageUrlInput.value = gif.url;
                this.hide();
            });
            this.resultsContainer.appendChild(item);
        });
    }
    show() {
        this.modal.classList.add('show');
        this.searchInput.value = '';
        this.resultsContainer.innerHTML = '';
        this.searchInput.focus();
    }
    hide() {
        this.modal.classList.remove('show');
    }
}
// Initialize the Giphy modal when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    new GiphyModal();
});
