// ---------------------------------------------------------
// 🚀 SENIOR LEVEL ARCHITECTURE: SHEETS API + CACHING + UX
// ---------------------------------------------------------
const SHEET_ID = '1Owu15-BznNxJFmYWBMMBB38lwJ0ysTeJJ7VCL9C0Fjw';
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const CACHE_KEY = 'depi_matrix_data_v2';

let globalCourseData = [];
const treeContainer = document.getElementById('tree-container');
let activeTaskElement = null;
let activeFolderElements = [];

// --- UI Utilities ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    
    let colorVar = type === 'success' ? 'var(--neon-green)' : (type === 'error' ? 'var(--neon-red)' : 'var(--neon-cyan)');
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-triangle-exclamation' : 'fa-database');

    toast.className = `glass-panel px-4 py-3 rounded-lg border-l-4 flex items-center gap-3 text-sm font-code text-white shadow-[0_0_15px_rgba(0,0,0,0.3)] transform translate-x-[120%] opacity-0 transition-all duration-300 pointer-events-auto`;
    toast.style.borderLeftColor = colorVar;

    toast.innerHTML = `
        <i class="fa-solid ${icon} text-lg drop-shadow-[0_0_5px_${colorVar}]" style="color: ${colorVar}"></i>
        <span class="tracking-wide">${message}</span>
    `;

    container.appendChild(toast);

    requestAnimationFrame(() => {
        setTimeout(() => toast.classList.remove('translate-x-[120%]', 'opacity-0'), 10);
    });

    setTimeout(() => {
        toast.classList.add('translate-x-[120%]', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobile-overlay');
    
    if (sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.remove('-translate-x-full');
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.remove('opacity-0'), 10);
    } else {
        sidebar.classList.add('-translate-x-full');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function updateSyncStatus(text, color, isPulsing = false) {
    const textEl = document.getElementById('sync-status-text');
    const dotEl = document.getElementById('sync-status-dot');
    const container = document.getElementById('sync-status-container');
    
    if(textEl && dotEl) {
        textEl.innerText = text;
        textEl.style.color = color;
        dotEl.style.backgroundColor = color;
        dotEl.style.boxShadow = `0 0 8px ${color}`;
        container.style.borderColor = color === 'yellow' ? 'rgba(234, 179, 8, 0.3)' : 'rgba(31, 41, 55, 1)';
        
        if(isPulsing) dotEl.classList.add('animate-pulse');
        else dotEl.classList.remove('animate-pulse');
    }
}

function parseLinksInText(text) {
    const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return safeText.replace(urlRegex, function(url) {
        return `<a href="${url}" target="_blank" class="desc-link"><i class="fa-solid fa-arrow-up-right-from-square text-[10px] mr-1 opacity-70"></i>${url}</a>`;
    });
}

// --- Data Fetching & Caching Strategy ---
async function fetchSheetData(forceRefresh = false) {
    const refreshIcon = document.getElementById('refresh-icon');
    if(refreshIcon) refreshIcon.classList.add('fa-spin');

    if (!forceRefresh) {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                globalCourseData = JSON.parse(cached);
                renderTree();
                updateSyncStatus("Background Sync...", "yellow", true);
            } catch(e) {
                console.warn("Cache invalid, fetching fresh.");
            }
        }
    }

    try {
        if(forceRefresh || !globalCourseData.length) updateSyncStatus("Downloading Matrix...", "yellow", true);
        
        const response = await fetch(SHEET_URL);
        const text = await response.text();
        
        const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S\w]+)\)/);
        if (!jsonMatch) throw new Error("Invalid response format");
        
        const jsonData = JSON.parse(jsonMatch[1]);
        const newData = processSheetData(jsonData.table.rows);
        
        if (JSON.stringify(newData) !== JSON.stringify(globalCourseData) || forceRefresh) {
            globalCourseData = newData;
            localStorage.setItem(CACHE_KEY, JSON.stringify(globalCourseData));
            renderTree();
            
            if(!forceRefresh && localStorage.getItem(CACHE_KEY)) {
                showToast("Matrix synchronized with latest intelligence", "info");
            } else if (forceRefresh) {
                showToast("Matrix Manually Updated", "success");
            }
        }
        
        updateSyncStatus("Live & Synced", "var(--neon-green)");
        if(refreshIcon) setTimeout(() => refreshIcon.classList.remove('fa-spin'), 500);

    } catch (error) {
        console.error("Matrix Connection Failed:", error);
        updateSyncStatus("Offline - Using Cache", "var(--neon-red)");
        if(forceRefresh) showToast("Connection failed. Check network.", "error");
        
        if(!globalCourseData.length) {
            treeContainer.innerHTML = `<div class="text-red-500/80 bg-red-500/10 p-4 rounded border border-red-500/20 text-center mt-4 font-code text-xs"><i class="fa-solid fa-triangle-exclamation mb-2 text-xl"></i><br>Failed to connect to Data Matrix.<br>Check internet or Google Sheet permissions.</div>`;
        }
        if(refreshIcon) refreshIcon.classList.remove('fa-spin');
    }
}

// --- Data Processing Engine ---
function processSheetData(rows) {
    const tracksMap = new Map();
    let startIndex = (rows.length > 0 && rows[0].c[0] && rows[0].c[0].v === "Track Name") ? 1 : 0;

    let currentTrack = 'Uncategorized';
    let currentLink = '#';
    let currentWeek = 'General';

    for (let i = startIndex; i < rows.length; i++) {
        const row = rows[i];
        if (!row || !row.c) continue;

        if (row.c[0] && row.c[0].v && row.c[0].v.toString().trim() !== "") {
            currentTrack = row.c[0].v.toString().trim();
        }
        if (row.c[1] && row.c[1].v && row.c[1].v.toString().trim() !== "") {
            currentLink = row.c[1].v.toString().trim().replace(/[<>]/g, '');
        }
        if (row.c[2] && row.c[2].v && row.c[2].v.toString().trim() !== "") {
            currentWeek = row.c[2].v.toString().trim();
        }

        const taskTitle = (row.c[3] && row.c[3].v) ? row.c[3].v.toString().trim() : 'Untitled Task';
        const taskDesc = (row.c[4] && row.c[4].v) ? row.c[4].v.toString().trim() : 'No description provided.';
        
        let taskRecLink = (row.c[5] && row.c[5].v) ? row.c[5].v.toString().trim().replace(/[<>]/g, '') : '';
        if(taskRecLink === '----' || taskRecLink === '-') taskRecLink = '';

        let taskDay = (row.c[6] && row.c[6].v) ? row.c[6].v.toString().trim().toUpperCase() : '';

        if (!tracksMap.has(currentTrack)) {
            tracksMap.set(currentTrack, { name: currentTrack, driveLink: currentLink, weeksMap: new Map() });
        }
        const track = tracksMap.get(currentTrack);
        
        if (track.driveLink === '#' && currentLink !== '#') track.driveLink = currentLink;

        if (!track.weeksMap.has(currentWeek)) {
            track.weeksMap.set(currentWeek, { name: currentWeek, tasks: [] });
        }
        const week = track.weeksMap.get(currentWeek);

        week.tasks.push({
            title: taskTitle,
            description: taskDesc,
            recordingLink: taskRecLink,
            day: taskDay
        });
    }

    return Array.from(tracksMap.values()).map(track => ({
        name: track.name,
        driveLink: track.driveLink,
        weeks: Array.from(track.weeksMap.values()).reverse().map(w => ({
            name: w.name,
            tasks: w.tasks.reverse() 
        }))
    })).reverse(); 
}

// --- View Engine (Rendering) ---
function renderTree() {
    if (globalCourseData.length === 0) return; 
    
    treeContainer.innerHTML = '';
    const ul = document.createElement('ul');

    globalCourseData.forEach(track => {
        const trackLi = document.createElement('li');
        trackLi.className = 'my-2 tree-item relative';

        const folderDiv = document.createElement('div');
        folderDiv.className = 'folder-toggle font-bold text-white flex items-center justify-between mb-2 p-1.5 rounded-lg border border-transparent';
        
        folderDiv.innerHTML = `
            <div class="flex items-center gap-2">
                <i class="fa-solid fa-chevron-right text-[10px] w-3 transition-transform text-[var(--neon-purple)]"></i>
                <i class="fa-solid fa-layer-group text-[var(--neon-cyan)] drop-shadow-[0_0_5px_var(--neon-cyan)]"></i> 
                <span class="tracking-wide">${track.name}</span>
            </div>
        `;

        const weeksUl = document.createElement('ul');
        weeksUl.className = 'folder-content';

        if (track.weeks && track.weeks.length > 0) {
            track.weeks.forEach(week => {
                const weekLi = document.createElement('li');
                weekLi.className = 'my-1 tree-item relative';

                const weekDiv = document.createElement('div');
                weekDiv.className = 'folder-toggle text-gray-300 flex items-center p-1.5 rounded-md border border-transparent';
                
                weekDiv.innerHTML = `
                    <i class="fa-solid fa-chevron-right text-[10px] w-3 transition-transform text-gray-500 mr-2"></i>
                    <i class="fa-regular fa-folder text-[var(--neon-purple)] mr-2"></i> 
                    <span class="text-sm font-code">${week.name}</span>
                `;

                const tasksUl = document.createElement('ul');
                tasksUl.className = 'folder-content mt-1 mb-2';

                if (week.tasks && week.tasks.length > 0) {
                    week.tasks.forEach(task => {
                        const taskLi = document.createElement('li');
                        const taskDiv = document.createElement('div');
                        taskDiv.className = 'task-item text-gray-400 mt-1 font-code text-[11px] group relative overflow-hidden bg-black/20 border-gray-800/50';
                        
                        let badgeHtml = '';
                        if(task.day) {
                            let badgeClass = 'badge-default';
                            if(task.day.includes('SAT')) badgeClass = 'badge-sat';
                            else if(task.day.includes('TUE')) badgeClass = 'badge-tue';
                            else if(task.day.includes('WED')) badgeClass = 'badge-wed';
                            else if(task.day.includes('FRI')) badgeClass = 'badge-fri';
                            
                            badgeHtml = `<span class="ml-auto text-[8px] font-bold px-1.5 py-0.5 rounded ${badgeClass}">${task.day}</span>`;
                        }

                        taskDiv.innerHTML = `
                            <div class="absolute inset-0 w-1 bg-[var(--neon-cyan)] transform -translate-x-full group-hover:translate-x-0 transition-transform duration-300 ease-out"></div>
                            <i class="fa-solid fa-code text-[10px] opacity-50 group-hover:opacity-100 transition-opacity"></i> 
                            <span class="truncate flex-1" title="${task.title}">${task.title}</span>
                            ${badgeHtml}
                        `;
                        
                        taskDiv.onclick = (e) => {
                            e.stopPropagation();
                            selectTask(taskDiv, track, week, task, folderDiv, weekDiv);
                        };

                        taskLi.appendChild(taskDiv);
                        tasksUl.appendChild(taskLi);
                    });
                }

                weekDiv.onclick = (e) => {
                    e.stopPropagation();
                    tasksUl.classList.toggle('open');
                    const iconArrow = weekDiv.querySelector('.fa-chevron-right');
                    const iconFolder = weekDiv.querySelector('.fa-folder, .fa-folder-open');
                    if (tasksUl.classList.contains('open')) {
                        iconArrow.style.transform = 'rotate(90deg)';
                        iconFolder.className = 'fa-regular fa-folder-open text-[var(--neon-purple)] drop-shadow-[0_0_5px_var(--neon-purple)]';
                    } else {
                        iconArrow.style.transform = 'rotate(0deg)';
                        iconFolder.className = 'fa-regular fa-folder text-[var(--neon-purple)]';
                    }
                };

                weekLi.appendChild(weekDiv);
                weekLi.appendChild(tasksUl);
                weeksUl.appendChild(weekLi);
            });
        }

        folderDiv.onclick = (e) => {
            e.stopPropagation();
            weeksUl.classList.toggle('open');
            const iconArrow = folderDiv.querySelector('.fa-chevron-right');
            iconArrow.style.transform = weeksUl.classList.contains('open') ? 'rotate(90deg)' : 'rotate(0deg)';
        };

        trackLi.appendChild(folderDiv);
        trackLi.appendChild(weeksUl);
        ul.appendChild(trackLi);
    });
    
    treeContainer.appendChild(ul);
}

// --- Navigation Logic ---
function hideAllScreens() {
    document.getElementById('welcome-screen').classList.add('hidden');
    document.getElementById('task-details').classList.add('hidden');
    document.getElementById('about-screen').classList.add('hidden');
}

function clearSidebarSelection() {
    if (activeTaskElement) {
        activeTaskElement.classList.remove('active');
        activeTaskElement = null;
    }
    if (activeFolderElements.length > 0) {
        activeFolderElements.forEach(folder => folder.classList.remove('folder-active'));
        activeFolderElements = [];
    }
}

function showAboutScreen() {
    if (window.innerWidth < 768) toggleSidebar();
    clearSidebarSelection();
    hideAllScreens();
    
    const aboutScreen = document.getElementById('about-screen');
    aboutScreen.classList.remove('hidden');
    aboutScreen.classList.remove('fade-in');
    void aboutScreen.offsetWidth; 
    aboutScreen.classList.add('fade-in');
    document.getElementById('main-content').scrollTop = 0;
}

function returnToHome() {
    hideAllScreens();
    clearSidebarSelection();
    
    const welcomeScreen = document.getElementById('welcome-screen');
    welcomeScreen.classList.remove('hidden');
    welcomeScreen.classList.remove('fade-in');
    void welcomeScreen.offsetWidth; 
    welcomeScreen.classList.add('fade-in');
    document.getElementById('main-content').scrollTop = 0;

    if (window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar.classList.contains('-translate-x-full')) toggleSidebar();
    }
}

// --- Task Detail View Logic ---
function selectTask(element, trackData, weekData, taskData, trackFolderElement, weekFolderElement) {
    if (window.innerWidth < 768) toggleSidebar();

    clearSidebarSelection();

    element.classList.add('active');
    activeTaskElement = element;

    if (trackFolderElement) {
        trackFolderElement.classList.add('folder-active');
        activeFolderElements.push(trackFolderElement);
    }
    if (weekFolderElement) {
        weekFolderElement.classList.add('folder-active');
        activeFolderElements.push(weekFolderElement);
    }

    hideAllScreens();
    const detailsPanel = document.getElementById('task-details');
    detailsPanel.classList.remove('hidden');
    
    detailsPanel.classList.remove('fade-in');
    void detailsPanel.offsetWidth; 
    detailsPanel.classList.add('fade-in');
    document.getElementById('main-content').scrollTop = 0;

    document.getElementById('task-breadcrumb').innerHTML = `
        ${trackData.name} 
        <i class="fa-solid fa-angle-right text-gray-600"></i> 
        ${weekData.name} 
        <i class="fa-solid fa-angle-right text-gray-600"></i> 
        <span class="text-white">${taskData.title}</span>`;
    
    document.getElementById('task-title').innerText = taskData.title;
    document.getElementById('task-week').innerText = weekData.name;
    document.getElementById('task-track').innerText = trackData.name;

    const badgeEl = document.getElementById('task-day-badge-large');
    if(taskData.day) {
        let badgeClass = 'badge-default';
        let iconClass = 'fa-calendar-day';
        if(taskData.day.includes('SAT')) { badgeClass = 'badge-sat'; iconClass = 'fa-calendar-check'; }
        else if(taskData.day.includes('TUE')) { badgeClass = 'badge-tue'; iconClass = 'fa-clock'; }
        else if(taskData.day.includes('WED')) { badgeClass = 'badge-wed'; iconClass = 'fa-fire'; }
        else if(taskData.day.includes('FRI')) { badgeClass = 'badge-fri'; iconClass = 'fa-bolt'; }
        
        badgeEl.className = `text-xs font-code font-bold px-3 py-1 rounded border flex items-center gap-2 ${badgeClass}`;
        badgeEl.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${taskData.day} Session`;
        badgeEl.classList.remove('hidden');
    } else {
        badgeEl.classList.add('hidden');
    }

    const rawDesc = taskData.description || "No specific instructions provided for this task. Please refer to the session materials.";
    document.getElementById('task-description-content').innerHTML = parseLinksInText(rawDesc);

    let finalLink = trackData.driveLink ? trackData.driveLink.replace(/[<>]/g, '').trim() : '#';
    if (finalLink !== '#' && !finalLink.startsWith('http')) finalLink = 'https://' + finalLink;

    let actionsHTML = '';

    if (finalLink && finalLink !== '#' && finalLink.includes('http')) {
        actionsHTML += `
            <a href="${finalLink}" target="_blank" class="flex-1 justify-center relative overflow-hidden group bg-[#11141d] border border-[var(--neon-cyan)] text-[var(--neon-cyan)] font-bold py-3 px-6 rounded-md transition-all shadow-[0_4px_15px_rgba(0,240,255,0.1)] hover-breathe-cyan flex items-center gap-3">
                <div class="absolute inset-0 w-0 bg-[var(--neon-cyan)] transition-all duration-300 ease-out group-hover:w-full z-0 opacity-20"></div>
                <i class="fa-brands fa-google-drive text-xl relative z-10 group-hover:text-white transition-colors"></i> 
                <span class="relative z-10 uppercase tracking-widest text-sm text-center group-hover:text-white transition-colors">Materials</span>
            </a>
        `;
    } else {
        actionsHTML += `
            <div class="flex-1 justify-center relative overflow-hidden bg-black/40 border border-gray-800 text-gray-600 font-bold py-3 px-6 rounded-md flex items-center gap-3 cursor-not-allowed">
                <i class="fa-brands fa-google-drive text-xl opacity-50"></i> 
                <span class="uppercase tracking-widest text-sm text-center">No Link</span>
            </div>
        `;
    }

    const submitLink = "https://harvesttrainingcenter459.sharepoint.com/:f:/r/sites/Assignments/Shared%20Documents/SWD/%2315.%20ALX4_SWD8_S1?csf=1&web=1&e=zEOC4J";
    actionsHTML += `
        <a href="${submitLink}" target="_blank" class="flex-1 justify-center relative overflow-hidden group bg-[rgba(176,38,255,0.05)] border border-[var(--neon-purple)] text-[var(--neon-purple)] font-bold py-3 px-6 rounded-md transition-all shadow-[0_4px_15px_rgba(176,38,255,0.1)] hover-breathe-purple flex items-center gap-3">
            <div class="absolute inset-0 w-0 bg-[var(--neon-purple)] transition-all duration-300 ease-out group-hover:w-full z-0 opacity-20"></div>
            <i class="fa-solid fa-cloud-arrow-up text-xl relative z-10 drop-shadow-[0_0_5px_rgba(176,38,255,0.5)] group-hover:text-white transition-colors"></i> 
            <span class="relative z-10 uppercase tracking-widest text-sm text-center group-hover:text-white transition-colors">Submit Task</span>
        </a>
    `;

    let recLink = taskData.recordingLink;
    if (recLink && recLink !== '#' && recLink.includes('http')) {
        actionsHTML += `
            <a href="${recLink}" target="_blank" class="flex-1 justify-center relative overflow-hidden group bg-[#11141d] border border-[var(--neon-red)] text-[var(--neon-red)] font-bold py-3 px-6 rounded-md transition-all shadow-[0_4px_15px_rgba(255,42,42,0.1)] hover-breathe-red flex items-center gap-3">
                <div class="absolute inset-0 w-0 bg-[var(--neon-red)] transition-all duration-300 ease-out group-hover:w-full z-0 opacity-20"></div>
                <i class="fa-solid fa-circle-play text-xl relative z-10 drop-shadow-[0_0_5px_rgba(255,42,42,0.5)] group-hover:text-white transition-colors"></i> 
                <span class="relative z-10 uppercase tracking-widest text-sm text-center group-hover:text-white transition-colors">Watch Session</span>
            </a>
        `;
    } else {
        actionsHTML += `
            <div class="flex-1 justify-center relative overflow-hidden bg-black/40 border border-gray-800 text-gray-600 font-bold py-3 px-6 rounded-md flex items-center gap-3 cursor-not-allowed" title="Recording not yet uploaded">
                <i class="fa-solid fa-video-slash text-xl opacity-50"></i> 
                <span class="uppercase tracking-widest text-sm text-center">No Video</span>
            </div>
        `;
    }

    document.getElementById('task-actions').innerHTML = actionsHTML;
}

function calculateCurrentWeek() {
    const baseDate = new Date('2026-03-06T00:00:00+02:00');
    const now = new Date();
    const diffMs = now - baseDate;
    const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    let currentWeek = 11 + diffWeeks;
    if (currentWeek < 1) currentWeek = 1;
    
    const weekDisplay = document.getElementById('current-week-display');
    if(weekDisplay) weekDisplay.innerText = currentWeek;
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    fetchSheetData();
    calculateCurrentWeek();
});
