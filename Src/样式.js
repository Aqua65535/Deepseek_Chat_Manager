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