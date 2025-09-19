const { ipcRenderer, shell } = require('electron');

document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyInput = document.getElementById('api-key');
    const toggleVisibilityBtn = document.getElementById('toggle-visibility');
    const saveBtn = document.getElementById('save-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const closeBtn = document.getElementById('close-btn');
    const openTodoistSettingsLink = document.getElementById('open-todoist-settings');

    // Apply theme
    const isDarkMode = await ipcRenderer.invoke('get-theme');
    if (!isDarkMode) {
        document.documentElement.classList.add('light-theme');
        document.body.classList.add('light-theme');
    }

    // Load current API key
    try {
        const currentApiKey = await ipcRenderer.invoke('get-api-key');
        if (currentApiKey) {
            apiKeyInput.value = currentApiKey;
        }
    } catch (error) {
        console.error('Failed to load API key:', error);
    }

    // Toggle password visibility
    toggleVisibilityBtn.addEventListener('click', () => {
        if (apiKeyInput.type === 'password') {
            apiKeyInput.type = 'text';
            toggleVisibilityBtn.textContent = '🙈';
        } else {
            apiKeyInput.type = 'password';
            toggleVisibilityBtn.textContent = '👁';
        }
    });

    // Save button
    saveBtn.addEventListener('click', async () => {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            alert('Please enter your Todoist API token');
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
            const result = await ipcRenderer.invoke('save-api-key', apiKey);
            if (result.success) {
                window.close();
            } else {
                alert('Failed to save API key: ' + (result.error || 'Unknown error'));
            }
        } catch (error) {
            alert('Failed to save API key: ' + error.message);
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save';
        }
    });

    // Cancel button
    cancelBtn.addEventListener('click', () => {
        window.close();
    });

    // Close button
    closeBtn.addEventListener('click', () => {
        window.close();
    });

    // Open Todoist settings link
    openTodoistSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        shell.openExternal('https://todoist.com/prefs/integrations');
    });

    // Save on Enter key
    apiKeyInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.close();
        }
    });

    // Focus the input field
    apiKeyInput.focus();
});