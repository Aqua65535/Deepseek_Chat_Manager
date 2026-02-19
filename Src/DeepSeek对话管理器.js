// ==UserScript==
// @name         DeepSeek对话管理器
// @namespace    http://tampermonkey.net/
// @version      1.0.0
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

/*
原脚本：DeepSeek对话收藏器 (v1.0.1) by berry22jelly
原脚本地址：http://greasyfork.icu/zh-CN/scripts/548318-deepseek对话收藏器

修改说明：
1. 在原脚本基础上增加了分类管理功能
2. 重构了UI界面，支持深浅主题
3. 增加了批量操作、排序、搜索等功能
4. 优化了代码结构和性能

本修改版本遵循原脚本的MIT许可证，欢迎自由使用和修改。
*/

//感谢原作者berry22jelly！(´▽`ʃ♡ƪ)

(function() {
    'use strict';

    console.log('DeepSeek收藏器脚本 v1.0.0 已加载！');

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
        remove: (key) => GM_deleteValue(key)
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
        // 存储分类名称的键名
        STORAGE_KEY: 'dsc_fixed_categories',

        // 获取所有分类（始终返回6个）
        getAll: () => {
            try {
                const saved = storage.get(categories.STORAGE_KEY, []);
                // 确保始终返回6个分类
                if (Array.isArray(saved) && saved.length === 6) {
                    return saved;
                } else {
                    // 如果保存的不是6个或不存在，则初始化为默认值
                    categories.save(FIXED_CATEGORIES);
                    return [...FIXED_CATEGORIES];
                }
            } catch (e) {
                console.error('获取分类失败:', e);
                return [...FIXED_CATEGORIES];
            }
        },

        // 保存分类（始终保存6个）
        save: (cats) => {
            try {
                // 强制确保只有6个
                const catsToSave = Array.isArray(cats) ? cats.slice(0, 6) : [...FIXED_CATEGORIES];
                // 如果不足6个，用默认值补全
                while (catsToSave.length < 6) {
                    catsToSave.push(FIXED_CATEGORIES[catsToSave.length]);
                }
                storage.set(categories.STORAGE_KEY, catsToSave);
                console.log('分类已保存:', catsToSave);
            } catch (e) {
                console.error('保存分类失败:', e);
            }
        },

        // 重命名分类
        rename: (index, newName) => {
            try {
                const cats = categories.getAll();
                const trimmedName = newName.trim();
                if (!trimmedName) return false;

                // 检查是否与其他分类重名（除了自己）
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

        // 获取分类对应的索引
        getIndex: (categoryName) => {
            const cats = categories.getAll();
            return cats.indexOf(categoryName);
        }
    };

    // 计算对话长度
    const getContentLength = (content) => content ? content.length : 0;

    // 获取标题首字母
    const getTitleFirstLetter = (title) => {
        if (!title) return '#';
        const firstChar = title.charAt(0);
        return /[a-zA-Z]/.test(firstChar) ? firstChar.toUpperCase() : '#';
    };

    // 排序函数
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

    // 检查是否是同一个对话（使用哈希）
    function isSameConversation(conv1, conv2) {
        try {
            const hash1 = hashCode(conv1.title + conv1.content);
            const hash2 = hashCode(conv2.title + conv2.content);
            return hash1 === hash2;
        } catch (e) {
            return false;
        }
    }

    // 工具函数：生成内容哈希
    function hashCode(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

// 获取当前对话内容
// 获取当前对话内容
function getCurrentConversation() {
    try {
        const messages = [];

        // DeepSeek特定的选择器
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
                        // 克隆节点，避免修改原始DOM
                        const clone = el.cloneNode(true);

                        // 处理代码块 - 替换为 [代码块] 标记
                        const codeBlocks = clone.querySelectorAll('pre, code, .hljs, [class*="code-block"]');
                        codeBlocks.forEach(block => {
                            const placeholder = document.createElement('span');
                            placeholder.textContent = '[代码块]';
                            block.parentNode.replaceChild(placeholder, block);
                        });

                        // 处理LaTeX公式 - 替换为 [LaTeX] 标记
                        // DeepSeek可能使用的LaTeX相关选择器
                        const latexSelectors = [
                            '.katex',  // KaTeX渲染的公式
                            '.katex-display', // 行间公式
                            '.katex-inline', // 行内公式
                            '[class*="math"]', // 包含math的类名
                            '.MathJax', // MathJax渲染的公式
                            'span[data-formula]', // 可能的数据属性
                            'code.language-latex', // LaTeX代码块
                            '[class*="latex"]' // 包含latex的类名
                        ];

                        for (const latexSelector of latexSelectors) {
                            const latexElements = clone.querySelectorAll(latexSelector);
                            latexElements.forEach(latexEl => {
                                const placeholder = document.createElement('span');
                                placeholder.textContent = '[LaTeX]';
                                latexEl.parentNode.replaceChild(placeholder, latexEl);
                            });
                        }

                        // 另外处理常见的LaTeX模式：$...$ 和 $$...$$
                        // 但注意不要重复处理已经被替换的元素
                        const textNodes = [];
                        const walk = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT, null, false);
                        let node;
                        while (node = walk.nextNode()) {
                            textNodes.push(node);
                        }

                        textNodes.forEach(textNode => {
                            const text = textNode.textContent;
                            // 检查是否包含LaTeX标记（$...$ 或 $$...$$）
                            if (text && (text.includes('$$') || (text.includes('$') && !text.includes('[$]')))) {
                                // 简单的正则匹配，实际可能更复杂，这里仅作示例
                                const hasLatex = /\$\$[^$]+\$\$|\$[^$]+\$/.test(text);
                                if (hasLatex) {
                                    // 将包含LaTeX的文本节点替换为标记
                                    const placeholder = document.createElement('span');
                                    placeholder.textContent = '[LaTeX]';
                                    textNode.parentNode.replaceChild(placeholder, textNode);
                                }
                            }
                        });

                        // 获取处理后的文本
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

                // 同样处理主内容中的代码块和LaTeX
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

    // 显示提示
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            info: PRIMARY_COLOR
        };

        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
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
            /* 新增：让分类下拉菜单也适配深色主题 */
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
            /* 新增：让分类下拉菜单也适配浅色主题 */
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

        /* 添加基础样式，确保在所有情况下都能良好显示 */
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
            overflow-x: hidden !important;  /* 彻底禁用水平滚动条 */
            word-break: break-word;
            white-space: normal;
            width: 100%;
            box-sizing: border-box;
            padding-right: 8px;  /* 为垂直滚动条留出空间 */
        }

        /* 确保所有子元素不溢出 */
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
            min-width: 0;  /* 允许flex项收缩 */
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
            max-width: 120px;  /* 限制最大宽度 */
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
    `);

    // 全局变量
    let modal;
    let currentSearchTerm = '';
    let currentSortBy = 'time-desc';
    let currentCategory = 'all';
    let selectedItems = new Set();

    // 渲染分类（固定6个，支持重命名）
    function renderCategories() {
        try {
            if (!modal) return;

            const categoriesList = modal.querySelector('#dsc-categories-list');
            if (!categoriesList) return;

            const allCats = categories.getAll();
            const allCollections = storage.getAll();

            let html = `
                <div class="dsc-category-item ${currentCategory === 'all' ? 'active' : ''}" data-category="all">
                    <span>📋 全部</span>
                    <span class="dsc-category-badge">${allCollections.length}</span>
                </div>
                <div class="dsc-category-item ${currentCategory === 'uncategorized' ? 'active' : ''}" data-category="uncategorized">
                    <span>📁 默认</span>
                    <span class="dsc-category-badge">${allCollections.filter(({value}) => !value.category).length}</span>
                </div>
            `;

            // 渲染固定的6个分类
            allCats.forEach((cat, index) => {
                const count = allCollections.filter(({value}) => value.category === cat).length;
                html += `
                    <div class="dsc-category-item ${currentCategory === cat ? 'active' : ''}" data-category="${cat}" data-category-index="${index}">
                        <span>📁 ${cat}</span>
                        <span class="dsc-category-badge">${count}</span>
                        <span class="dsc-category-rename" title="重命名分类">✎</span>
                    </div>
                `;
            });

            categoriesList.innerHTML = html;

            // 为每个分类项添加点击事件（选择分类）
            const categoryItems = categoriesList.querySelectorAll('.dsc-category-item');
            categoryItems.forEach(item => {
                item.addEventListener('click', (e) => {
                    // 如果点击的是重命名按钮，不处理分类选择
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

            // 为每个重命名按钮添加事件
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
                            // 如果当前选中的是这个分类，更新currentCategory
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

    // 渲染收藏列表
    function renderCollections() {
        try {
            if (!modal) return;

            const collectionList = modal.querySelector('#dsc-collection-list');
            if (!collectionList) return;

            const allCollections = storage.getAll();

            if (allCollections.length === 0) {
                collectionList.innerHTML = '<div class="dsc-empty">暂无收藏的对话</div>';
                return;
            }

            // 筛选
            let filtered = allCollections.filter(({ value }) => {
                // 分类筛选
                if (currentCategory === 'uncategorized') {
                    if (value.category) return false;
                } else if (currentCategory !== 'all') {
                    if (value.category !== currentCategory) return false;
                }

                // 搜索筛选
                if (currentSearchTerm) {
                    const searchLower = currentSearchTerm.toLowerCase();
                    return (value.title || '').toLowerCase().includes(searchLower) ||
                           (value.content || '').toLowerCase().includes(searchLower);
                }

                return true;
            });

            // 排序
            filtered = sortCollections(filtered, currentSortBy);

            if (filtered.length === 0) {
                collectionList.innerHTML = '<div class="dsc-empty">没有找到匹配的收藏</div>';
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
                            <span>📏 ${length} 字</span>
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

            // 为每个收藏项添加事件监听
            const collectionItems = collectionList.querySelectorAll('.dsc-collection-item');
            collectionItems.forEach(item => {
                const key = item.dataset.key;
                const checkbox = item.querySelector('.dsc-item-checkbox');

                // 点击复选框
                checkbox.addEventListener('change', (e) => {
                    e.stopPropagation();
                    if (checkbox.checked) {
                        selectedItems.add(key);
                        item.classList.add('selected');
                    } else {
                        selectedItems.delete(key);
                        item.classList.remove('selected');
                    }
                    updateBatchToolbar();
                });

                // 点击收藏项（除了按钮和复选框）
                item.addEventListener('click', (e) => {
                    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                        return;
                    }

                    checkbox.checked = !checkbox.checked;
                    const changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                });
            });

            // 查看按钮
            collectionList.querySelectorAll('.view-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                     e.preventDefault();

                    const url = btn.dataset.url;
                    if (url && url !== window.location.href) {
                        modal.style.display = 'none';
                        selectedItems.clear();
                        window.location.href = url;
                    } else {
                        showToast('当前已在对话页面', 'info');
                    }
                });
            });

            // 删除按钮
            collectionList.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const key = btn.dataset.key;
                    if (confirm('确定要从收藏夹中移除这个项目吗？(这不会删除原始对话)')) {
                        storage.remove(key);
                        selectedItems.delete(key);
                        renderCategories();
                        renderCollections();
                        showToast('✅ 已从收藏移除', 'success');
                    }
                });
            });

            // 分类选择器
            collectionList.querySelectorAll('.dsc-category-select').forEach(select => {
                select.addEventListener('change', (e) => {
                    e.stopPropagation();
                    const key = select.dataset.key;
                    const newCategory = select.value;

                    const collection = storage.getAll().find(c => c.key === key);
                    if (collection) {
                        collection.value.category = newCategory;
                        storage.set(key, collection.value);
                        renderCategories();
                        showToast('✅ 分类已更新', 'success');
                    }
                });
            });

            updateBatchToolbar();

        } catch (e) {
            console.error('渲染收藏列表失败:', e);
        }
    }

    // 更新批量操作工具栏
    function updateBatchToolbar() {
        try {
            if (!modal) return;

            const batchToolbar = modal.querySelector('#dsc-batch-toolbar');
            const selectAllCheckbox = modal.querySelector('#dsc-select-all-checkbox');
            const selectedCountSpan = modal.querySelector('#dsc-selected-count-batch');

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

    // 创建模态框
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
                                <h3>📁 分类（固定1+6个）</h3>
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

    // 保存当前对话
    function saveCurrentConversation() {
        try {
            const title = document.title.replace(' - DeepSeek', '') || 'DeepSeek对话';
            const content = getCurrentConversation();
            const url = window.location.href;
            const timestamp = new Date().toISOString();

            // 检查是否已存在相同对话
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
            showToast('❌ 保存失败', 'error');
        }
    }

    // 创建右下角按钮
    function createButtonContainer() {
        try {
            const container = document.createElement('div');
            container.className = 'dsc-button-container';

            const viewButton = document.createElement('button');
            viewButton.className = 'dsc-circle-btn dsc-view-btn';
            viewButton.innerHTML = '📚';
            viewButton.title = '查看收藏对话';
            viewButton.addEventListener('click', () => {
                if (modal) {
                    modal.style.display = 'block';
                    renderCategories();
                    renderCollections();
                }
            });

            const saveButton = document.createElement('button');
            saveButton.className = 'dsc-circle-btn dsc-save-btn';
            saveButton.innerHTML = '⭐';
            saveButton.title = '收藏当前对话';
            saveButton.addEventListener('click', saveCurrentConversation);

            container.appendChild(viewButton);
            container.appendChild(saveButton);
            document.body.appendChild(container);

            return container;
        } catch (e) {
            console.error('创建按钮容器失败:', e);
            return null;
        }
    }

    // 初始化
    function init() {
        try {
            console.log('初始化脚本...');

            modal = createModal();
            if (!modal) {
                console.error('创建模态框失败');
                return;
            }

            // 初始化分类（确保有6个）
            categories.getAll();

            // 模态框关闭事件
            const closeBtn = modal.querySelector('.dsc-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.style.display = 'none';
                    selectedItems.clear();
                });
            }

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.style.display = 'none';
                    selectedItems.clear();
                }
            });

            // 搜索功能（带防抖）
            const searchInput = modal.querySelector('.dsc-search');
            let searchTimeout;
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        currentSearchTerm = e.target.value;
                        renderCollections();
                    }, 300);
                });
            }

            // 排序功能
            const sortSelect = modal.querySelector('#dsc-sort-select');
            if (sortSelect) {
                sortSelect.addEventListener('change', (e) => {
                    currentSortBy = e.target.value;
                    renderCollections();
                });
            }

            // 全选复选框
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

            // 批量删除
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
                        showToast('✅ 删除成功', 'success');
                    }
                });
            }

            // 取消选择
            const cancelSelectBtn = modal.querySelector('#dsc-cancel-select-btn');
            if (cancelSelectBtn) {
                cancelSelectBtn.addEventListener('click', () => {
                    selectedItems.clear();
                    renderCollections();
                });
            }

            createButtonContainer();
            console.log('初始化完成');

        } catch (e) {
            console.error('初始化失败:', e);
        }
    }

    // 等待DOM加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();