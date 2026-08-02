// How each status contributes to a subject's attended/total counters.
// null (no entry yet) contributes nothing, same as 'cancelled'.
const STATUS_CONTRIB = {
    attended:  { attended: 1, total: 1 },
    missed:    { attended: 0, total: 1 },
    cancelled: { attended: 0, total: 0 }
};

function statusContrib(status) {
    return STATUS_CONTRIB[status] || { attended: 0, total: 0 };
}

// Moves a subject's counters from oldStatus's contribution to newStatus's.
function applyStatusDelta(subject, oldStatus, newStatus) {
    const oldC = statusContrib(oldStatus);
    const newC = statusContrib(newStatus);
    subject.attended = Math.max(0, subject.attended + (newC.attended - oldC.attended));
    subject.total    = Math.max(0, subject.total    + (newC.total    - oldC.total));
}

// LocalStorage Management
const Storage = {
    // Keys
    KEYS: {
        SUBJECTS: 'attendo_subjects',
        TIMETABLE: 'attendo_timetable',
        HISTORY: 'attendo_history',
        SETTINGS: 'attendo_settings'
    },

    // Initialize
    init: () => {
        if (!Storage.isAvailable()) {
            console.error('LocalStorage not available');
            return false;
        }
        Storage.ensureDataStructure();
        return true;
    },

    // Check availability
    isAvailable: () => {
        try {
            const test = '__test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    },

    // Ensure data structure exists
    ensureDataStructure: () => {
        if (!localStorage.getItem(Storage.KEYS.SUBJECTS)) {
            localStorage.setItem(Storage.KEYS.SUBJECTS, JSON.stringify([]));
        }
        if (!localStorage.getItem(Storage.KEYS.TIMETABLE)) {
            const emptyTimetable = {
                sunday: [], monday: [], tuesday: [], wednesday: [],
                thursday: [], friday: [], saturday: []
            };
            localStorage.setItem(Storage.KEYS.TIMETABLE, JSON.stringify(emptyTimetable));
        }
        if (!localStorage.getItem(Storage.KEYS.HISTORY)) {
            localStorage.setItem(Storage.KEYS.HISTORY, JSON.stringify([]));
        }
        if (!localStorage.getItem(Storage.KEYS.SETTINGS)) {
            localStorage.setItem(Storage.KEYS.SETTINGS, JSON.stringify({
                version: '1.0.0',
                defaultTarget: 75,
                theme: 'light',
                firstRun: true
            }));
        }
    },

    // Subjects
    getSubjects: () => {
        try {
            const subjects = JSON.parse(localStorage.getItem(Storage.KEYS.SUBJECTS) || '[]');
            return subjects.map(subject => ({
                id: subject.id || Utils.generateId(),
                name: subject.name || 'Unnamed',
                attended: subject.attended || 0,
                total: subject.total || 0,
                target: subject.target || 75,
                color: subject.color || Utils.getRandomColor(),
                createdAt: subject.createdAt || new Date().toISOString()
            }));
        } catch (e) {
            console.error('Error getting subjects:', e);
            return [];
        }
    },

    saveSubjects: (subjects) => {
        try {
            localStorage.setItem(Storage.KEYS.SUBJECTS, JSON.stringify(subjects));
            return true;
        } catch (e) {
            console.error('Error saving subjects:', e);
            return false;
        }
    },

    addSubject: (subjectData) => {
        const subjects = Storage.getSubjects();
        const newSubject = {
            id: Utils.generateId(),
            name: subjectData.name.trim(),
            attended: 0,
            total: 0,
            target: parseInt(subjectData.target) || 75,
            color: subjectData.color || Utils.getRandomColor(),
            createdAt: new Date().toISOString()
        };
        subjects.push(newSubject);
        return Storage.saveSubjects(subjects);
    },

    updateSubject: (id, updates) => {
        const subjects = Storage.getSubjects();
        const index = subjects.findIndex(s => s.id === id);
        if (index !== -1) {
            subjects[index] = { ...subjects[index], ...updates };
            return Storage.saveSubjects(subjects);
        }
        return false;
    },

    deleteSubject: (id) => {
        const subjects = Storage.getSubjects();
        const filtered = subjects.filter(s => s.id !== id);
        return Storage.saveSubjects(filtered);
    },

    // Timetable
    getTimetable: () => {
        try {
            return JSON.parse(localStorage.getItem(Storage.KEYS.TIMETABLE) || '{}');
        } catch (e) {
            console.error('Error getting timetable:', e);
            return {};
        }
    },

    saveTimetable: (timetable) => {
        try {
            localStorage.setItem(Storage.KEYS.TIMETABLE, JSON.stringify(timetable));
            return true;
        } catch (e) {
            console.error('Error saving timetable:', e);
            return false;
        }
    },

    getSubjectsForDay: (dayName) => {
        const timetable = Storage.getTimetable();
        const dayKey = dayName.toLowerCase();
        return timetable[dayKey] || [];
    },

    // History
    getHistory: () => {
        try {
            return JSON.parse(localStorage.getItem(Storage.KEYS.HISTORY) || '[]');
        } catch (e) {
            console.error('Error getting history:', e);
            return [];
        }
    },

    saveHistory: (history) => {
        try {
            localStorage.setItem(Storage.KEYS.HISTORY, JSON.stringify(history));
            return true;
        } catch (e) {
            console.error('Error saving history:', e);
            return false;
        }
    },

    getHistoryForDate: (date) => {
        const history = Storage.getHistory();
        return history.find(entry => entry.date === date) || { date, entries: [] };
    },

    // Returns { success, changed, prevStatus } — prevStatus is null when this
    // subject had no entry yet for this date. Callers use prevStatus to build
    // an accurate undo record (see revertAttendance).
    markAttendance: (date, subjectId, status) => {
        const history = Storage.getHistory();
        let dateEntry = history.find(entry => entry.date === date);

        if (!dateEntry) {
            dateEntry = { date, entries: [] };
            history.push(dateEntry);
        }

        const existingEntry = dateEntry.entries.find(entry => entry.subjectId === subjectId);
        const subjects = Storage.getSubjects();
        const subjectIndex = subjects.findIndex(s => s.id === subjectId);

        if (subjectIndex === -1) {
            console.error('Subject not found:', subjectId);
            return { success: false };
        }

        const subject = subjects[subjectIndex];
        const prevStatus = existingEntry ? existingEntry.status : null;

        if (existingEntry && existingEntry.status === status) {
            return { success: true, changed: false, prevStatus };
        }

        applyStatusDelta(subject, prevStatus, status);

        if (existingEntry) {
            existingEntry.status = status;
            existingEntry.timestamp = new Date().toISOString();
        } else {
            dateEntry.entries.push({
                subjectId,
                status,
                timestamp: new Date().toISOString()
            });
        }

        subjects[subjectIndex] = subject;
        Storage.saveSubjects(subjects);
        Storage.saveHistory(history);

        return { success: true, changed: true, prevStatus };
    },

    // Reverts one specific subject/date entry back to prevStatus (or removes
    // it entirely if prevStatus is null, i.e. it didn't exist before).
    // Driven by the caller's own action record rather than guessing which
    // history entry was "last", so re-marks (tap to cancel after a swipe,
    // etc.) always undo the right thing.
    revertAttendance: (date, subjectId, prevStatus) => {
        const history = Storage.getHistory();
        const dateIndex = history.findIndex(entry => entry.date === date);
        if (dateIndex === -1) return false;

        const dateEntry = history[dateIndex];
        const entryIndex = dateEntry.entries.findIndex(e => e.subjectId === subjectId);
        if (entryIndex === -1) return false;

        const entry = dateEntry.entries[entryIndex];
        const subjects = Storage.getSubjects();
        const subjectIndex = subjects.findIndex(s => s.id === subjectId);

        if (subjectIndex !== -1) {
            const subject = subjects[subjectIndex];
            applyStatusDelta(subject, entry.status, prevStatus);
            subjects[subjectIndex] = subject;
            Storage.saveSubjects(subjects);
        }

        if (prevStatus === null) {
            dateEntry.entries.splice(entryIndex, 1);
            if (dateEntry.entries.length === 0) {
                history.splice(dateIndex, 1);
            }
        } else {
            entry.status = prevStatus;
            entry.timestamp = new Date().toISOString();
        }

        Storage.saveHistory(history);
        return true;
    },

    // Export/Import
    exportData: () => {
        const data = {
            version: '1.0.0',
            exportedAt: new Date().toISOString(),
            subjects: Storage.getSubjects(),
            timetable: Storage.getTimetable(),
            history: Storage.getHistory(),
            settings: JSON.parse(localStorage.getItem(Storage.KEYS.SETTINGS) || '{}')
        };
        return JSON.stringify(data, null, 2);
    },

    importData: (jsonString) => {
        try {
            const data = JSON.parse(jsonString);
            
            if (!data.version || !data.subjects || !data.timetable) {
                throw new Error('Invalid data format');
            }

            // Backup current data
            const backup = Storage.exportData();
            
            // Import new data
            Storage.saveSubjects(data.subjects);
            Storage.saveTimetable(data.timetable);
            Storage.saveHistory(data.history || []);
            
            if (data.settings) {
                localStorage.setItem(Storage.KEYS.SETTINGS, JSON.stringify(data.settings));
            }

            return { success: true, backup };
        } catch (e) {
            console.error('Import failed:', e);
            return { success: false, error: e.message };
        }
    },

    // Clear all data
    clearAllData: () => {
        try {
            const backup = Storage.exportData();
            localStorage.removeItem(Storage.KEYS.SUBJECTS);
            localStorage.removeItem(Storage.KEYS.TIMETABLE);
            localStorage.removeItem(Storage.KEYS.HISTORY);
            localStorage.removeItem(Storage.KEYS.SETTINGS);
            Storage.ensureDataStructure();
            return { success: true, backup };
        } catch (e) {
            console.error('Clear failed:', e);
            return { success: false, error: e.message };
        }
    }
};

// Initialize storage
Storage.init();