(function () {
    const vscode = acquireVsCodeApi();
    const fileList = document.getElementById('file-list');
    const searchBox = document.getElementById('search-box');
    const currentDirElement = document.getElementById('current-dir');
    const goUpButton = document.getElementById('go-up-button');
    const goRootButton = document.getElementById('go-root-button');
    const tabList = document.getElementById('tab-list');
    const addTabButton = document.getElementById('add-tab-button');

    let files = [];
    let renderedFiles = [];
    let selectedIndex = 0;
    let rightColumnSetting = 'nothing';
    let searchCaseSensitive = false;
    let searchMode = 'filter';
    let searchMatch = 'startsWith';
    let tabs = [];
    let activeTab = '';
    let rootPath = '';

    // Signal that the webview is ready
    vscode.postMessage({ type: 'ready' });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'fileList':
                searchBox.value = '';
                files = message.files;
                rightColumnSetting = message.rightColumn;
                searchCaseSensitive = message.searchCaseSensitive;
                searchMode = message.searchMode;
                searchMatch = message.searchMatch;
                tabs = message.tabs;
                activeTab = message.activeTab;
                rootPath = message.rootPath;
                renderFileList(files);
                renderTabs();
                
                if (message.selectedIndex) {
                    selectedIndex = message.selectedIndex;
                } else {
                    selectedIndex = 0;
                }
                updateSelection();
                break;
            case 'settingsUpdate':
                rightColumnSetting = message.rightColumn;
                searchCaseSensitive = message.searchCaseSensitive;
                searchMode = message.searchMode;
                searchMatch = message.searchMatch;
                renderFileList(files);
                // Re-apply the search
                const e = new Event('input');
                searchBox.dispatchEvent(e);
                break;
        }
    });

    function renderTabs() {
        tabList.innerHTML = '';
        tabs.forEach((tab, i) => { // Added 'i' for index
            const tabItem = document.createElement('li');
            tabItem.className = 'tab-item';
            tabItem.tabIndex = i + 2; // Set tabindex for each tab item
            if (tab === activeTab) {
                tabItem.classList.add('active');
            }
            tabItem.dataset.path = tab;

            const tabName = document.createElement('span');
            let relativePath = tab;
            if (rootPath && tab.startsWith(rootPath)) {
                relativePath = tab.substring(rootPath.length);
                if (relativePath.startsWith('/') || relativePath.startsWith('\\')) {
                    relativePath = relativePath.substring(1);
                }
                if (relativePath === '') {
                    relativePath = '.';
                }
            }
            tabName.textContent = relativePath;
            tabItem.appendChild(tabName);

            const closeButton = document.createElement('span');
            closeButton.className = 'tab-close-button';
            closeButton.textContent = 'x';
            closeButton.addEventListener('click', (e) => {
                e.stopPropagation();
                vscode.postMessage({ type: 'removeTab', tab: tab });
            });
            tabItem.appendChild(closeButton);

            tabItem.addEventListener('click', () => {
                vscode.postMessage({ type: 'switchTab', tab: tab });
            });

            tabList.appendChild(tabItem);
        });
    }

    addTabButton.tabIndex = 1; // Set tabindex for the add tab button
    addTabButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'addTab' });
    });

    function renderFileList(filesToRender) {
        renderedFiles = filesToRender;
        fileList.innerHTML = '';
        filesToRender.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'file-item';
            if (file.isDirectory) {
                listItem.classList.add('directory');
            }
            listItem.dataset.index = index;

            const nameSpan = document.createElement('span');
            nameSpan.className = 'file-name';
            nameSpan.textContent = file.name;

            listItem.appendChild(nameSpan);

            if (rightColumnSetting === 'size') {
                const sizeSpan = document.createElement('span');
                sizeSpan.className = 'file-size';
                sizeSpan.textContent = file.isDirectory ? '' : formatSize(file.size);
                listItem.appendChild(sizeSpan);
            } else if (rightColumnSetting === 'extension') {
                const extSpan = document.createElement('span');
                extSpan.className = 'file-extension';
                if (!file.isDirectory) {
                    const lastDot = file.name.lastIndexOf('.');
                    if (lastDot > 0 && lastDot < file.name.length - 1) {
                        nameSpan.textContent = file.name.substring(0, lastDot);
                        extSpan.textContent = file.name.substring(lastDot + 1);
                    } else if (lastDot === 0 && file.name.length > 1) {
                        nameSpan.textContent = '.';
                        extSpan.textContent = file.name.substring(1);
                    }
                }
                listItem.appendChild(extSpan);
            }

            fileList.appendChild(listItem);
        });
        fileList.focus();
        updateSelection();
    }

    function formatSize(bytes) {
        if (bytes === 0) {return '0 B';}
        const k = 1024;
        const sizes = ['B', 'K', 'M', 'G', 'T'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function updateSelection() {
        const items = fileList.querySelectorAll('.file-item');
        items.forEach((item, index) => {
            if (index === selectedIndex) {
                item.classList.add('selected');
                item.scrollIntoView({ block: 'nearest' });
                // Send message to extension about the selected item
                if (renderedFiles[selectedIndex]) {
                    vscode.postMessage({
                        type: 'selectionChanged',
                        fileName: renderedFiles[selectedIndex].name
                    });
                }
            } else {
                item.classList.remove('selected');
            }
        });
    }

    goUpButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'goUp' });
    });

    goRootButton.addEventListener('click', () => {
        vscode.postMessage({ type: 'goToRoot' });
    });

    fileList.addEventListener('click', e => {
        const clickedItem = e.target.closest('.file-item');
        if (clickedItem) {
            selectedIndex = parseInt(clickedItem.dataset.index, 10);
            updateSelection();
        }
    });

    fileList.addEventListener('dblclick', e => {
        const clickedItem = e.target.closest('.file-item');
        if (clickedItem) {
            const fileIndex = parseInt(clickedItem.dataset.index, 10);
            const selectedFile = renderedFiles[fileIndex];
            if (selectedFile) {
                vscode.postMessage({ type: 'open', fileName: selectedFile.name });
            }
        }
    });

    fileList.addEventListener('keydown', e => {
        if (e.key === 'Backspace') {
            e.preventDefault();
            searchBox.value = searchBox.value.slice(0, -1);
            searchBox.dispatchEvent(new Event('input'));
            return;
        }

        if (e.key === '/') {
            e.preventDefault();
            vscode.postMessage({ type: 'goToRoot' });
            return;
        }

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            vscode.postMessage({ type: 'goUp' });
            return;
        }

        if (e.key === 'F7') {
            e.preventDefault();
            vscode.postMessage({ type: 'findFiles' });
            return;
        }

        if (e.key === 's' && e.ctrlKey) {
            e.preventDefault();
            vscode.postMessage({ type: 'findFiles' });
            return;
        }

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            searchBox.value += e.key;
            searchBox.dispatchEvent(new Event('input'));
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            searchBox.value = '';
            searchBox.dispatchEvent(new Event('input'));
            return;
        }

        if (renderedFiles.length === 0) {return;}

        switch (e.key) {
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = (selectedIndex > 0) ? selectedIndex - 1 : 0;
                updateSelection();
                break;
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = (selectedIndex < renderedFiles.length - 1) ? selectedIndex + 1 : renderedFiles.length - 1;
                updateSelection();
                break;
            case 'Home':
                e.preventDefault();
                selectedIndex = 0;
                updateSelection();
                break;
            case 'End':
                e.preventDefault();
                selectedIndex = renderedFiles.length - 1;
                updateSelection();
                break;
            case 'PageUp':
                e.preventDefault();
                selectedIndex = (selectedIndex > 15) ? selectedIndex - 15 : 0;
                updateSelection();
                break;
            case 'PageDown':
                e.preventDefault();
                selectedIndex = (selectedIndex < renderedFiles.length - 15) ? selectedIndex + 15 : renderedFiles.length - 1;
                updateSelection();
                break;
            case 'Enter':
            case 'ArrowRight':
            case 'F4':
                e.preventDefault();
                const selectedFile = renderedFiles[selectedIndex];
                if (selectedFile) {
                    vscode.postMessage({ type: 'open', fileName: selectedFile.name });
                }
                break;
            case 'F3': // New case for F3
                e.preventDefault();
                const selectedFileF3 = renderedFiles[selectedIndex];
                if (selectedFileF3) {
                    vscode.postMessage({ type: 'open', fileName: selectedFileF3.name, preserveFocus: true });
                }
                break;
        }
    });

    function matches(f, searchTerm) {
        const fileName = searchCaseSensitive ? f.name : f.name.toLowerCase();
        const term = searchCaseSensitive ? searchTerm : searchTerm.toLowerCase();

        if (searchMatch === 'in') {
            return fileName.includes(term);
        }
        return fileName.startsWith(term);
    }

    searchBox.addEventListener('input', e => {
        const searchTerm = e.target.value;

        if (searchMode === 'filter') {
            const previouslySelectedFile = renderedFiles[selectedIndex];

            const filteredFiles = files.filter(f => matches(f, searchTerm));
            renderFileList(filteredFiles);

            let newSelectedIndex = -1;
            if (previouslySelectedFile) {
                newSelectedIndex = filteredFiles.findIndex(f => f.name === previouslySelectedFile.name);
            }

            if (newSelectedIndex !== -1) {
                selectedIndex = newSelectedIndex;
            } else {
                selectedIndex = 0;
            }

            if (filteredFiles.length > 0) {
                updateSelection();
            }
        } else { // searchMode === 'search'
            const foundIndex = files.findIndex(f => matches(f, searchTerm));

            if (foundIndex !== -1) {
                selectedIndex = foundIndex;
                updateSelection();
            }
        }
    });

    // Focus the file list when the webview gains focus
    window.addEventListener('focus', () => {
        fileList.focus();
    });

    

}());
