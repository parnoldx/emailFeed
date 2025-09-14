// Background script for Email Feed extension
console.log('Email Feed background script loaded');


// Handle keyboard shortcut commands
browser.commands.onCommand.addListener(async (command) => {
  console.log('Command triggered:', command);

  if (command === 'open-feed') {
    console.log('Keyboard shortcut used - trying to get selected folder');

    try {
      // Try to get the currently selected folder
      const selectedFolder = await getCurrentlySelectedFolder();

      if (selectedFolder) {
        console.log('Found selected folder:', selectedFolder.name);
        openFeedForFolder(selectedFolder);
      } else {
        console.log('No folder selected, opening default Feed folder');
        openFeedForFolder(null);
      }
    } catch (error) {
      console.error('Error getting selected folder:', error);
      console.log('Fallback to default Feed folder');
      openFeedForFolder(null);
    }
  }
});

// Create context menu for folders
browser.runtime.onInstalled.addListener(() => {
  console.log('Extension installed, creating context menu...');

  // Create context menu for folders
  try {
    browser.menus.create({
      id: "open-folder-feed",
      title: "Open as Feed",
      contexts: ["folder_pane"]
    }, () => {
      if (browser.runtime.lastError) {
        console.error('Error creating context menu:', browser.runtime.lastError);
      } else {
        console.log('Context menu created successfully');
      }
    });
  } catch (error) {
    console.error('Failed to create context menu:', error);
  }
});

// Handle context menu clicks
browser.menus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-folder-feed") {
    console.log('Context menu clicked for folder:', info);
    console.log('Available info properties:', Object.keys(info));

    // In Thunderbird, folder info might be in different properties
    let selectedFolder = null;

    // Check different possible properties for folder information
    if (info.selectedFolder) {
      selectedFolder = info.selectedFolder;
    } else if (info.selectedAccount && info.selectedAccount.folders && info.selectedAccount.folders.length > 0) {
      // Sometimes folder info is in the account context
      selectedFolder = info.selectedAccount.folders[0];
    } else if (info.displayedFolder) {
      selectedFolder = info.displayedFolder;
    } else if (info.folder) {
      selectedFolder = info.folder;
    } else if (info.targetElementId) {
      // Try to extract folder info from target element
      console.log('Target element ID:', info.targetElementId);
    }

    if (selectedFolder) {
      console.log('Found folder information:', selectedFolder);
      openFeedForFolder(selectedFolder);
    } else {
      console.warn('No folder information available in context menu click');
      console.log('Full info object:', JSON.stringify(info, null, 2));
      // Fallback to default behavior
      openFeedForFolder(null);
    }
  }
});

async function getCurrentlySelectedFolder() {
  try {
    // Get the current Thunderbird main window tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });

    if (tabs.length === 0) {
      console.log('No active tab found');
      return null;
    }

    // Try to get the displayed folder from the main window
    // This approach tries to access Thunderbird's internal state
    // Note: This may have limited access depending on Thunderbird version

    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].mailTab && tabs[0].folder) {
        const mailTab = tabs[0];
        console.log('Found displayed folder via tabs.query:', mailTab.folder);
        return mailTab.folder;
      }
    } catch (error) {
      console.log('tabs.query API not available or failed:', error);
    }
    return null;

  } catch (error) {
    console.error('Error in getCurrentlySelectedFolder:', error);
    return null;
  }
}

function openFeedForFolder(folder) {
  let url = browser.runtime.getURL('emailfeed/emailfeed.html');

  // If a specific folder is provided, encode it in the URL
  if (folder) {
    const encodedFolder = encodeURIComponent(JSON.stringify({
      id: folder.id,
      name: folder.name,
      path: folder.path
    }));
    url += `?folder=${encodedFolder}`;
    console.log('Opening feed for folder:', folder.name);
  } else {
    console.log('Opening feed for default Feed folder');
  }

  browser.tabs.create({ url }).then(() => {
    console.log('Feed tab created successfully');
  }).catch(error => {
    console.error('Error creating feed tab:', error);
  });
}

// Extension lifecycle events
browser.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  
  // Initialize default settings
  browser.storage.local.set({
    extensionVersion: '1.0.0',
    installDate: new Date().toISOString()
  });
});

browser.runtime.onStartup.addListener(() => {
  console.log('Extension startup');
});