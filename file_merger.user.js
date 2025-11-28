// ==UserScript==
// @name         AI File Merger & Injector
// @namespace    http://tampermonkey.net/
// @version      8.0
// @description  Floating ball: Click to open, Right-click to clear. Support Folder recursive drag. Drop inside modal supported.
// @author       You
// @match        https://chatgpt.com/*
// @match        https://chat.qwen.ai/*
// @match        https://gemini.google.com/*
// @match        https://chat.deepseek.com/*
// @match        https://claude.ai/*
// @match        https://grok.com/*
// @updateURL    https://raw.githubusercontent.com/make-a/file_merger/main/file_merger.user.js
// @downloadURL  https://raw.githubusercontent.com/make-a/file_merger/main/file_merger.user.js
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ========================================================================
    // 🔧 1. 网站配置
    // ========================================================================
    const SITE_CONFIG = [
        { domain: 'chatgpt.com', selector: '#prompt-textarea' },
        { domain: 'chat.qwen.ai', selector: 'textarea' },
        { domain: 'gemini.google.com', selector: 'div[contenteditable="true"]' },
        { domain: 'deepseek.com', selector: 'textarea' },
        { domain: 'claude.ai', selector: 'div[contenteditable="true"]' }
    ];

    // ========================================================================
    // 💾 2. 数据状态管理
    // ========================================================================
    let fileQueue = [];

    // ========================================================================
    // 🎨 3. CSS 样式
    // ========================================================================
    const styles = `
        /* --- 悬浮球 (常态) --- */
        #ai-drop-zone {
            position: fixed; right: 20px; top: 40%; width: 90px; height: 90px;
            background: rgba(32, 33, 35, 0.9); border: 2px solid #666; border-radius: 50%;
            z-index: 99999; display: flex; flex-direction: column; justify-content: center; align-items: center;
            text-align: center; color: #fff; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            transition: width 0.3s, height 0.3s, border-radius 0.3s, background 0.3s, top 0.3s, left 0.3s, transform 0.3s;
            user-select: none; overflow: hidden; font-family: sans-serif;
        }
        #ai-drop-zone:hover { border-color: #fff; transform: scale(1.05); }

        #ai-drop-zone .icon { font-size: 28px; margin-bottom: 2px; pointer-events: none; }
        #ai-drop-zone .text { font-size: 10px; line-height: 1.3; pointer-events: none; color: #ccc; }

        /* 红色角标 */
        #ai-drop-zone .badge {
            position: absolute; top: 5px; right: 10px; background: #ef4444; color: white;
            font-size: 10px; padding: 2px 6px; border-radius: 10px; display: none;
        }
        #ai-drop-zone.has-files .badge { display: block; }

        /* --- 激活状态 (拖入文件时 - 顶部横幅模式) --- */
        #ai-drop-zone.active-expanded {
            top: 20px !important; left: 50% !important; transform: translateX(-50%) !important;
            width: 600px; height: 180px; border-radius: 12px;
            border: 4px dashed #10a37f; background: rgba(32, 33, 35, 0.98);
            box-shadow: 0 10px 50px rgba(0,0,0,0.8); cursor: default;
        }
        #ai-drop-zone.active-expanded .icon { font-size: 50px; margin-bottom: 10px; }
        #ai-drop-zone.active-expanded .text { font-size: 18px; font-weight: bold; color: #fff; }
        #ai-drop-zone.active-expanded .badge { display: none; }
        .force-close-hint { display: none; font-size: 12px; color: #666; margin-top: 10px; }
        #ai-drop-zone.active-expanded .force-close-hint { display: block; }

        /* --- 结果弹窗 --- */
        #ai-merger-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.75); z-index: 100000;
            display: flex; justify-content: center; align-items: center;
            font-family: sans-serif; backdrop-filter: blur(3px);
        }
        #ai-merger-overlay.hidden { display: none; }

        #ai-merger-modal {
            background: #1f1f1f; color: #ececf1; width: 900px; max-width: 95%; height: 90%;
            border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            display: flex; flex-direction: column; padding: 20px; border: 1px solid #444;
            transition: border-color 0.2s;
        }
        /* 弹窗内的拖拽激活状态 */
        #ai-merger-modal.drag-active {
            border: 2px dashed #10a37f;
            background: #2a2b32;
        }

        .merger-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #333;
        }
        .header-title { font-size: 18px; font-weight: bold; }
        .header-subtitle { font-size: 12px; color: #aaa; margin-left: 10px; font-weight: normal; }

        /* 文件列表 */
        #file-list-container {
            flex: 1; overflow-y: auto; padding-right: 5px; margin-bottom: 15px;
            border: 2px solid transparent; border-radius: 8px;
        }
        #file-list-container::-webkit-scrollbar { width: 8px; }
        #file-list-container::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }

        /* 列表区域拖拽高亮 */
        #file-list-container.drag-over-list {
            border-color: #3b82f6; background: rgba(59, 130, 246, 0.1);
        }

        /* 文件卡片 */
        .file-block {
            background: #2b2b2b; border: 1px solid #444; border-radius: 8px;
            margin-bottom: 10px; overflow: hidden; transition: border-color 0.2s;
        }
        .file-block:hover { border-color: #666; }

        .file-header {
            padding: 10px 15px; background: #343541; cursor: pointer; user-select: none;
            display: flex; justify-content: space-between; align-items: center;
        }
        .file-header:hover { background: #3e3f4b; }

        .file-info { display: flex; align-items: center; gap: 10px; font-weight: bold; font-size: 14px; }
        .arrow-icon { transition: transform 0.2s; font-size: 12px; color: #aaa; }
        .collapsed .arrow-icon { transform: rotate(-90deg); }

        .file-actions { display: flex; gap: 10px; }
        .btn-sm {
            padding: 3px 10px; border-radius: 4px; border: 1px solid #555;
            background: transparent; color: #ccc; cursor: pointer; font-size: 12px;
        }
        .btn-sm:hover { background: #444; color: #fff; }
        .btn-del:hover { background: #b91c1c; border-color: #b91c1c; }

        .file-body { padding: 0; display: block; }
        .file-body.hidden { display: none; }

        .file-editor {
            width: 100%; box-sizing: border-box; background: #222; color: #ddd;
            border: none; border-top: 1px solid #444; padding: 10px 15px;
            resize: vertical; min-height: 150px; font-family: monospace; font-size: 13px; outline: none;
        }
        .file-editor:focus { background: #1a1a1a; }

        /* 底部按钮 */
        .merger-actions { display: flex; gap: 10px; justify-content: space-between; margin-top: auto; }
        .right-actions { display: flex; gap: 10px; }

        .merger-btn {
            padding: 10px 20px; border-radius: 6px; border: none; cursor: pointer;
            font-size: 14px; font-weight: 600; color: white; transition: all 0.2s;
        }
        .merger-btn:active { transform: scale(0.98); }
        .merger-btn:disabled { opacity: 0.6; cursor: not-allowed; }

        .btn-copy { background: #10a37f; }
        .btn-insert { background: #3b82f6; }
        .btn-close { background: #444; }
        .btn-clear-all { background: #b91c1c; margin-right: auto; }

        /* --- Toast 消息提示 --- */
        #ai-toast-container {
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647; display: flex; flex-direction: column; gap: 10px; pointer-events: none;
        }
        .ai-toast {
            background: rgba(0, 0, 0, 0.85); color: #fff; padding: 12px 24px;
            border-radius: 8px; font-size: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            animation: toast-fade-in 0.3s ease-out; backdrop-filter: blur(4px); border: 1px solid #333;
            display: flex; align-items: center; gap: 8px;
        }
        @keyframes toast-fade-in { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes toast-fade-out { from { opacity: 1; } to { opacity: 0; } }
    `;

    GM_addStyle(styles);

    // ========================================================================
    // 🏗️ 4. DOM 元素构建
    // ========================================================================

    const toastContainer = document.createElement('div');
    toastContainer.id = 'ai-toast-container';
    document.body.appendChild(toastContainer);

    const dropZone = document.createElement('div');
    dropZone.id = 'ai-drop-zone';
    dropZone.innerHTML = `
        <div class="badge" id="file-count-badge">0</div>
        <div class="icon">📂</div>
        <div class="text">点击: 打开<br>右键: 清空<br>拖入: 添加</div>
        <div class="force-close-hint">(点击任意处取消)</div>
    `;
    document.body.appendChild(dropZone);

    const overlay = document.createElement('div');
    overlay.id = 'ai-merger-overlay';
    overlay.className = 'hidden';
    overlay.innerHTML = `
        <div id="ai-merger-modal">
            <div class="merger-header">
                <div>
                    <span class="header-title">文件合并管理</span>
                    <span class="header-subtitle">拖入文件或文件夹添加</span>
                </div>
                <button class="btn-sm" id="merger-close-x">✕</button>
            </div>
            <div id="file-list-container"></div>
            <div class="merger-actions">
                <button class="merger-btn btn-clear-all" id="merger-clear">🗑️ 清空列表</button>
                <div class="right-actions">
                    <button class="merger-btn btn-close" id="merger-cancel">关闭</button>
                    <button class="merger-btn btn-copy" id="merger-copy">复制全部</button>
                    <button class="merger-btn btn-insert" id="merger-insert">填入输入框</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const listContainer = document.getElementById('file-list-container');
    const modalEl = document.getElementById('ai-merger-modal');
    const clearBtn = document.getElementById('merger-clear');
    const closeBtn = document.getElementById('merger-cancel');
    const closeX = document.getElementById('merger-close-x');
    const copyBtn = document.getElementById('merger-copy');
    const insertBtn = document.getElementById('merger-insert');
    const fileCountBadge = document.getElementById('file-count-badge');

    // ========================================================================
    // 🔔 功能函数
    // ========================================================================
    function showToast(msg, type = 'info') {
        const toast = document.createElement('div');
        toast.className = 'ai-toast';
        let icon = 'ℹ️';
        if (type === 'success') icon = '✅';
        if (type === 'error') icon = '❌';

        toast.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-fade-out 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ========================================================================
    // 📂 5. 核心：文件夹递归读取逻辑
    // ========================================================================

    // 辅助：读取 FileEntry
    function readFileEntry(fileEntry, path = '') {
        return new Promise((resolve) => {
            fileEntry.file((file) => {
                // 如果是文本文件，读取内容
                const reader = new FileReader();
                reader.onload = (e) => {
                    resolve({
                        id: Date.now() + Math.random().toString(36).substr(2, 9),
                        name: (path ? path + '/' : '') + file.name, // 保留路径
                        ext: file.name.split('.').pop() || 'txt',
                        content: e.target.result,
                        collapsed: false,
                        originalFile: file
                    });
                };
                reader.onerror = () => resolve(null); // 忽略读取失败
                reader.readAsText(file);
            });
        });
    }

    // 辅助：递归读取 DirectoryEntry
    function readDirectoryEntry(dirEntry, path = '') {
        return new Promise((resolve) => {
            const dirReader = dirEntry.createReader();
            const entries = [];

            // readEntries 可能不会一次返回所有文件，需要递归调用 (简化版处理，通常足够)
            const readNext = () => {
                dirReader.readEntries(async (results) => {
                    if (results.length) {
                        entries.push(...results);
                        readNext();
                    } else {
                        // 遍历所有条目
                        const promises = entries.map(entry => scanEntry(entry, path + dirEntry.name));
                        const deepFiles = (await Promise.all(promises)).flat();
                        resolve(deepFiles);
                    }
                });
            };
            readNext();
        });
    }

    // 统一入口：扫描 Entry
    async function scanEntry(entry, path = '') {
        if (entry.isFile) {
            return [await readFileEntry(entry, path)];
        } else if (entry.isDirectory) {
            return await readDirectoryEntry(entry, path ? path + '/' : '');
        }
        return [];
    }

    // 处理 Drop 事件的 Items
    async function handleDropItems(items) {
        showToast('正在扫描文件...', 'info');
        const promises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.kind === 'file') {
                const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry) {
                    promises.push(scanEntry(entry));
                } else {
                    // 降级处理：非 webkit 浏览器
                    const file = item.getAsFile();
                    if(file) promises.push(readFileEntry({ file: cb => cb(file) }));
                }
            }
        }

        try {
            const results = await Promise.all(promises);
            // 拍平数组并过滤空值
            const flatFiles = results.flat().filter(f => f && typeof f.content === 'string');

            if (flatFiles.length === 0) {
                showToast('未找到可读的文本文件', 'error');
                return;
            }

            fileQueue = [...fileQueue, ...flatFiles];
            renderFileList();
            updateBadge();
            showToast(`添加了 ${flatFiles.length} 个文件`, 'success');
            showModal(); // 确保弹窗打开
        } catch (err) {
            console.error(err);
            showToast('文件处理出错', 'error');
        }
    }

    // ========================================================================
    // 🖱️ 6. 交互与拖拽逻辑
    // ========================================================================

    // --- A. 全局/悬浮球拖拽 ---
    let globalDragCounter = 0;

    document.addEventListener('dragenter', (e) => {
        // 如果弹窗已打开，不触发悬浮球的“展开效果”，避免遮挡
        if (!overlay.classList.contains('hidden')) return;

        e.preventDefault();
        globalDragCounter++;
        if (globalDragCounter === 1) {
            dropZone.classList.add('active-expanded');
            dropZone.querySelector('.text').innerText = '松手添加 (支持文件夹)';
        }
    });

    document.addEventListener('dragleave', (e) => {
        if (!overlay.classList.contains('hidden')) return;
        e.preventDefault();
        globalDragCounter--;
        if (globalDragCounter <= 0) {
            resetDragState();
        }
    });

    document.addEventListener('dragover', (e) => e.preventDefault());

    document.addEventListener('drop', (e) => {
        if (!overlay.classList.contains('hidden')) return; // 弹窗打开时，交给弹窗处理
        e.preventDefault();
        resetDragState();
        if (e.dataTransfer.items) {
            handleDropItems(e.dataTransfer.items);
        }
    });

    function resetDragState() {
        globalDragCounter = 0;
        dropZone.classList.remove('active-expanded');
        dropZone.querySelector('.text').innerHTML = '点击: 打开<br>右键: 清空<br>拖入: 添加';
    }

    // --- B. 弹窗内拖拽 (新增) ---
    // 监听 Modal 及其子元素的拖拽
    modalEl.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        listContainer.classList.add('drag-over-list');
        modalEl.classList.add('drag-active');
    });

    // 需要阻止 dragover 才能触发 drop
    modalEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    modalEl.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 只有离开 modal 区域才取消
        if (e.target === modalEl || e.target === listContainer) {
            listContainer.classList.remove('drag-over-list');
            modalEl.classList.remove('drag-active');
        }
    });

    modalEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        listContainer.classList.remove('drag-over-list');
        modalEl.classList.remove('drag-active');

        if (e.dataTransfer.items) {
            handleDropItems(e.dataTransfer.items);
        }
    });


    // --- C. 悬浮球移动与点击 ---
    let isDraggingBall = false;
    let hasMoved = false;
    let startOffset = { x: 0, y: 0 };
    let startPos = { x: 0, y: 0 };

    dropZone.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        if (dropZone.classList.contains('active-expanded')) return;
        isDraggingBall = true;
        hasMoved = false;
        startPos = { x: e.clientX, y: e.clientY };
        startOffset.x = e.clientX - dropZone.getBoundingClientRect().left;
        startOffset.y = e.clientY - dropZone.getBoundingClientRect().top;
        dropZone.style.transition = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingBall) return;
        e.preventDefault();
        const dx = Math.abs(e.clientX - startPos.x);
        const dy = Math.abs(e.clientY - startPos.y);
        if (dx > 3 || dy > 3) {
            hasMoved = true;
            dropZone.style.left = `${e.clientX - startOffset.x}px`;
            dropZone.style.top = `${e.clientY - startOffset.y}px`;
            dropZone.style.right = 'auto';
        }
    });

    document.addEventListener('mouseup', (e) => {
        if (isDraggingBall) {
            isDraggingBall = false;
            dropZone.style.transition = '';
            if (!hasMoved && e.button === 0) showModal();
        }
    });

    dropZone.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (fileQueue.length === 0) { showToast('列表为空', 'info'); return; }
        if (confirm(`⚠️ 清空所有文件？`)) clearAllFiles();
    });

    // ========================================================================
    // ⚙️ 7. 渲染与逻辑
    // ========================================================================

    function updateBadge() {
        const count = fileQueue.length;
        fileCountBadge.innerText = count;
        count > 0 ? dropZone.classList.add('has-files') : dropZone.classList.remove('has-files');
    }

    function clearAllFiles() {
        fileQueue = [];
        renderFileList();
        updateBadge();
        showToast('已清空', 'success');
    }

    function renderFileList() {
        if (fileQueue.length === 0) {
            listContainer.innerHTML = '<div style="text-align:center; color:#666; margin-top:50px;">拖入文件或文件夹...</div>';
            return;
        }
        listContainer.innerHTML = '';
        fileQueue.forEach((file, index) => {
            const block = document.createElement('div');
            block.className = 'file-block';

            const header = document.createElement('div');
            header.className = `file-header ${file.collapsed ? 'collapsed' : ''}`;
            header.innerHTML = `
                <div class="file-info">
                    <span class="arrow-icon">▼</span>
                    <span title="${file.name}">${file.name}</span>
                </div>
                <div class="file-actions"><button class="btn-sm btn-del">删除</button></div>
            `;

            header.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                file.collapsed = !file.collapsed;
                renderFileList();
            });

            header.querySelector('.btn-del').addEventListener('click', () => {
                fileQueue.splice(index, 1);
                renderFileList();
                updateBadge();
            });

            const body = document.createElement('div');
            body.className = `file-body ${file.collapsed ? 'hidden' : ''}`;
            const textarea = document.createElement('textarea');
            textarea.className = 'file-editor';
            textarea.value = file.content;
            textarea.addEventListener('input', (e) => fileQueue[index].content = e.target.value);

            body.appendChild(textarea);
            block.appendChild(header);
            block.appendChild(body);
            listContainer.appendChild(block);
        });
    }

    function generateAllMarkdown() {
        if (fileQueue.length === 0) return '';
        // 自动使用文件名作为标记
        return fileQueue.map(file => `### Filename: ${file.name}\n\`\`\`${file.ext}\n${file.content}\n\`\`\``).join('\n\n');
    }

    // ========================================================================
    // 🕹️ 8. UI 事件
    // ========================================================================

    function showModal() { renderFileList(); overlay.classList.remove('hidden'); }
    function hideModal() { overlay.classList.add('hidden'); }

    clearBtn.addEventListener('click', () => { if (confirm('确定清空列表吗？')) clearAllFiles(); });

    copyBtn.addEventListener('click', () => {
        const finalContent = generateAllMarkdown();
        if (!finalContent) { showToast('没有内容', 'error'); return; }
        GM_setClipboard(finalContent);
        showToast('已复制全部内容', 'success');
        const originalText = '复制全部';
        copyBtn.innerText = '已复制 ✅';
        copyBtn.disabled = true;
        setTimeout(() => { copyBtn.innerText = originalText; copyBtn.disabled = false; }, 2000);
    });

    insertBtn.addEventListener('click', () => {
        const finalContent = generateAllMarkdown();
        if (!finalContent) { showToast('没有内容', 'error'); return; }
        const config = SITE_CONFIG.find(site => window.location.hostname.includes(site.domain));
        let inputEl = config ? document.querySelector(config.selector) : document.querySelector('textarea');

        if (!inputEl) { showToast('未找到输入框', 'error'); return; }
        inputEl.focus();
        if (inputEl.tagName.toLowerCase() === 'textarea') {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
            nativeSetter.call(inputEl, finalContent);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            inputEl.textContent = finalContent;
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        hideModal();
        showToast('已填入', 'success');
    });

    closeBtn.addEventListener('click', hideModal);
    closeX.addEventListener('click', hideModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) hideModal(); });

})();