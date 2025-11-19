/**
 * Backlog.md Config Parser
 *
 * This parser implementation is copied verbatim from the official Backlog.md project:
 * Source: https://github.com/MrLesk/Backlog.md/blob/main/src/file-system/operations.ts
 * License: MIT
 *
 * This is a temporary solution with precedent in this codebase. We hope the Backlog.md
 * maintainers will eventually publish this as a separate npm package that can be imported.
 *
 * The official Backlog.md project uses a custom line-by-line parser instead of a YAML library,
 * which handles their config format more reliably than standard YAML parsers.
 */

import type { BacklogConfig } from './types';

const DEFAULT_STATUSES = ['To Do', 'In Progress', 'Done'];

/**
 * Parse Backlog.md config.yml content using the official parser logic
 * Copied from: https://github.com/MrLesk/Backlog.md/blob/main/src/file-system/operations.ts
 */
export function parseBacklogConfig(content: string): BacklogConfig {
    // Internal config structure (camelCase as used by Backlog.md)
    const config: Partial<{
        projectName: string;
        defaultAssignee?: string;
        defaultReporter?: string;
        defaultStatus?: string;
        statuses: string[];
        labels: string[];
        milestones: string[];
        dateFormat?: string;
        maxColumnWidth?: number;
        defaultEditor?: string;
        autoOpenBrowser?: boolean;
        defaultPort?: number;
        remoteOperations?: boolean;
        autoCommit?: boolean;
        zeroPaddedIds?: number;
        bypassGitHooks?: boolean;
        checkActiveBranches?: boolean;
        activeBranchDays?: number;
    }> = {};

    const lines = content.split("\n");

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;

        const colonIndex = trimmed.indexOf(":");
        if (colonIndex === -1) continue;

        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();

        switch (key) {
            case "project_name":
                config.projectName = value.replace(/['"]/g, "");
                break;
            case "default_assignee":
                config.defaultAssignee = value.replace(/['"]/g, "");
                break;
            case "default_reporter":
                config.defaultReporter = value.replace(/['"]/g, "");
                break;
            case "default_status":
                config.defaultStatus = value.replace(/['"]/g, "");
                break;
            case "statuses":
            case "labels":
            case "milestones":
                if (value.startsWith("[") && value.endsWith("]")) {
                    const arrayContent = value.slice(1, -1);
                    config[key] = arrayContent
                        .split(",")
                        .map((item) => item.trim().replace(/['"]/g, ""))
                        .filter(Boolean);
                }
                break;
            case "date_format":
                config.dateFormat = value.replace(/['"]/g, "");
                break;
            case "max_column_width":
                config.maxColumnWidth = Number.parseInt(value, 10);
                break;
            case "default_editor":
                config.defaultEditor = value.replace(/["']/g, "");
                break;
            case "auto_open_browser":
                config.autoOpenBrowser = value.toLowerCase() === "true";
                break;
            case "default_port":
                config.defaultPort = Number.parseInt(value, 10);
                break;
            case "remote_operations":
                config.remoteOperations = value.toLowerCase() === "true";
                break;
            case "auto_commit":
                config.autoCommit = value.toLowerCase() === "true";
                break;
            case "zero_padded_ids":
                config.zeroPaddedIds = Number.parseInt(value, 10);
                break;
            case "bypass_git_hooks":
                config.bypassGitHooks = value.toLowerCase() === "true";
                break;
            case "check_active_branches":
                config.checkActiveBranches = value.toLowerCase() === "true";
                break;
            case "active_branch_days":
                config.activeBranchDays = Number.parseInt(value, 10);
                break;
        }
    }

    // Map to our BacklogConfig interface format (snake_case keys)
    return {
        project_name: config.projectName || "",
        default_status: config.defaultStatus || DEFAULT_STATUSES[0],
        statuses: config.statuses || [...DEFAULT_STATUSES],
        labels: config.labels || [],
        milestones: config.milestones || [],
        date_format: config.dateFormat || "yyyy-mm-dd hh:mm",
        default_editor: config.defaultEditor,
        auto_commit: config.autoCommit,
        zero_padded_ids: config.zeroPaddedIds,
    };
}

/**
 * Serialize BacklogConfig back to config.yml format
 * Copied from: https://github.com/MrLesk/Backlog.md/blob/main/src/file-system/operations.ts
 */
export function serializeBacklogConfig(config: BacklogConfig): string {
    const lines = [
        `project_name: "${config.project_name}"`,
        ...(config.default_status ? [`default_status: "${config.default_status}"`] : []),
        `statuses: [${config.statuses.map((s) => `"${s}"`).join(", ")}]`,
        `labels: [${(config.labels || []).map((l) => `"${l}"`).join(", ")}]`,
        `milestones: [${(config.milestones || []).map((m) => `"${m}"`).join(", ")}]`,
        `date_format: ${config.date_format || "yyyy-mm-dd hh:mm"}`,
        ...(config.default_editor ? [`default_editor: "${config.default_editor}"`] : []),
        ...(typeof config.auto_commit === "boolean" ? [`auto_commit: ${config.auto_commit}`] : []),
        ...(typeof config.zero_padded_ids === "number" ? [`zero_padded_ids: ${config.zero_padded_ids}`] : []),
    ];

    return `${lines.join("\n")}\n`;
}
