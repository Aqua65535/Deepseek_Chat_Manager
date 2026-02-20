// ==UserScript==
// @name         DeepSeek对话管理器
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  基于berry22jelly的"DeepSeek对话收藏器(v1.0.1)"改造的脚本，支持收藏、搜索、分类DeepSeek对话
// @author       Aqua_65535
// @license      MIT
// @match        https://chat.deepseek.com/
// @match        https://chat.deepseek.com/*
// @match        https://chat.deepseek.com/chat/*
// @match        https://chat.deepseek.com/c/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    console.log('DeepSeek收藏器脚本 v1.1.0 已加载！');

    // 使用GM存储函数进行数据持久化
    const storage = {
        set: (key, value) => GM_setValue(key, value),
        get: (key, defaultValue = null) => GM_getValue(key, defaultValue),
        getAll: () => {
            try {
                const allItems = GM_listValues()
                    .filter(key => key.startsWith('dsc_'))
                    .map(key => ({
                        key,
                        value: GM_getValue(key)
                    }));
                return allItems;
            } catch (e) {
                console.error('获取收藏列表失败:', e);
                return [];
            }
        },
        remove: (key) => GM_deleteValue(key),
        getLastBackupTime: () => GM_getValue('dsc_last_backup_time', 0),
        setLastBackupTime: (time) => GM_setValue('dsc_last_backup_time', time),
        getBackupReminderDisabled: () => GM_getValue('dsc_backup_reminder_disabled', false),
        setBackupReminderDisabled: (disabled) => GM_setValue('dsc_backup_reminder_disabled', disabled)
    };

    // 主色调
    const PRIMARY_COLOR = '#5686fe';

    // 固定6个分类（可重命名，但数量固定）
    const FIXED_CATEGORIES = [
        '化学',
        '英语',
        '数学',
        '物理',
        '计算机',
        '学校琐事'
    ];

    // 分类管理 - 固定6个，仅支持重命名
    const categories = {
        STORAGE_KEY: 'dsc_fixed_categories',

        getAll: () => {
            try {
                const saved = storage.get(categories.STORAGE_KEY, []);
                if (Array.isArray(saved) && saved.length === 6) {
                    return saved;
                } else {
                    categories.save(FIXED_CATEGORIES);
                    return [...FIXED_CATEGORIES];
                }
            } catch (e) {
                console.error('获取分类失败:', e);
                return [...FIXED_CATEGORIES];
            }
        },

        save: (cats) => {
            try {
                const catsToSave = Array.isArray(cats) ? cats.slice(0, 6) : [...FIXED_CATEGORIES];
                while (catsToSave.length < 6) {
                    catsToSave.push(FIXED_CATEGORIES[catsToSave.length]);
                }
                storage.set(categories.STORAGE_KEY, catsToSave);
                console.log('分类已保存:', catsToSave);
            } catch (e) {
                console.error('保存分类失败:', e);
            }
        },

        rename: (index, newName) => {
            try {
                const cats = categories.getAll();
                const trimmedName = newName.trim();
                if (!trimmedName) return false;

                if (cats.some((name, i) => i !== index && name === trimmedName)) {
                    return false;
                }

                cats[index] = trimmedName;
                categories.save(cats);
                console.log('分类已重命名:', index, trimmedName);
                return true;
            } catch (e) {
                console.error('重命名分类失败:', e);
                return false;
            }
        },

        getIndex: (categoryName) => {
            const cats = categories.getAll();
            return cats.indexOf(categoryName);
        }
    };

    // 缓存变量
    let collectionListCache = null;
    let categoriesListCache = null;
    let batchToolbarCache = null;
    let selectAllCheckboxCache = null;
    let selectedCountSpanCache = null;
    let searchInputCache = null;
    let sortSelectCache = null;

    function resetCaches() {
        collectionListCache = null;
        categoriesListCache = null;
        batchToolbarCache = null;
        selectAllCheckboxCache = null;
        selectedCountSpanCache = null;
        searchInputCache = null;
        sortSelectCache = null;
        console.log('缓存已重置');
    }

    const getContentLength = (content) => content ? content.length : 0;

    const getTitleFirstLetter = (title) => {
        if (!title) return '#';
        const firstChar = title.charAt(0);
        return /[a-zA-Z]/.test(firstChar) ? firstChar.toUpperCase() : '#';
    };

    function isGhostItem(value) {
        const isEmptyTitle = !value.title || value.title.trim() === '' ||
                            value.title === '---';
        const isEmptyContent = !value.content || value.content.trim() === '' ||
                              value.content === '-----' ||
                              value.content.length === 0;
        return isEmptyTitle && isEmptyContent;
    }

    const sortCollections = (collections, sortBy) => {
        return [...collections].sort((a, b) => {
            try {
                switch(sortBy) {
                    case 'time-desc':
                        return new Date(b.value.timestamp) - new Date(a.value.timestamp);
                    case 'time-asc':
                        return new Date(a.value.timestamp) - new Date(b.value.timestamp);
                    case 'length-desc':
                        return getContentLength(b.value.content) - getContentLength(a.value.content);
                    case 'length-asc':
                        return getContentLength(a.value.content) - getContentLength(b.value.content);
                    case 'title-asc':
                        return (a.value.title || '').localeCompare(b.value.title || '');
                    case 'title-desc':
                        return (b.value.title || '').localeCompare(a.value.title || '');
                    default:
                        return 0;
                }
            } catch (e) {
                console.error('排序错误:', e);
                return 0;
            }
        });
    };

    function isSameConversation(conv1, conv2) {
        try {
            const hash1 = hashCode(conv1.title + conv1.content);
            const hash2 = hashCode(conv2.title + conv2.content);
            return hash1 === hash2;
        } catch (e) {
            return false;
        }
    }

    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    function getCurrentConversation() {
        try {
            const messages = [];

            const selectors = [
                '.ds-markdown',
                '[class*="message-content"]',
                '[class*="chat-message"]',
                '.f6ed5067',
                '[data-testid="message"]'
            ];

            for (const selector of selectors) {
                const elements = document.querySelectorAll(selector);
                if (elements.length > 0) {
                    elements.forEach(el => {
                        if (!el.closest('button') && !el.closest('input') && !el.closest('textarea')) {
                            const clone = el.cloneNode(true);

                            const codeBlocks = clone.querySelectorAll('pre, code, .hljs, [class*="code-block"]');
                            codeBlocks.forEach(block => {
                                const placeholder = document.createElement('span');
                                placeholder.textContent = '[代码块]';
                                block.parentNode.replaceChild(placeholder, block);
                            });

                            const latexSelectors = [
                                '.katex', '.katex-display', '.katex-inline',
                                '[class*="math"]', '.MathJax', 'span[data-formula]',
                                'code.language-latex', '[class*="latex"]'
                            ];

                            for (const latexSelector of latexSelectors) {
                                const latexElements = clone.querySelectorAll(latexSelector);
                                latexElements.forEach(latexEl => {
                                    const placeholder = document.createElement('span');
                                    placeholder.textContent = '[LaTeX]';
                                    latexEl.parentNode.replaceChild(placeholder, latexEl);
                                });
                            }

                            const textNodes = [];
                            const walk = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
                            let node;
                            while (node = walk.nextNode()) {
                                textNodes.push(node);
                            }

                            textNodes.forEach(textNode => {
                                const text = textNode.textContent;
                                if (text && (text.includes('$$') || (text.includes('$') && !text.includes('[$]')))) {
                                    const hasLatex = /\$\$[^$]+\$\$|\$[^$]+\$/.test(text);
                                    if (hasLatex) {
                                        const placeholder = document.createElement('span');
                                        placeholder.textContent = '[LaTeX]';
                                        textNode.parentNode.replaceChild(placeholder, textNode);
                                    }
                                }
                            });

                            const text = clone.textContent.trim();
                            if (text && text.length > 5) {
                                messages.push(text);
                            }
                        }
                    });
                    if (messages.length > 0) break;
                }
            }

            if (messages.length === 0) {
                const mainContent = document.querySelector('main') || document.querySelector('[class*="chat-container"]');
                if (mainContent) {
                    const clone = mainContent.cloneNode(true);

                    const codeBlocks = clone.querySelectorAll('pre, code, .hljs, [class*="code-block"]');
                    codeBlocks.forEach(block => {
                        const placeholder = document.createElement('span');
                        placeholder.textContent = '[代码块]';
                        block.parentNode.replaceChild(placeholder, block);
                    });

                    const latexSelectors = ['.katex', '.MathJax', '[class*="math"]', '[class*="latex"]'];
                    for (const latexSelector of latexSelectors) {
                        const latexElements = clone.querySelectorAll(latexSelector);
                        latexElements.forEach(latexEl => {
                            const placeholder = document.createElement('span');
                            placeholder.textContent = '[LaTeX]';
                            latexEl.parentNode.replaceChild(placeholder, latexEl);
                        });
                    }

                    const text = clone.textContent.trim();
                    if (text && text.length > 5) {
                        messages.push(text);
                    }
                }
            }

            return messages.length > 0 ? messages.join('\n\n') : '无法预览对话内容，请手动点击查看';
        } catch (e) {
            console.error('获取对话内容失败:', e);
            return '获取对话内容失败';
        }
    }

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: PRIMARY_COLOR
    };

    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 80px;
        background-color: ${colors[type] || colors.info};
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 10000;
        animation: fadeOut 2s forwards;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2000);
}

    // 添加样式
    GM_addStyle(`
        @media (prefers-color-scheme: dark) {
            .dsc-modal-content {
                background-color: #1f2937;
                border: 1px solid #374151;
                color: #e5e7eb;
            }
            .dsc-search, .dsc-sort-select {
                background-color: #111827;
                border: 1px solid #374151;
                color: #e5e7eb;
            }
            .dsc-collection-item {
                background-color: #111827;
            }
            .dsc-category-item {
                border-bottom: 1px solid #374151;
            }
            .dsc-category-item:hover {
                background-color: #1f2937;
            }
            .dsc-category-item.active {
                background-color: ${PRIMARY_COLOR}20;
                border-left-color: ${PRIMARY_COLOR};
            }
            .dsc-batch-toolbar {
                background-color: #1f2937;
                border: 1px solid #374151;
            }
            .dsc-category-select {
                background-color: #1f2937;
                border-color: #4b5563;
                color: #e5e7eb;
            }
            .dsc-category-select:hover {
                border-color: ${PRIMARY_COLOR};
            }
            .dsc-category-select option {
                background-color: #1f2937;
                color: #e5e7eb;
            }
        }

        @media (prefers-color-scheme: light) {
            .dsc-modal-content {
                background-color: #ffffff;
                border: 1px solid #e5e7eb;
                color: #111827;
            }
            .dsc-search, .dsc-sort-select {
                background-color: #f9fafb;
                border: 1px solid #e5e7eb;
                color: #111827;
            }
            .dsc-collection-item {
                background-color: #f9fafb;
            }
            .dsc-category-item {
                border-bottom: 1px solid #e5e7eb;
            }
            .dsc-category-item:hover {
                background-color: #f3f4f6;
            }
            .dsc-category-item.active {
                background-color: ${PRIMARY_COLOR}10;
                border-left-color: ${PRIMARY_COLOR};
            }
            .dsc-batch-toolbar {
                background-color: #f3f4f6;
                border: 1px solid #e5e7eb;
            }
            .dsc-category-select {
                background-color: #ffffff;
                border-color: #d1d5db;
                color: #111827;
            }
            .dsc-category-select:hover {
                border-color: ${PRIMARY_COLOR};
            }
            .dsc-category-select option {
                background-color: #ffffff;
                color: #111827;
            }
        }

        .dsc-category-select {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            border: 1px solid;
            cursor: pointer;
            max-width: 120px;
            width: auto;
            flex-shrink: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            transition: border-color 0.2s;
        }

        .dsc-category-select:focus {
            outline: none;
            border-color: ${PRIMARY_COLOR};
            box-shadow: 0 0 0 2px ${PRIMARY_COLOR}20;
        }

        .dsc-modal {
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .dsc-modal-content {
            margin: 5% auto;
            padding: 20px;
            border-radius: 8px;
            width: 90%;
            max-width: 1000px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            border-top: 4px solid ${PRIMARY_COLOR};
        }

        .dsc-close {
            color: #aaa;
            float: right;
            font-size: 28px;
            font-weight: bold;
            cursor: pointer;
        }

        .dsc-close:hover {
            color: ${PRIMARY_COLOR};
        }

        .dsc-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid currentColor;
            opacity: 0.8;
        }

        .dsc-header h2 {
            color: ${PRIMARY_COLOR};
            margin: 0;
        }

        .dsc-main-layout {
            display: flex;
            gap: 20px;
            margin-bottom: 20px;
        }

        .dsc-categories-panel {
            width: 200px;
            flex-shrink: 0;
        }

        .dsc-categories-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .dsc-categories-header h3 {
            margin: 0;
            font-size: 1em;
            opacity: 0.7;
        }

        .dsc-categories-header span {
            font-size: 0.8em;
            color: ${PRIMARY_COLOR};
        }

        .dsc-categories-list {
            max-height: 400px;
            overflow-y: auto;
            overflow-x: hidden;
            word-break: break-word;
        }

        .dsc-category-item {
            padding: 10px 12px;
            margin-bottom: 4px;
            border-radius: 4px;
            cursor: pointer;
            display: flex;
            align-items: center;
            border-left: 3px solid transparent;
            transition: all 0.2s;
            position: relative;
            width: 100%;
            box-sizing: border-box;
        }

        .dsc-category-item span:first-child {
            flex: 1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .dsc-category-badge {
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 0.8em;
            background-color: ${PRIMARY_COLOR}20;
            color: ${PRIMARY_COLOR};
            margin-left: 5px;
            flex-shrink: 0;
        }

        .dsc-category-rename {
            opacity: 0;
            color: ${PRIMARY_COLOR};
            font-size: 12px;
            padding: 2px 5px;
            cursor: pointer;
            transition: opacity 0.2s;
            flex-shrink: 0;
        }

        .dsc-category-item:hover .dsc-category-rename {
            opacity: 1;
        }

        .dsc-category-rename:hover {
            color: ${PRIMARY_COLOR};
            transform: scale(1.1);
        }

        .dsc-content-panel {
            flex: 1;
            min-width: 0;
        }

        .dsc-toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
        }

        .dsc-search {
            padding: 8px 12px;
            border-radius: 4px;
            flex: 1;
            min-width: 200px;
            font-size: 14px;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }

        .dsc-search:focus {
            outline: none;
            border-color: ${PRIMARY_COLOR};
        }

        .dsc-sort-select {
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            max-width: 100%;
            box-sizing: border-box;
        }

        .dsc-batch-toolbar {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            padding: 10px;
            border-radius: 4px;
            align-items: center;
            flex-wrap: wrap;
            width: 100%;
            box-sizing: border-box;
        }

        .dsc-select-all {
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
            flex-shrink: 0;
        }

        .dsc-collection-list {
            max-height: 400px;
            overflow-y: auto;
            overflow-x: hidden !important;
            word-break: break-word;
            white-space: normal;
            width: 100%;
            box-sizing: border-box;
            padding-right: 8px;
        }

        .dsc-collection-list * {
            max-width: 100%;
            box-sizing: border-box;
            word-wrap: break-word;
            overflow-wrap: break-word;
        }

        .dsc-collection-item {
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 6px;
            border-left: 4px solid ${PRIMARY_COLOR};
            position: relative;
            cursor: pointer;
            transition: all 0.2s;
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }

        .dsc-collection-item:hover {
            opacity: 0.9;
            transform: translateX(2px);
        }

        .dsc-collection-item.selected {
            outline: 2px solid ${PRIMARY_COLOR};
            outline-offset: 2px;
        }

        .dsc-item-checkbox {
            position: absolute;
            left: -25px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            flex-shrink: 0;
        }

        .dsc-collection-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: ${PRIMARY_COLOR};
            display: flex;
            align-items: center;
            gap: 10px;
            flex-wrap: wrap;
            width: 100%;
            max-width: 100%;
        }

        .dsc-collection-title span:first-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
            min-width: 0;
        }

        .dsc-category-select {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            background-color: inherit;
            border: 1px solid currentColor;
            opacity: 0.7;
            color: inherit;
            cursor: pointer;
            max-width: 120px;
            width: auto;
            flex-shrink: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .dsc-collection-preview {
            font-size: 0.9em;
            margin-bottom: 8px;
            overflow: hidden;
            display: -webkit-box;
            -webkit-line-clamp: 3;
            -webkit-box-orient: vertical;
            word-break: break-word;
            width: 100%;
            max-width: 100%;
        }

        .dsc-collection-meta {
            display: flex;
            justify-content: space-between;
            font-size: 0.8em;
            opacity: 0.5;
            flex-wrap: wrap;
            gap: 5px;
            width: 100%;
            max-width: 100%;
        }

        .dsc-collection-meta span {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .dsc-actions {
            display: flex;
            gap: 10px;
            margin-top: 10px;
            flex-wrap: wrap;
            width: 100%;
            max-width: 100%;
        }

        .dsc-btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9em;
            transition: opacity 0.2s;
            flex-shrink: 0;
        }

        .dsc-btn-primary {
            background-color: ${PRIMARY_COLOR};
            color: white;
        }

        .dsc-btn-danger {
            background-color: #ef4444;
            color: white;
        }

        .dsc-btn:hover {
            opacity: 0.9;
        }

        .dsc-empty {
            text-align: center;
            padding: 20px;
            opacity: 0.5;
            width: 100%;
            box-sizing: border-box;
        }

        .dsc-button-container {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 9999;
        }

        .dsc-circle-btn {
            width: 50px;
            height: 50px;
            border-radius: 50%;
            border: none;
            font-size: 20px;
            cursor: pointer;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.2s;
        }

        .dsc-circle-btn:hover {
            transform: scale(1.1);
        }

        .dsc-save-btn {
            background-color: ${PRIMARY_COLOR};
            color: white;
        }

        .dsc-view-btn {
            background-color: ${PRIMARY_COLOR};
            color: white;
        }

        @keyframes fadeOut {
            0% { opacity: 1; }
            70% { opacity: 1; }
            100% { opacity: 0; }
        }

		.dsc-backup-modal {
            display: none;
            position: fixed;
            z-index: 10001;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
        }

        .dsc-backup-content {
            margin: 15% auto;
            padding: 25px;
            border-radius: 8px;
            width: 90%;
            max-width: 450px;
            background-color: var(--bg-color, #ffffff);
            border-top: 4px solid ${PRIMARY_COLOR};
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            position: relative;
            color: var(--text-color, #111827);
        }

        @media (prefers-color-scheme: dark) {
            .dsc-backup-content {
                --bg-color: #1f2937;
                --text-color: #e5e7eb;
                border: 1px solid #374151;
            }
        }

        .dsc-backup-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

        .dsc-backup-header h3 {
            margin: 0;
            color: ${PRIMARY_COLOR};
        }

        .dsc-backup-close {
            color: #aaa;
            font-size: 24px;
            cursor: pointer;
        }

        .dsc-backup-close:hover {
            color: ${PRIMARY_COLOR};
        }

        .dsc-backup-stats {
            background-color: ${PRIMARY_COLOR}10;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
        }

        .dsc-backup-stats p {
            margin: 8px 0;
            font-size: 1.1em;
        }

        .dsc-backup-stats .warning {
            color: #ef4444;
            font-weight: bold;
        }

        .dsc-backup-buttons {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .dsc-backup-btn {
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1em;
            transition: all 0.2s;
        }

        .dsc-backup-btn.export {
            background-color: ${PRIMARY_COLOR};
            color: white;
        }

        .dsc-backup-btn.import {
            background-color: #10b981;
            color: white;
        }

        .dsc-backup-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .dsc-backup-info {
            border-top: 1px solid currentColor;
            padding-top: 15px;
            margin-top: 15px;
            opacity: 0.8;
            font-size: 0.9em;
        }

        .dsc-backup-info p {
            margin: 5px 0;
        }

        .dsc-backup-email {
            color: ${PRIMARY_COLOR};
            font-weight: bold;
        }

        .dsc-backup-checkbox {
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 5px;
            cursor: pointer;
        }

        .dsc-backup-btn-icon {
            background-color: #f59e0b;
        }

        .dsc-item-checkbox {
            left: 5px !important;
            z-index: 10;
        }
        .dsc-collection-item {
            padding-left: 30px !important;
            position: relative;
        }

    `);

    // 全局变量
    let modal;
    let currentSearchTerm = '';
    let currentSortBy = 'time-desc';
    let currentCategory = 'all';
    let selectedItems = new Set();
    let isSaving = false; // 添加保存锁

    function renderCategories() {
        try {
            if (!modal) return;

            if (!categoriesListCache) {
                categoriesListCache = modal.querySelector('#dsc-categories-list');
            }
            const categoriesList = categoriesListCache;
            if (!categoriesList) return;

            const allCats = categories.getAll();
            const allCollections = storage.getAll();

            const validCollections = allCollections.filter(({ value }) => !isGhostItem(value));

            let html = `
                <div class="dsc-category-item ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
                    <span>📋 全部</span>
                    <span class="dsc-category-badge">${validCollections.length}</span>
                </div>
                <div class="dsc-category-item ${currentCategory === 'uncategorized' ? 'active' : ''}" data-category="uncategorized">
                    <span>📁 未分类</span>
                    <span class="dsc-category-badge">${validCollections.filter(({value}) => !value.category).length}</span>
                </div>
            `;

            allCats.forEach((cat, index) => {
                const count = validCollections.filter(({value}) => value.category === cat).length;
                html += `
                    <div class="dsc-category-item ${currentCategory === cat ? 'active' : ''}" data-category="${cat}" data-category-index="${index}">
                        <span>📁 ${cat}</span>
                        <span class="dsc-category-badge">${count}</span>
                        <span class="dsc-category-rename" title="重命名分类">✎</span>
                    </div>
                `;
            });

            categoriesList.innerHTML = html;

            const categoryItems = categoriesList.querySelectorAll('.dsc-category-item');
            categoryItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    if (e.target.classList.contains('dsc-category-rename')) {
                        return;
                    }

                    const category = item.dataset.category;
                    if (category) {
                        currentCategory = category;
                        renderCategories();
                        renderCollections();
                    }
                });
            });

            const renameButtons = categoriesList.querySelectorAll('.dsc-category-rename');
            renameButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();

                    const categoryItem = btn.closest('.dsc-category-item');
                    const categoryName = categoryItem.dataset.category;
                    const categoryIndex = categoryItem.dataset.categoryIndex;

                    if (categoryIndex === undefined) return;

                    const newName = prompt('请输入新的分类名称：', categoryName);
                    if (newName && newName.trim()) {
                        if (categories.rename(parseInt(categoryIndex), newName)) {
                            if (currentCategory === categoryName) {
                                currentCategory = newName;
                            }
                            renderCategories();
                            renderCollections();
                            showToast('✅ 分类重命名成功', 'success');
                        } else {
                            showToast('❌ 重命名失败（可能与其他分类重名）', 'error');
                        }
                    }
                });
            });

        } catch (e) {
            console.error('渲染分类失败:', e);
        }
    }

    function renderCollections() {
        try {
            if (!modal) return;

            if (!collectionListCache) {
                collectionListCache = modal.querySelector('#dsc-collection-list');
            }
            const collectionList = collectionListCache;
            if (!collectionList) return;

            const allCollections = storage.getAll();

            if (allCollections.length === 0) {
                collectionList.innerHTML = '<div class="dsc-empty">暂无收藏的对话</div>';
                const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                if (batchToolbar) {
                    batchToolbar.style.display = 'none';
                }
                return;
            }

            let filtered = allCollections.filter(({ value }) => {
                if (isGhostItem(value)) {
                    return false;
                }

                if (currentCategory === 'uncategorized') {
                    if (value.category) return false;
                } else if (currentCategory !== 'all') {
                    if (value.category !== currentCategory) return false;
                }

                if (currentSearchTerm) {
                    const searchLower = currentSearchTerm.toLowerCase();
                    return (value.title || '').toLowerCase().includes(searchLower) ||
                           (value.content || '').toLowerCase().includes(searchLower);
                }

                return true;
            });

            filtered = sortCollections(filtered, currentSortBy);

            if (filtered.length === 0) {
                collectionList.innerHTML = '<div class="dsc-empty">没有找到匹配的收藏</div>';
                const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                if (batchToolbar) {
                    batchToolbar.style.display = 'none';
                }
                return;
            }

            const allCats = categories.getAll();
            let html = '';

            filtered.forEach(({ key, value }) => {
                const date = value.timestamp ? new Date(value.timestamp).toLocaleString() : '---';
                const preview = value.content ? (value.content.length > 100 ? value.content.substring(0, 100) + '...' : value.content) : '-----';
                const length = getContentLength(value.content);

                let categoryOptions = '<option value="">未分类</option>';
                allCats.forEach(cat => {
                    const selected = value.category === cat ? 'selected' : '';
                    categoryOptions += `<option value="${cat}" ${selected}>${cat}</option>`;
                });

                html += `
                    <div class="dsc-collection-item ${selectedItems.has(key) ? 'selected' : ''}" data-key="${key}">
                        <input type="checkbox" class="dsc-item-checkbox" ${selectedItems.has(key) ? 'checked' : ''}>
                        <div class="dsc-collection-title">
                            <span>${value.title || '---'}</span>
                            <select class="dsc-category-select" data-key="${key}" title="选择分类">
                                ${categoryOptions}
                            </select>
                        </div>
                        <div class="dsc-collection-preview">${preview}</div>
                        <div class="dsc-collection-meta">
                            <span>📏 ${length} 字（不包括代码块 / Latex）</span>
                            <span>📅 ${date}</span>
                        </div>
                        <div class="dsc-actions">
                            <button class="dsc-btn dsc-btn-primary view-btn" data-url="${value.url || ''}">查看对话</button>
                            <button class="dsc-btn dsc-btn-danger delete-btn" data-key="${key}">从收藏移除</button>
                        </div>
                    </div>
                `;
            });

            collectionList.innerHTML = html;

            const newCollectionList = collectionList.cloneNode(false);
            newCollectionList.innerHTML = collectionList.innerHTML;
            collectionList.parentNode.replaceChild(newCollectionList, collectionList);

            collectionListCache = newCollectionList;

            newCollectionList.addEventListener('change', handleCollectionChange);
            newCollectionList.addEventListener('click', handleCollectionClick);

            updateBatchToolbar();

            if (selectedItems.size === 0) {
                const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                if (batchToolbar) {
                    batchToolbar.style.display = 'none';
                }
            }

        } catch (e) {
            console.error('渲染收藏列表失败:', e);
        }
    }

    function handleCollectionChange(e) {
        if (e.target.classList.contains('dsc-item-checkbox')) {
            const item = e.target.closest('.dsc-collection-item');
            const key = item.dataset.key;

            if (e.target.checked) {
                selectedItems.add(key);
                item.classList.add('selected');
            } else {
                selectedItems.delete(key);
                item.classList.remove('selected');
            }
            updateBatchToolbar();
        } else if (e.target.classList.contains('dsc-category-select')) {
            e.stopPropagation();
            const key = e.target.dataset.key;
            const newCategory = e.target.value;

            const collection = storage.getAll().find(c => c.key === key);
            if (collection) {
                collection.value.category = newCategory;
                storage.set(key, collection.value);
                renderCategories();
                showToast('✅ 分类已更新', 'success');
            }
        }
    }

    function handleCollectionClick(e) {
        if (e.target.classList.contains('view-btn')) {
            e.stopPropagation();
            e.preventDefault();

            const url = e.target.dataset.url;
            if (url && url !== window.location.href) {
                modal.style.display = 'none';
                selectedItems.clear();
                resetCaches();
                window.location.href = url;
            } else {
                showToast('当前已在对话页面', 'info');
            }
        } else if (e.target.classList.contains('delete-btn')) {
            e.stopPropagation();
            const key = e.target.dataset.key;
            if (confirm('确定要从收藏夹中移除这个项目吗？(这不会删除原始对话)')) {
                storage.remove(key);
                selectedItems.delete(key);
                renderCategories();
                renderCollections();

                if (selectedItems.size === 0) {
                    const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                    if (batchToolbar) {
                        batchToolbar.style.display = 'none';
                    }

                    const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                        selectAllCheckbox.indeterminate = false;
                    }
                }

                showToast('✅ 已从收藏移除', 'success');
            }
        } else if (e.target.closest('.dsc-collection-item') &&
                 !e.target.classList.contains('dsc-item-checkbox') &&
                 !e.target.classList.contains('view-btn') &&
                 !e.target.classList.contains('delete-btn') &&
                 !e.target.classList.contains('dsc-category-select')) {

            const item = e.target.closest('.dsc-collection-item');
            const checkbox = item.querySelector('.dsc-item-checkbox');
            checkbox.checked = !checkbox.checked;
            const changeEvent = new Event('change', { bubbles: true });
            checkbox.dispatchEvent(changeEvent);
        }
    }

    function updateBatchToolbar() {
        try {
            if (!modal) return;

            const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
            const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
            const selectedCountSpan = modal.querySelector('#dsc-selected-count-batch');

            batchToolbarCache = batchToolbar;
            selectAllCheckboxCache = selectAllCheckbox;
            selectedCountSpanCache = selectedCountSpan;

            if (!batchToolbar || !selectedCountSpan) return;

            if (selectedItems.size > 0) {
                batchToolbar.style.display = 'flex';
                selectedCountSpan.textContent = selectedItems.size;
            } else {
                batchToolbar.style.display = 'none';
            }

            if (selectAllCheckbox) {
                const totalItems = modal.querySelectorAll('.dsc-collection-item').length;
                selectAllCheckbox.checked = selectedItems.size === totalItems && totalItems > 0;
                selectAllCheckbox.indeterminate = selectedItems.size > 0 && selectedItems.size < totalItems;
            }
        } catch (e) {
            console.error('更新批量工具栏失败:', e);
        }
    }

    function createModal() {
        try {
            const modal = document.createElement('div');
            modal.className = 'dsc-modal';
            modal.innerHTML = `
                <div class="dsc-modal-content">
                    <span class="dsc-close">&times;</span>
                    <div class="dsc-header">
                        <h2>📚 收藏管理器</h2>
                    </div>

                    <div class="dsc-main-layout">
                        <div class="dsc-categories-panel">
                            <div class="dsc-categories-header">
                                <h3>📁 分类（全部+未分类+6个）</h3>
                            </div>
                            <div class="dsc-categories-list" id="dsc-categories-list"></div>
                        </div>

                        <div class="dsc-content-panel">
                            <div class="dsc-toolbar">
                                <input type="text" class="dsc-search" placeholder="搜索收藏内容...">
                                <select class="dsc-sort-select" id="dsc-sort-select">
                                    <option value="time-desc">⏰ 时间新-旧</option>
                                    <option value="time-asc">⏰ 时间旧-新</option>
                                    <option value="length-desc">📏 字数多-少</option>
                                    <option value="length-asc">📏 字数少-多</option>
                                    <option value="title-asc">🔤 标题 A-Z</option>
                                    <option value="title-desc">🔤 标题 Z-A</option>
                                </select>
                            </div>

                            <div class="dsc-batch-toolbar" id="dsc-batch-toolbar" style="display: none;">
                                <label class="dsc-select-all">
                                    <input type="checkbox" id="dsc-select-all-checkbox"> 全选
                                </label>
                                <span>已选中 <span id="dsc-selected-count-batch">0</span> 项</span>
                                <button class="dsc-btn dsc-btn-danger" id="dsc-batch-delete-btn">删除选中</button>
                                <button class="dsc-btn dsc-btn-primary" id="dsc-cancel-select-btn">取消选择</button>
                            </div>

                            <div class="dsc-collection-list" id="dsc-collection-list"></div>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        } catch (e) {
            console.error('创建模态框失败:', e);
            return null;
        }
    }

// 修改 saveCurrentConversation 函数
function saveCurrentConversation() {
    // 如果正在保存中，直接返回
    if (isSaving) {
        showToast('⏳ 正在保存中，请稍候...', 'info');
        return;
    }

    try {
        isSaving = true; // 锁定

        if (!window.location.href.includes('chat.deepseek.com')) {
            showToast('⚠️ 请在DeepSeek聊天页面使用', 'error');
            return;
        }

        const title = document.title.replace(' - DeepSeek', '') || 'DeepSeek对话';
        const content = getCurrentConversation();
        const url = window.location.href;
        const timestamp = new Date().toISOString();

        const allCollections = storage.getAll();
        const newHash = hashCode(title + content);

        const existingCollection = allCollections.find(({ value }) => {
            const existingHash = hashCode(value.title + value.content);
            return existingHash === newHash;
        });

        if (existingCollection) {
            existingCollection.value.timestamp = timestamp;
            existingCollection.value.url = url;
            storage.set(existingCollection.key, existingCollection.value);
            showToast('🔄 已更新现有收藏的时间', 'success');
        } else {
            const key = `dsc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const conversation = {
                title,
                content,
                url,
                timestamp,
                category: ''
            };
            storage.set(key, conversation);
            showToast('✅ 对话已添加到收藏', 'success');
        }
    } catch (e) {
        console.error('保存对话失败:', e);
        showToast('❌ 保存失败: ' + e.message, 'error');
    } finally {
        // 延迟释放锁，防止快速连点
        setTimeout(() => {
            isSaving = false;
        }, 500);
    }
}

    function createButtonContainer() {
        try {
            const container = document.createElement('div');
            container.className = 'dsc-button-container';

            const backupButton = document.createElement('button');
            backupButton.className = 'dsc-circle-btn dsc-save-btn';
            backupButton.innerHTML = '💾';
            backupButton.title = '备份管理';
            backupButton.addEventListener('click', () => {
                showBackupModal();
            });

            const viewButton = document.createElement('button');
            viewButton.className = 'dsc-circle-btn dsc-view-btn';
            viewButton.innerHTML = '📚';
            viewButton.title = '查看收藏对话';
            viewButton.addEventListener('click', () => {
                if (modal) {
                    modal.style.display = 'block';
                    resetCaches();
                    renderCategories();
                    renderCollections();
                }
            });

            const saveButton = document.createElement('button');
            saveButton.className = 'dsc-circle-btn dsc-save-btn';
            saveButton.innerHTML = '⭐';
            saveButton.title = '收藏当前对话';
            saveButton.addEventListener('click', saveCurrentConversation);

            container.appendChild(backupButton);
            container.appendChild(viewButton);
            container.appendChild(saveButton);
            document.body.appendChild(container);

            return container;
        } catch (e) {
            console.error('创建按钮容器失败:', e);
            return null;
        }
    }

    function createBackupModal() {
        try {
            const modal = document.createElement('div');
            modal.className = 'dsc-backup-modal';
            modal.id = 'dsc-backup-modal';
            modal.innerHTML = `
                <div class="dsc-backup-content">
                    <div class="dsc-backup-header">
                        <h3>💾 数据备份（.json格式）</h3>
                        <span class="dsc-backup-close">&times;</span>
                    </div>

                    <div class="dsc-backup-stats" id="dsc-backup-stats">
                        <p>⏰ 距离上一次备份的天数：<span id="dsc-days-since-backup">0</span> </p>
                        <p>📊 当前共有 <span id="dsc-unbacked-count" class="warning">0</span> 条收藏未备份</p>
                    </div>

                    <div class="dsc-backup-buttons">
                        <button class="dsc-backup-btn export" id="dsc-export-btn">📤 导出数据</button>
                        <button class="dsc-backup-btn import" id="dsc-import-btn">📥 导入数据</button>
                    </div>

                    <div class="dsc-backup-info">
                        <p><strong>📌 有同学要问了：为什么要备份呢？</strong></p>
                        <p>因为：</p>
                        <p>1. 重装浏览器会清除数据</p>
                        <p>2. 更换设备时需要迁移数据</p>
                        <p>3. 而且备份可以防止收藏数据意外丢失哦~</p>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        } catch (e) {
            console.error('创建备份弹窗失败:', e);
            return null;
        }
    }

    function getUnbackedCount() {
        try {
            const allCollections = storage.getAll();
            const lastBackupTime = storage.getLastBackupTime();

            if (lastBackupTime === 0) return allCollections.length;

            return allCollections.filter(({ value }) => {
                const itemTime = new Date(value.timestamp).getTime();
                return itemTime > lastBackupTime;
            }).length;
        } catch (e) {
            console.error('获取未备份数量失败:', e);
            return 0;
        }
    }

    function getDaysSinceLastBackup() {
        try {
            const lastBackupTime = storage.getLastBackupTime();
            if (lastBackupTime === 0) return 999;

            const now = Date.now();
            const diffMs = now - lastBackupTime;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            return diffDays;
        } catch (e) {
            console.error('计算备份天数失败:', e);
            return 0;
        }
    }

    function updateBackupModal() {
        try {
            const backupModal = document.getElementById('dsc-backup-modal');
            if (!backupModal) return;

            const daysSpan = backupModal.querySelector('#dsc-days-since-backup');
            const countSpan = backupModal.querySelector('#dsc-unbacked-count');

            const days = getDaysSinceLastBackup();
            const unbackedCount = getUnbackedCount();

            if (daysSpan) {
                daysSpan.textContent = days === 999 ? '从未' : days;
            }
            if (countSpan) {
                countSpan.textContent = unbackedCount;
                countSpan.className = unbackedCount > 0 ? 'warning' : '';
            }
        } catch (e) {
            console.error('更新备份弹窗失败:', e);
        }
    }

    function showBackupModal() {
        try {
            let backupModal = document.getElementById('dsc-backup-modal');
            if (!backupModal) {
                backupModal = createBackupModal();
            }

            if (!backupModal) return;

            updateBackupModal();
            backupModal.style.display = 'block';

            const closeBtn = backupModal.querySelector('.dsc-backup-close');
            if (closeBtn) {
                closeBtn.onclick = () => {
                    backupModal.style.display = 'none';
                };
            }

            backupModal.onclick = (e) => {
                if (e.target === backupModal) {
                    backupModal.style.display = 'none';
                }
            };

            const exportBtn = backupModal.querySelector('#dsc-export-btn');
            if (exportBtn) {
                exportBtn.onclick = () => {
                    exportBackup();
                };
            }

            const importBtn = backupModal.querySelector('#dsc-import-btn');
            if (importBtn) {
                importBtn.onclick = () => {
                    importBackup();
                };
            }

        } catch (e) {
            console.error('显示备份弹窗失败:', e);
        }
    }

    function exportBackup() {
        try {
            const allCollections = storage.getAll();
            const cats = categories.getAll();

            const backupData = {
                version: '1.1.0',
                exportTime: Date.now(),
                categories: cats,
                collections: allCollections.map(item => ({
                    key: item.key,
                    ...item.value
                }))
            };

            const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `deepseek-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            storage.setLastBackupTime(Date.now());
            updateBackupModal();
            showToast('✅ 备份导出成功', 'success');

            const backupModal = document.getElementById('dsc-backup-modal');
            if (backupModal) {
                backupModal.style.display = 'none';
            }

        } catch (e) {
            console.error('导出备份失败:', e);
            showToast('❌ 导出失败', 'error');
        }
    }

    function importBackup() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';

            input.onchange = (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const backupData = JSON.parse(e.target.result);

                        if (!backupData.collections || !Array.isArray(backupData.collections)) {
                            throw new Error('无效的备份文件格式');
                        }

                        if (!confirm(`确定要导入 ${backupData.collections.length} 条收藏吗？现有数据将会被合并。`)) {
                            return;
                        }

                        backupData.collections.forEach(item => {
                            const key = item.key || `dsc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                            const { key: _, ...value } = item;
                            storage.set(key, value);
                        });

                        if (backupData.categories && Array.isArray(backupData.categories) && backupData.categories.length === 6) {
                            categories.save(backupData.categories);
                        }

                        storage.setLastBackupTime(Date.now());

                        renderCategories();
                        renderCollections();
                        updateBackupModal();

                        showToast('✅ 导入成功', 'success');

                        const backupModal = document.getElementById('dsc-backup-modal');
                        if (backupModal) {
                            backupModal.style.display = 'none';
                        }

                    } catch (error) {
                        console.error('解析备份文件失败:', error);
                        showToast('❌ 备份文件格式错误', 'error');
                    }
                };
                reader.readAsText(file);
            };

            input.click();

        } catch (e) {
            console.error('导入备份失败:', e);
            showToast('❌ 导入失败', 'error');
        }
    }

    function init() {
        try {
            console.log('初始化脚本...');

            modal = createModal();
            if (!modal) {
                console.error('创建模态框失败');
                return;
            }

            categories.getAll();
            createBackupModal();

            const closeBtn = modal.querySelector('.dsc-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    resetCaches();
                    selectedItems.clear();
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    resetCaches();
                    selectedItems.clear();
                }
            });

            const searchInput = modal.querySelector('.dsc-search');
            let searchTimeout;
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        currentSearchTerm = e.target.value;
                        renderCollections();
                    }, 500);
                });
            }

            const sortSelect = modal.querySelector('#dsc-sort-select');
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    currentSortBy = e.target.value;
                    renderCollections();
                });
            }

            const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
            if (selectAllCheckbox) {
                selectAllCheckbox.addEventListener('change', (e) => {
                    const collectionItems = modal.querySelectorAll('.dsc-collection-item');
                    collectionItems.forEach(item => {
                        const key = item.dataset.key;
                        const checkbox = item.querySelector('.dsc-item-checkbox');
                        if (e.target.checked) {
                            selectedItems.add(key);
                            item.classList.add('selected');
                            if (checkbox) checkbox.checked = true;
                        } else {
                            selectedItems.delete(key);
                            item.classList.remove('selected');
                            if (checkbox) checkbox.checked = false;
                        }
                    });
                    updateBatchToolbar();
                });
            }

            const batchDeleteBtn = modal.querySelector('#dsc-batch-delete-btn');
            if (batchDeleteBtn) {
                batchDeleteBtn.addEventListener('click', () => {
                    if (selectedItems.size === 0) return;

                    const message = selectedItems.size === 1
                        ? '确定要从收藏夹中移除这个项目吗？(这不会删除原始对话)'
                        : `确定要从收藏夹中移除选中的 ${selectedItems.size} 个项目吗？(这不会删除原始对话)`;

                    if (confirm(message)) {
                        const itemsToDelete = Array.from(selectedItems);
                        itemsToDelete.forEach(key => {
                            storage.remove(key);
                        });
                        selectedItems.clear();
                        renderCategories();
                        renderCollections();

                        const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                        if (batchToolbar) {
                            batchToolbar.style.display = 'none';
                        }

                        const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
                        if (selectAllCheckbox) {
                            selectAllCheckbox.checked = false;
                            selectAllCheckbox.indeterminate = false;
                        }

                        showToast('✅ 删除成功', 'success');
                    }
                });
            }

            const cancelSelectBtn = modal.querySelector('#dsc-cancel-select-btn');
            if (cancelSelectBtn) {
                cancelSelectBtn.addEventListener('click', () => {
                    selectedItems.clear();
                    renderCollections();

                    const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
                    if (batchToolbar) {
                        batchToolbar.style.display = 'none';
                    }

                    const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
                    if (selectAllCheckbox) {
                        selectAllCheckbox.checked = false;
                        selectAllCheckbox.indeterminate = false;
                    }
                });
            }

            createButtonContainer();
            console.log('初始化完成');

        } catch (e) {
            console.error('初始化失败:', e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();