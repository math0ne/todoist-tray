const { app, BrowserWindow, Tray, Menu, screen, ipcMain, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

let tray = null;
let window = null;
let settingsWindow = null;
let config = null;
let windowVisible = false;

function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load config.json:', error.message);
    config = null;
  }
}

function createWindow() {
  window = new BrowserWindow({
    width: 300,
    height: 120,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Initialize windowVisible to false since show: false
  windowVisible = false;

  window.loadFile('renderer/index.html');

  window.on('blur', () => {
    // Add a small delay to prevent immediate hiding when tray is clicked
    setTimeout(() => {
      if (windowVisible && window && !window.isFocused()) {
        window.hide();
        windowVisible = false;
      }
    }, 100);
  });

  window.on('show', () => {
    windowVisible = true;
  });

  window.on('hide', () => {
    windowVisible = false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(iconPath);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Todoist',
      click: () => {
        showWindow();
      }
    },
    {
      label: 'Settings',
      click: () => {
        showSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Minimal Todoist');
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (window && windowVisible) {
      window.hide();
    } else {
      showWindow();
      // Removed manual refresh - using only timed updates
    }
  });
}

function showWindow() {
  if (window) {
    const trayBounds = tray.getBounds();
    const windowBounds = window.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;

    // Position window initially (will be repositioned after content loads)
    let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));
    let y = Math.round(trayBounds.y - windowBounds.height - 10);

    // Ensure initial position is within screen bounds
    if (x + windowBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - windowBounds.width;
    }
    if (x < workArea.x) {
      x = workArea.x;
    }
    if (y < workArea.y) {
      y = trayBounds.y + trayBounds.height + 10;
    }

    window.setPosition(x, y);
    window.show();
    window.focus();
  }
}

function showSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 400,
    height: 200,
    show: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    parent: window,
    modal: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  settingsWindow.loadFile('renderer/settings.html');

  settingsWindow.once('ready-to-show', () => {
    // Center the settings window on screen
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const windowBounds = settingsWindow.getBounds();

    const x = Math.round((width - windowBounds.width) / 2);
    const y = Math.round((height - windowBounds.height) / 2);

    settingsWindow.setPosition(x, y);
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.on('blur', () => {
    setTimeout(() => {
      if (settingsWindow && !settingsWindow.isFocused()) {
        settingsWindow.close();
      }
    }, 100);
  });
}

app.whenReady().then(() => {
  loadConfig();
  createTray();
  createWindow();

  // Start background sync every 30 seconds regardless of window visibility
  setInterval(() => {
    if (window && window.webContents) {
      window.webContents.send('refresh-todos');
    }
  }, 30000);
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('get-todos', async () => {
  const axios = require('axios');
  const token = config?.todoistApiToken;

  if (!token) {
    return { error: 'Please create config.json with your Todoist API token' };
  }

  try {
    // Get active items
    const activeResponse = await axios.post('https://api.todoist.com/sync/v9/sync',
      new URLSearchParams({
        sync_token: '*',
        resource_types: '["items"]'
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const allItems = [];

    // Process active items
    if (activeResponse.data.items) {
      activeResponse.data.items.forEach(item => {
        if (!item.is_deleted) {
          allItems.push({
            id: item.id,
            content: item.content,
            is_completed: false,
            created_at: item.added_at || item.date_added,
            type: 'active'
          });
        }
      });
    }

    // Try to get completed items using the archive endpoint
    try {
      const completedResponse = await axios.post('https://api.todoist.com/sync/v9/completed/get_all',
        new URLSearchParams({
          limit: 15
        }), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      if (completedResponse.data.items) {
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

        completedResponse.data.items.forEach(item => {
          const completedDate = new Date(item.completed_at);

          // Only include completed items from the last 3 days
          if (completedDate >= threeDaysAgo) {
            allItems.push({
              id: item.task_id || item.id, // Use task_id for completed items for uncomplete operation
              content: item.content,
              is_completed: true,
              created_at: item.completed_at,
              type: 'completed'
            });
          }
        });
      }
    } catch (completedError) {
      // Silently handle if completed items can't be fetched
    }

    // Sort: active items first (by date desc), then completed items (by date desc)
    const sortedItems = allItems
      .sort((a, b) => {
        // First, sort by completion status (active items first)
        if (a.is_completed !== b.is_completed) {
          return a.is_completed ? 1 : -1;
        }
        // Then sort by date (newest first within each group)
        return new Date(b.created_at) - new Date(a.created_at);
      })
      .slice(0, 15);

    return sortedItems;
  } catch (error) {
    console.error('Sync API error:', error.response?.data || error.message);
    return { error: error.message };
  }
});

ipcMain.handle('add-todo', async (event, content) => {
  const axios = require('axios');
  const token = config?.todoistApiToken;

  if (!token) {
    return { error: 'Please create config.json with your Todoist API token' };
  }

  try {
    const response = await axios.post('https://api.todoist.com/rest/v2/tasks', {
      content: content
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('complete-todo', async (event, taskId) => {
  const axios = require('axios');
  const token = config?.todoistApiToken;

  if (!token) {
    return { error: 'Please create config.json with your Todoist API token' };
  }

  try {
    // Use Sync API to close the item
    const response = await axios.post('https://api.todoist.com/sync/v9/sync',
      new URLSearchParams({
        commands: JSON.stringify([{
          type: 'item_close',
          uuid: require('crypto').randomUUID(),
          args: { id: taskId }
        }])
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});


ipcMain.handle('reopen-todo', async (event, taskId) => {
  const axios = require('axios');
  const token = config?.todoistApiToken;

  if (!token) {
    return { error: 'Please create config.json with your Todoist API token' };
  }

  try {
    // Use Sync API to reopen the item
    const response = await axios.post('https://api.todoist.com/sync/v9/sync',
      new URLSearchParams({
        commands: JSON.stringify([{
          type: 'item_uncomplete',
          uuid: require('crypto').randomUUID(),
          args: { id: taskId }
        }])
      }), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return { success: true };
  } catch (error) {
    return { error: error.message };
  }
});

ipcMain.handle('get-theme', () => {
  return nativeTheme.shouldUseDarkColors;
});

ipcMain.handle('get-api-key', () => {
  return config?.todoistApiToken || '';
});

ipcMain.handle('save-api-key', (event, apiKey) => {
  try {
    const configPath = path.join(__dirname, 'config.json');

    // Create config object
    const newConfig = {
      todoistApiToken: apiKey
    };

    // Write to file
    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));

    // Update in-memory config
    config = newConfig;

    return { success: true };
  } catch (error) {
    console.error('Failed to save API key:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('resize-window', (event, todoCount) => {
  if (window && tray) {
    // Base height for window chrome and padding
    const baseHeight = 45;
    // Height per todo item (approximately)
    const itemHeight = 24;
    // Minimum height
    const minHeight = 80;
    // Maximum height
    const maxHeight = 600;

    const calculatedHeight = Math.min(
      Math.max(baseHeight + (todoCount * itemHeight), minHeight),
      maxHeight
    );

    // Get current bounds and tray position
    const currentBounds = window.getBounds();
    const trayBounds = tray.getBounds();
    const primaryDisplay = screen.getPrimaryDisplay();
    const workArea = primaryDisplay.workArea;

    // Calculate new position based on tray location and new height
    let x = Math.round(trayBounds.x + (trayBounds.width / 2) - (currentBounds.width / 2));
    let y = Math.round(trayBounds.y - calculatedHeight - 10);

    // Ensure window stays within screen bounds
    if (x + currentBounds.width > workArea.x + workArea.width) {
      x = workArea.x + workArea.width - currentBounds.width;
    }
    if (x < workArea.x) {
      x = workArea.x;
    }
    if (y < workArea.y) {
      y = trayBounds.y + trayBounds.height + 10;
    }

    // Set new bounds with repositioning
    window.setBounds({
      x: x,
      y: y,
      width: currentBounds.width,
      height: calculatedHeight
    });
  }
});