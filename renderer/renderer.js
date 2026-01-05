const { ipcRenderer } = require('electron');

let elements = {};
let todosState = new Map(); // Map<id, todo>
let lastSyncTimestamp = 0;

function initializeElements() {
    elements = {
        loading: document.getElementById('loading'),
        error: document.getElementById('error'),
        todosList: document.getElementById('todos-list'),
        newTodoInput: document.getElementById('new-todo-input'),
        closeAddBtn: document.getElementById('close-add-btn'),
        addToggleBtn: document.getElementById('add-toggle-btn'),
        addTodoSection: document.getElementById('add-todo-section')
    };
}

let isLoading = false;

function showLoading() {
    isLoading = true;
    elements.loading.style.display = 'block';
    elements.error.style.display = 'none';
    elements.todosList.innerHTML = '';
}

function hideLoading() {
    isLoading = false;
    elements.loading.style.display = 'none';
}

function showError(message) {
    hideLoading();
    elements.error.textContent = message;
    elements.error.style.display = 'block';
    elements.todosList.innerHTML = '';
}

// Removed - using renderTodosFromState with optimistic updates instead

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// State management functions
function updateTodoState(todos, isInitialLoad = false) {
    let hasChanges = false;

    if (isInitialLoad) {
        // Clear existing state on initial load
        todosState.clear();
        hasChanges = true;
    }


    // Process incoming todos
    todos.forEach(todo => {
        const normalizedTodo = {
            id: todo.id,
            content: todo.content,
            is_completed: todo.is_completed || false,
            created_at: todo.created_at,
            type: todo.type,
            project_name: todo.project_name,
            syncing: false // Don't override syncing state for existing items
        };

        const existingTodo = todosState.get(todo.id);

        if (!existingTodo) {
            // New todo
            todosState.set(todo.id, normalizedTodo);
            hasChanges = true;
        } else if (!existingTodo.syncing) {
            // Only update if not currently syncing and there are actual changes
            if (existingTodo.content !== normalizedTodo.content ||
                existingTodo.is_completed !== normalizedTodo.is_completed) {
                // Preserve syncing state but update other fields
                todosState.set(todo.id, {
                    ...normalizedTodo,
                    syncing: existingTodo.syncing
                });
                hasChanges = true;
            }
        }
        // If item is syncing, don't update it (optimistic update in progress)
    });

    // Remove todos that no longer exist on server (except if they're syncing)
    for (const [id, todo] of todosState.entries()) {
        if (!todo.syncing && !todos.find(t => t.id === id)) {
            todosState.delete(id);
            hasChanges = true;
        }
    }

    lastSyncTimestamp = Date.now();

    // Only re-render if there were actual changes
    if (hasChanges) {
        renderTodosFromState();
    }
}

function silentSyncFromServer() {
    // Silent background sync without loading indicators
    ipcRenderer.invoke('get-todos').then(result => {
        if (!result.error) {
            updateTodoState(result, false); // Not initial load
        }
    }).catch(error => {
        // Silent fail - don't show errors for background sync
        console.log('Background sync failed:', error);
    });
}

function toggleTodoLocal(todoId) {
    const todo = todosState.get(todoId);
    if (todo) {
        // Optimistic update
        todo.is_completed = !todo.is_completed;
        todo.syncing = true;
        renderTodosFromState();

        // Background sync
        syncTodoWithServer(todoId, todo.is_completed);
    }
}

async function syncTodoWithServer(todoId, isCompleted) {
    try {
        const result = isCompleted
            ? await ipcRenderer.invoke('complete-todo', todoId)
            : await ipcRenderer.invoke('reopen-todo', todoId);

        const todo = todosState.get(todoId);
        if (todo) {
            todo.syncing = false;

            if (result.error) {
                // Revert optimistic update on error
                todo.is_completed = !todo.is_completed;
                showError(result.error);
            }

            renderTodosFromState();
        }
    } catch (error) {
        // Revert optimistic update on error
        const todo = todosState.get(todoId);
        if (todo) {
            todo.is_completed = !todo.is_completed;
            todo.syncing = false;
            renderTodosFromState();
        }
        showError('Failed to sync todo: ' + error.message);
    }
}

function renderTodosFromState() {
    hideLoading();
    elements.error.style.display = 'none';

    const todos = Array.from(todosState.values());

    if (todos.length === 0) {
        elements.todosList.innerHTML = '<div class="no-todos">No todos found</div>';
        ipcRenderer.invoke('resize-window', { count: 0, todos: [] });
        return;
    }

    // Sort: active items first (by date desc), then completed items (by date desc)
    const sortedTodos = todos.sort((a, b) => {
        // First, sort by completion status (active items first)
        if (a.is_completed !== b.is_completed) {
            return a.is_completed ? 1 : -1;
        }
        // Then sort by date (newest first within each group)
        return new Date(b.created_at) - new Date(a.created_at);
    });

    elements.todosList.innerHTML = sortedTodos.map(todo => {
        const syncingClass = todo.syncing ? ' syncing' : '';
        const projectPrefix = (todo.project_name && todo.project_name !== 'Inbox') ? `<span class="project-name">#${escapeHtml(todo.project_name)}</span>` : '';
        return `
            <li class="todo-item ${todo.is_completed ? 'completed' : ''}${syncingClass}" data-id="${todo.id}">
                <button class="todo-checkbox" data-id="${todo.id}" ${todo.syncing ? 'disabled' : ''}>✓</button>
                <div class="todo-content">${projectPrefix}${escapeHtml(todo.content)}</div>
            </li>
        `;
    }).join('');

    // Resize window based on todos content
    const todosData = todos.map(todo => {
        const projectPrefix = (todo.project_name && todo.project_name !== 'Inbox') ? `#${todo.project_name} ` : '';
        const fullContent = projectPrefix + todo.content;
        return {
            content: fullContent,
            length: fullContent.length
        };
    });
    ipcRenderer.invoke('resize-window', { count: todos.length, todos: todosData });
}

async function loadTodos(silent = false) {
    if (isLoading && !silent) return;

    if (!silent) {
        showLoading();
    }

    try {
        const result = await ipcRenderer.invoke('get-todos');

        if (result.error) {
            if (!silent) {
                showError(result.error);
            }
        } else {
            updateTodoState(result, !silent); // Initial load if not silent
        }
    } catch (error) {
        if (!silent) {
            showError('Failed to load todos: ' + error.message);
        }
    }
}

function toggleAddTodo() {
    const isVisible = elements.addTodoSection.classList.contains('show');

    if (isVisible) {
        elements.addTodoSection.classList.remove('show');
        elements.addToggleBtn.textContent = '+';
    } else {
        elements.addTodoSection.classList.add('show');
        elements.addToggleBtn.textContent = '×';
        setTimeout(() => {
            if (elements.newTodoInput) {
                elements.newTodoInput.focus();
            }
        }, 300);
    }
}

async function addTodo() {
    const content = elements.newTodoInput.value.trim();
    if (!content) return;

    // Disable input while adding
    elements.newTodoInput.disabled = true;

    try {
        const result = await ipcRenderer.invoke('add-todo', content);

        if (result.error) {
            showError(result.error);
        } else {
            elements.newTodoInput.value = '';
            toggleAddTodo();
            // Silent refresh to get the new item with proper ID
            silentSyncFromServer();
        }
    } catch (error) {
        showError('Failed to add todo: ' + error.message);
    } finally {
        elements.newTodoInput.disabled = false;
    }
}

// Removed - using optimistic updates via toggleTodoLocal instead


async function applyTheme() {
    try {
        const isDark = await ipcRenderer.invoke('get-theme');
        document.body.classList.toggle('light-theme', !isDark);
        document.documentElement.classList.toggle('light-theme', !isDark);
    } catch (error) {
        // Theme detection failed, continue with default dark theme
    }
}

// Event listeners are now set up in setupEventListeners() function

function setupEventListeners() {
    if (elements.addToggleBtn) {
        elements.addToggleBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleAddTodo();
        });
    }

    if (elements.closeAddBtn) {
        elements.closeAddBtn.addEventListener('click', toggleAddTodo);
    }

    if (elements.newTodoInput) {
        elements.newTodoInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addTodo();
            }
            if (e.key === 'Escape') {
                toggleAddTodo();
            }
        });
    }

    if (elements.todosList) {
        elements.todosList.addEventListener('click', (e) => {
            if (e.target.classList.contains('todo-checkbox') && !e.target.disabled) {
                const todoId = e.target.dataset.id;
                toggleTodoLocal(todoId);
            }
        });
    }

    // Set up IPC listener for refresh (silent background sync)
    ipcRenderer.on('refresh-todos', () => {
        // Do a full reload to clear any error states
        loadTodos(false);
    });

    // Set up periodic refresh (every 30 seconds)
    // Load todos immediately, then silent sync every 30 seconds
    loadTodos(); // Initial load with loading screen
    setInterval(() => {
        silentSyncFromServer(); // Silent background sync
    }, 30000);
}

async function init() {
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            initializeElements();
            setupEventListeners();
        });
    } else {
        initializeElements();
        setupEventListeners();
    }

    await applyTheme();
    // Don't load todos on app open - only use timed updates
}

init();