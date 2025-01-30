export function sanitizeText(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return function executedFunction(...args: Parameters<T>) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

export function adjustPopupSize(img: HTMLImageElement) {
    const popup = img.closest('.leaflet-popup');
    if (popup) {
        const content = popup.querySelector('.leaflet-popup-content');
        if (content) {
            content.classList.add('has-image');
        }
    }
}

export function formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString();
}
