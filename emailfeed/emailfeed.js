// Email feed functionality
document.addEventListener('DOMContentLoaded', async function() {
  console.log('Email feed page loaded');

  const emailContainer = document.getElementById('emailContainer');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorMessage = document.getElementById('errorMessage');

  // Check if a specific folder was requested via URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const folderParam = urlParams.get('folder');
  let targetFolder = null;

  if (folderParam) {
    try {
      targetFolder = JSON.parse(decodeURIComponent(folderParam));
      console.log('Target folder from URL:', targetFolder);
      // Update page title to show folder name
      // If the folder is named "Feed", don't show "Feed - Feed", just "Feed"
      if (targetFolder.name.toLowerCase() === 'feed') {
        document.title = 'Feed';
      } else {
        document.title = `Feed - ${targetFolder.name}`;
      }
    } catch (error) {
      console.error('Error parsing folder parameter:', error);
    }
  }

  // Detect and apply Thunderbird theme
  detectAndApplyTheme();

  // Load emails when page loads
  await loadEmails(targetFolder);

  // Event delegation for Read More/Read Less buttons
  emailContainer.addEventListener('click', function(event) {
    if (event.target.classList.contains('read-more-btn') || event.target.classList.contains('read-less-btn')) {
      const button = event.target;
      const messageId = button.getAttribute('data-message-id');
      toggleEmailContent(messageId, button);
    }
  });

  async function loadEmails(targetFolder = null) {
    try {
      showLoading();
      hideError();

      console.log('Starting email loading...');
      console.log('Target folder:', targetFolder);
      console.log('Available browser APIs:', Object.keys(browser));
      console.log('Browser accounts API available:', !!browser.accounts);
      console.log('Browser folders API available:', !!browser.folders);
      console.log('Browser messages API available:', !!browser.messages);

      let feedFolder = null;

      if (targetFolder) {
        // Use the specific folder provided via URL parameter
        console.log('Using target folder from URL:', targetFolder);
        // We need to find the actual folder object since we only have basic info
        feedFolder = await findFolderById(targetFolder.id);
        if (!feedFolder) {
          showError(`Cannot access folder "${targetFolder.name}". It may have been moved or deleted.`);
          return;
        }
      } else {
        // Default behavior: look for Feed folder under INBOX
        console.log('Looking for default Feed folder under INBOX...');

        // Get all accounts using the correct Thunderbird API
        let accounts;
        try {
          accounts = await browser.accounts.list();
          console.log('Successfully retrieved accounts:', accounts.length);
          console.log('Account details:', accounts.map(a => ({ name: a.name, type: a.type, id: a.id })));
        } catch (accountError) {
          console.error('Error getting accounts:', accountError);
          showError(`Cannot access email accounts: ${accountError.message}. Please ensure the extension has proper permissions.`);
          return;
        }

        if (!accounts || accounts.length === 0) {
          showError('No email accounts found');
          return;
        }

        // Find Feed folder (should be under INBOX)
        for (const account of accounts) {
          console.log('Checking account:', account.name, account.type);

          // Skip local accounts that don't have email folders
          if (account.type === 'none') {
            console.log('Skipping local account:', account.name);
            continue;
          }

          try {
            // Get all folders for this account
            const allFolders = await getAllFoldersForAccount(account);
            console.log('All folders for account', account.name, ':', allFolders);

            // First find INBOX
            const inboxFolder = findInboxFolder(allFolders);
            if (inboxFolder) {
              console.log('Found INBOX folder:', inboxFolder);
              // Look for Feed folder under INBOX
              feedFolder = findFeedFolder(allFolders, inboxFolder);
              if (feedFolder) {
                console.log('Found Feed folder:', feedFolder);
                break;
              }
            }
          } catch (folderError) {
            console.error('Error accessing folders for account:', account.name, folderError);
            continue;
          }
        }

        if (!feedFolder) {
          // Show available folders for debugging
          let allAvailableFolders = [];
          for (const account of accounts) {
            if (account.type !== 'none') {
              try {
                const folders = await getAllFoldersForAccount(account);
                allAvailableFolders.push(...folders);
              } catch (e) {
                console.error('Error getting folders for debugging:', e);
              }
            }
          }

          console.log('All available folders:', allAvailableFolders);
          const folderNames = allAvailableFolders.map(f => `"${f.name}" (${f.type || 'no type'})`).join(', ');

          showError(`Feed folder not found under INBOX. Available folders: ${folderNames || 'None found'}. Please create a "Feed" folder under your INBOX or right-click any folder and select "Open as Feed".`);
          return;
        }
      }

      console.log('Using folder for feed:', feedFolder);

      // Get messages from the selected folder
      const messageList = await browser.messages.list(feedFolder);
      console.log('Found messages:', messageList.messages.length);

      if (messageList.messages.length === 0) {
        showNoEmails();
        return;
      }

      // Sort messages by date (newest first)
      const sortedMessages = messageList.messages.sort((a, b) =>
        new Date(b.date) - new Date(a.date)
      );

      // Limit to first 50 messages to avoid performance issues
      const messagesToShow = sortedMessages.slice(0, 50);

      // Create email items
      await createEmailItems(messagesToShow);

      hideLoading();

    } catch (error) {
      console.error('Error loading emails:', error);
      showError(`Error loading emails: ${error.message}`);
    }
  }

  async function getAllFoldersForAccount(account) {
    const allFolders = [];

    try {
      // Get the root folders for the account
      const rootFolders = await browser.folders.getSubFolders(account);

      // Recursively collect all folders
      for (const folder of rootFolders) {
        allFolders.push(folder);
        const subFolders = await collectSubFolders(folder);
        allFolders.push(...subFolders);
      }
    } catch (error) {
      console.error('Error getting folders for account:', account.name, error);
    }

    return allFolders;
  }

  async function collectSubFolders(parentFolder) {
    const subFolders = [];

    try {
      if (parentFolder.subFolders && parentFolder.subFolders.length > 0) {
        for (const subFolder of parentFolder.subFolders) {
          subFolders.push(subFolder);
          const deeperFolders = await collectSubFolders(subFolder);
          subFolders.push(...deeperFolders);
        }
      }
    } catch (error) {
      console.error('Error collecting subfolders:', error);
    }

    return subFolders;
  }

  function findInboxFolder(folders) {
    if (!folders || folders.length === 0) return null;

    // First pass: look for exact matches
    for (const folder of folders) {
      const folderName = folder.name ? folder.name.toLowerCase().trim() : '';
      const folderPath = folder.path ? folder.path.toLowerCase() : '';

      console.log('Checking folder:', folderName, 'Path:', folderPath, 'Type:', folder.type);

      // Check for various INBOX variations
      if (folderName === 'inbox' ||
          folder.type === 'inbox') {
        console.log('Found INBOX folder:', folder);
        return folder;
      }
    }

    // Second pass: look for folders that might be inbox by type or special properties
    for (const folder of folders) {
      // Check if this folder has the special inbox flag
      if (folder.type === 'inbox' ||
          (folder.specialUse && folder.specialUse.includes('inbox'))) {
        console.log('Found INBOX by type/special use:', folder);
        return folder;
      }
    }

    return null;
  }

  function findFeedFolder(allFolders, inboxFolder) {
    if (!allFolders || allFolders.length === 0) return null;

    // Look for a folder named "Feed" in all folders
    for (const folder of allFolders) {
      const folderName = folder.name ? folder.name.toLowerCase().trim() : '';

      console.log('Checking for Feed folder:', folderName, 'Path:', folder.path);

      if (folderName === 'feed') {
        console.log('Found Feed folder by name:', folder);
        return folder;
      }
    }

    // If not found by name, look for folders that might be subfolders of INBOX
    if (inboxFolder && inboxFolder.subFolders) {
      for (const subFolder of inboxFolder.subFolders) {
        const subFolderName = subFolder.name ? subFolder.name.toLowerCase().trim() : '';
        if (subFolderName === 'feed') {
          console.log('Found Feed folder as INBOX subfolder:', subFolder);
          return subFolder;
        }
      }
    }

    return null;
  }

  async function createEmailItems(messages) {
    // Clear container safely
    while (emailContainer.firstChild) {
      emailContainer.removeChild(emailContainer.firstChild);
    }

    for (const message of messages) {
      try {
        // Get full message content
        const fullMessage = await browser.messages.getFull(message.id);

        const emailItem = createEmailItemElement(message, fullMessage);
        emailContainer.appendChild(emailItem);
      } catch (error) {
        console.error('Error loading message:', message.id, error);
        // Continue with other messages
      }
    }

    emailContainer.classList.add('loaded');

    // Apply DarkReader to newly loaded email content if dark theme is active
    if (document.body.getAttribute('data-theme') === 'dark') {
      if (typeof DarkReader !== 'undefined') {
        setTimeout(() => {
          console.log('Reprocessing email content with DarkReader');
          try {
            // DarkReader automatically processes new DOM content
          } catch (error) {
            console.error('Error reprocessing with DarkReader:', error);
          }
        }, 100);
      } else {
        // Apply fallback CSS to new content
        setTimeout(() => {
          applyCssToEmailContent();
        }, 100);
      }
    }
  }

  function createEmailItemElement(message, fullMessage) {
    const emailItem = document.createElement('div');
    emailItem.className = `email-item ${message.read ? '' : 'email-unread'} ${message.flagged ? 'email-flagged' : ''}`;

    // Extract email content
    const emailContent = extractEmailContent(fullMessage);
    const hasLongContent = emailContent.length > 1000;

    // Format date in local format
    const date = new Date(message.date).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    // Create email header
    const emailHeader = document.createElement('div');
    emailHeader.className = 'email-header';

    // Create email meta section
    const emailMeta = document.createElement('div');
    emailMeta.className = 'email-meta';

    const emailFrom = document.createElement('div');
    emailFrom.className = 'email-from';
    emailFrom.textContent = message.author;
    emailMeta.appendChild(emailFrom);

    const emailDate = document.createElement('div');
    emailDate.className = 'email-date';
    emailDate.textContent = date;
    emailMeta.appendChild(emailDate);

    emailHeader.appendChild(emailMeta);

    // Create email subject
    const emailSubject = document.createElement('div');
    emailSubject.className = 'email-subject';
    emailSubject.textContent = message.subject || 'No Subject';
    emailHeader.appendChild(emailSubject);

    // Create attachments section if needed
    if (message.attachments && message.attachments.length > 0) {
      const emailAttachments = document.createElement('div');
      emailAttachments.className = 'email-attachments';

      const attachmentIcon = document.createElement('span');
      attachmentIcon.className = 'attachment-icon';
      attachmentIcon.textContent = '📎';
      emailAttachments.appendChild(attachmentIcon);

      const attachmentText = document.createTextNode(
        ` ${message.attachments.length} attachment${message.attachments.length > 1 ? 's' : ''}`
      );
      emailAttachments.appendChild(attachmentText);

      emailHeader.appendChild(emailAttachments);
    }

    // Create email preview section
    const emailPreview = document.createElement('div');
    emailPreview.className = 'email-preview';

    // Create content div
    const emailContentDiv = document.createElement('div');
    emailContentDiv.className = `email-content ${hasLongContent ? 'collapsed' : 'expanded'}`;
    emailContentDiv.id = `content-${message.id}`;

    // Use DOMPurify to safely set HTML content
    const cleanHTML = DOMPurify.sanitize(emailContent);
    emailContentDiv.innerHTML = cleanHTML;

    emailPreview.appendChild(emailContentDiv);

    // Add read more button if needed
    if (hasLongContent) {
      const readMoreBtn = document.createElement('button');
      readMoreBtn.className = 'read-more-btn';
      readMoreBtn.setAttribute('data-message-id', message.id.toString());
      readMoreBtn.textContent = 'Read More';
      emailPreview.appendChild(readMoreBtn);
    }

    // Assemble the email item
    emailItem.appendChild(emailHeader);
    emailItem.appendChild(emailPreview);

    return emailItem;
  }

  function extractEmailContent(fullMessage) {
    try {
      // Try to get HTML content first
      if (fullMessage.parts) {
        const htmlPart = findPartByType(fullMessage.parts, 'text/html');
        if (htmlPart && htmlPart.body) {
          // Clean up HTML content
          let content = htmlPart.body;
          // Remove script tags and other potentially harmful elements
          content = content.replace(/<script[\s\S]*?<\/script>/gi, '');
          content = content.replace(/<link[^>]*>/gi, '');
          content = content.replace(/<meta[^>]*>/gi, '');
          // Limit embedded styles to prevent layout issues
          content = content.replace(/<style[\s\S]*?<\/style>/gi, '');

          // Block tracking pixels and spy elements
          if (window.TrackerBlocker && window.TrackerBlocker.blockTrackersInHTML) {
            console.log('Blocking trackers in email content...');
            content = window.TrackerBlocker.blockTrackersInHTML(content);
          }

          return content;
        }

        // Fall back to plain text
        const textPart = findPartByType(fullMessage.parts, 'text/plain');
        if (textPart && textPart.body) {
          return `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(textPart.body)}</pre>`;
        }
      }

      // If no parts found, check if body exists directly
      if (fullMessage.body) {
        return `<pre style="white-space: pre-wrap; font-family: inherit;">${escapeHtml(fullMessage.body)}</pre>`;
      }

      return '<p style="color: #6c757d; font-style: italic;">No content available</p>';
    } catch (error) {
      console.error('Error extracting email content:', error);
      return '<p style="color: #dc3545; font-style: italic;">Error loading content</p>';
    }
  }

  function findPartByType(parts, mimeType) {
    for (const part of parts) {
      if (part.contentType === mimeType) {
        return part;
      }
      if (part.parts) {
        const found = findPartByType(part.parts, mimeType);
        if (found) return found;
      }
    }
    return null;
  }

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    // Use DOMPurify to sanitize the result
    return DOMPurify.sanitize(div.innerHTML);
  }

  function showLoading() {
    loadingIndicator.style.display = 'block';
    emailContainer.style.display = 'none';
    errorMessage.style.display = 'none';
  }

  function hideLoading() {
    loadingIndicator.style.display = 'none';
    emailContainer.style.display = 'block';
  }

  function showError(message) {
    loadingIndicator.style.display = 'none';
    emailContainer.style.display = 'none';
    errorMessage.style.display = 'block';
    errorMessage.querySelector('p').textContent = message;
  }

  function hideError() {
    errorMessage.style.display = 'none';
  }

  function showNoEmails() {
    hideLoading();

    // Clear container safely
    while (emailContainer.firstChild) {
      emailContainer.removeChild(emailContainer.firstChild);
    }

    // Create no emails message
    const noEmailsDiv = document.createElement('div');
    noEmailsDiv.className = 'no-emails';

    const heading = document.createElement('h2');
    heading.textContent = '📭 No Emails Found';
    noEmailsDiv.appendChild(heading);

    const paragraph = document.createElement('p');
    paragraph.textContent = 'Your Feed folder appears to be empty.';
    noEmailsDiv.appendChild(paragraph);

    emailContainer.appendChild(noEmailsDiv);
    emailContainer.classList.add('loaded');
  }

  async function findFolderById(folderId) {
    try {
      // Get all accounts and search through all folders
      const accounts = await browser.accounts.list();

      for (const account of accounts) {
        if (account.type === 'none') continue;

        try {
          const allFolders = await getAllFoldersForAccount(account);
          const folder = allFolders.find(f => f.id === folderId);
          if (folder) {
            console.log('Found folder by ID:', folder);
            return folder;
          }
        } catch (error) {
          console.error('Error searching folders in account:', account.name, error);
        }
      }
    } catch (error) {
      console.error('Error finding folder by ID:', error);
    }

    return null;
  }


  function detectAndApplyTheme() {
    try {
      console.log('Detecting Thunderbird theme...');

      // Check if we can access parent window theme
      let isDarkTheme = false;

      // Method 1: Check media query
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        isDarkTheme = true;
        console.log('Dark theme detected via media query');
      }

      // Method 2: Try to detect from Thunderbird's window
      try {
        if (window.parent && window.parent !== window) {
          const parentDoc = window.parent.document;
          if (parentDoc) {
            // Check for Thunderbird dark theme classes or attributes
            if (parentDoc.documentElement.hasAttribute('lwt-tree-brighttext') ||
                parentDoc.documentElement.classList.contains('dark-theme') ||
                parentDoc.body.classList.contains('dark-theme')) {
              isDarkTheme = true;
              console.log('Dark theme detected from parent window');
            }
          }
        }
      } catch (e) {
        console.log('Cannot access parent window (expected in extension context)');
      }

      // Method 3: Check Thunderbird theme preference via extension API
      if (browser && browser.theme && browser.theme.getCurrent) {
        browser.theme.getCurrent().then(theme => {
          if (theme && theme.colors) {
            // Check if background color is dark
            const bgColor = theme.colors.toolbar || theme.colors.frame;
            if (bgColor) {
              // Convert hex to RGB and check brightness
              const rgb = hexToRgb(bgColor);
              if (rgb) {
                const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
                if (brightness < 128) {
                  isDarkTheme = true;
                  console.log('Dark theme detected from Thunderbird theme API');
                }
              }
            }
          }
          applyThemeClass(isDarkTheme);
        }).catch(e => {
          console.log('Theme API not available, using fallback detection');
          applyThemeClass(isDarkTheme);
        });
      } else {
        applyThemeClass(isDarkTheme);
      }

    } catch (error) {
      console.error('Error detecting theme:', error);
      // Default to system preference
      const isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyThemeClass(isDark);
    }
  }

  function applyThemeClass(isDark) {
    const body = document.body;
    if (isDark) {
      body.setAttribute('data-theme', 'dark');
      body.classList.add('theme-dark');
      console.log('Applied dark theme');

      // Enable DarkReader for email content
      if (typeof DarkReader !== 'undefined') {
        console.log('DarkReader is available, enabling for email content');
        try {
          DarkReader.enable({
            brightness: 100,
            contrast: 100,
            sepia: 0
          });
          console.log('DarkReader enabled successfully');
        } catch (error) {
          console.error('Error enabling DarkReader:', error);
          // Fallback to simple CSS approach
          enableSimpleDarkMode();
        }
      } else {
        console.warn('DarkReader not available, using fallback CSS approach');
        // Fallback to simple CSS approach
        enableSimpleDarkMode();
      }
    } else {
      body.removeAttribute('data-theme');
      body.classList.remove('theme-dark');
      console.log('Applied light theme');

      // Disable DarkReader for light theme
      if (typeof DarkReader !== 'undefined') {
        try {
          DarkReader.disable();
          console.log('DarkReader disabled');
        } catch (error) {
          console.error('Error disabling DarkReader:', error);
        }
      }
      // Remove fallback CSS
      disableSimpleDarkMode();
    }
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

  function toggleEmailContent(messageId, button) {
    const contentElement = document.getElementById(`content-${messageId}`);
    if (!contentElement) {
      console.error('Content element not found for message ID:', messageId);
      return;
    }

    const isCollapsed = contentElement.classList.contains('collapsed');

    if (isCollapsed) {
      // Expand
      contentElement.classList.remove('collapsed');
      contentElement.classList.add('expanded');
      button.textContent = 'Read Less';
      button.className = 'read-less-btn';
    } else {
      // Collapse
      contentElement.classList.remove('expanded');
      contentElement.classList.add('collapsed');
      button.textContent = 'Read More';
      button.className = 'read-more-btn';

      // Scroll to the email header
      contentElement.closest('.email-item').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  }

  // Fallback functions for when DarkReader is not available
  function enableSimpleDarkMode() {
    console.log('Enabling simple CSS fallback for dark mode');
    applyCssToEmailContent();
  }

  function disableSimpleDarkMode() {
    console.log('Disabling simple CSS fallback');
    const existingStyle = document.getElementById('email-dark-mode-fallback');
    if (existingStyle) {
      existingStyle.remove();
    }
  }

  function applyCssToEmailContent() {
    // Remove existing fallback styles
    const existingStyle = document.getElementById('email-dark-mode-fallback');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Add improved fallback CSS
    const style = document.createElement('style');
    style.id = 'email-dark-mode-fallback';
    style.textContent = `
      .email-content {
        filter: invert(1) hue-rotate(180deg) brightness(1.1) contrast(0.9);
      }
      .email-content img {
        filter: invert(1) hue-rotate(180deg);
      }
    `;
    document.head.appendChild(style);
    console.log('Applied CSS fallback for email content');
  }
});