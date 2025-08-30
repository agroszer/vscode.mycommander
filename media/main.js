
(function () {
    const vscode = acquireVsCodeApi();
    const fileList = document.getElementById('file-list');
    const searchBox = document.getElementById('search-box');
    const currentDirElement = document.getElementById('current-dir');
    const goUpButton = document.getElementById('go-up-button');
    const goRootButton = document.getElementById('go-root-button');

    let files = [];
    let renderedFiles = [];
    let selectedIndex = 0;
    let showFileSizeSetting = false; // New global variable
    let searchCaseSensitive = false; // New global variable
    let searchMode = 'filter'; // New global variable
    let searchMatch = 'startsWith'; // New global variable

    // Signal that the webview is ready
    vscode.postMessage({ type: 'ready' });

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'fileList':
                searchBox.value = '';
                files = message.files;
                showFileSizeSetting = message.showFileSize; // Store the setting
                searchCaseSensitive = message.searchCaseSensitive; // Store the setting
                searchMode = message.searchMode; // Store the setting
                searchMatch = message.searchMatch; // Store the setting
                renderFileList(files);
                currentDirElement.textContent = message.currentDir;
                if (message.selectedIndex) {
                    selectedIndex = message.selectedIndex;
                } else {
                    selectedIndex = 0;
                }
                updateSelection();
                break;
            case 'settingsUpdate':
                showFileSizeSetting = message.showFileSize;
                searchCaseSensitive = message.searchCaseSensitive;
                searchMode = message.searchMode;
                searchMatch = message.searchMatch;
                renderFileList(files);
                // Re-apply the search
                const event = new Event('input');
                searchBox.dispatchEvent(event);
                break;
        }
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

            if (showFileSizeSetting) { // Conditionally create and append sizeSpan
                const sizeSpan = document.createElement('span');
                sizeSpan.className = 'file-size';
                sizeSpan.textContent = file.isDirectory ? '' : formatSize(file.size);
                listItem.appendChild(sizeSpan);
            }

            fileList.appendChild(listItem);
        });
        fileList.focus();
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

        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            searchBox.value += e.key;
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
            case 'ArrowLeft':
                e.preventDefault();
                vscode.postMessage({ type: 'goUp' });
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
            case 'Escape':
                e.preventDefault();
                searchBox.value = '';
                searchBox.dispatchEvent(new Event('input'));
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
