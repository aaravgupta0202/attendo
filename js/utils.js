// Utility Functions
const Utils = {
    // Generate unique ID
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Format date
    formatDate: (date = new Date()) => {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    // Get day name
    getDayName: (date = new Date()) => {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[date.getDay()];
    },

    // Get month name
    getMonthName: (monthIndex) => {
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
        return months[monthIndex];
    },

    // Get days in month
    getDaysInMonth: (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    },

    // Format date for display
    formatDisplayDate: (date = new Date()) => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Calculate percentage
    calculatePercentage: (attended, total) => {
        if (total === 0) return 0;
        return Math.round((attended / total) * 100);
    },

    // Get risk level
    getRiskLevel: (percentage, target = 75) => {
        if (percentage >= target + 10) return 'low';
        if (percentage >= target) return 'medium';
        return 'high';
    },

    // Get color based on percentage
    getProgressColor: (percentage, target = 75) => {
        if (percentage >= target + 10) return 'success';
        if (percentage >= target) return 'warning';
        return 'danger';
    },

    // Show toast notification
    showToast: (message, type = 'info', duration = 3000) => {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        toast.innerHTML = `
            <div class="toast-icon"><i class="${icons[type] || icons.info}"></i></div>
            <div class="toast-body"><p></p></div>
        `;
        // Message may embed a user-entered subject name — always textContent, never innerHTML.
        toast.querySelector('.toast-body p').textContent = message;

        container.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            toast.style.animation = 'slideUp 0.3s ease reverse';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, duration);

        return toast;
    },

    // Debounce function
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Calculate needed classes
    calculateNeeded: (attended, total, target) => {
        if (target <= 0) return 0;
        // At a 100% target, one missed class ever makes it mathematically
        // unreachable again — the (100-target) divisor below would be 0.
        if (target >= 100) return attended >= total ? 0 : Infinity;
        const needed = Math.ceil((target * total - 100 * attended) / (100 - target));
        return Math.max(0, needed);
    },

    // Calculate safe to miss
    calculateSafeToMiss: (attended, total, target) => {
        if (target <= 0) return 0;
        const safe = Math.floor((100 * attended / target) - total);
        return Math.max(0, safe);
    },

    // Validate subject name
    validateSubjectName: (name) => {
        if (!name || name.trim().length === 0) {
            return 'Subject name is required';
        }
        if (name.length > 50) {
            return 'Subject name must be less than 50 characters';
        }
        return null;
    },

    // Escape text before dropping it into innerHTML — subject names come
    // from user input (and imported JSON files), so they're never trusted.
    escapeHtml: (str) => {
        const div = document.createElement('div');
        div.textContent = str === undefined || str === null ? '' : String(str);
        return div.innerHTML;
    },

    // Only allow real hex colors through to style="background:..." strings
    // (subject.color can come from an imported JSON file, so it's untrusted).
    sanitizeColor: (color, fallback = '#4f46e5') => {
        return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : fallback;
    },

    // Get random color
    getRandomColor: () => {
        const colors = [
            '#1a237e', '#0d145a', '#534bae',
            '#10b981', '#059669', '#34d399',
            '#ef4444', '#dc2626', '#f87171',
            '#f59e0b', '#d97706', '#fbbf24'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    },

    // Copy to clipboard
    copyToClipboard: async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (err) {
            console.error('Copy failed:', err);
            return false;
        }
    },

    // Calculate storage usage
    calculateStorageUsage: () => {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length * 2;
            }
        }
        const percentage = (total / (5 * 1024 * 1024)) * 100; // 5MB limit
        return {
            used: total,
            percentage: Math.min(100, Math.round(percentage)),
            formatted: `${(total / 1024).toFixed(2)} KB / 5 MB`
        };
    }
};