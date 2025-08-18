import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG,
    INFO,
    WARN,
    ERROR,
}

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static currentLevel: LogLevel = LogLevel.INFO;

    public static initialize() {
        if (!this.outputChannel) {
            this.outputChannel = vscode.window.createOutputChannel('Securedesign');
        }
    }

    public static setLevel(level: LogLevel) {
        this.currentLevel = level;
    }

    private static log(
        level: LogLevel,
        label: string,
        message: string,
        showNotification: boolean = false
    ) {
        if (level < this.currentLevel) {
            return;
        }

        this.initialize();
        const timestamp = new Date().toISOString();
        this.outputChannel.appendLine(`[${timestamp}] [${label}] ${message}`);

        if (showNotification) {
            switch (level) {
                case LogLevel.ERROR:
                    vscode.window.showErrorMessage(message);
                    break;
                case LogLevel.WARN:
                    vscode.window.showWarningMessage(message);
                    break;
                case LogLevel.INFO:
                    vscode.window.showInformationMessage(message);
                    break;
                case LogLevel.DEBUG:
                    // Debug messages don't show notifications
                    break;
                default:
                    // No notification for debug
                    break;
            }
        }
    }

    public static debug(message: string, showNotification: boolean = false) {
        this.log(LogLevel.DEBUG, 'DEBUG', message, showNotification);
    }

    public static info(message: string, showNotification: boolean = false) {
        this.log(LogLevel.INFO, 'INFO', message, showNotification);
    }

    public static warn(message: string, showNotification: boolean = false) {
        this.log(LogLevel.WARN, 'WARN', message, showNotification);
    }

    public static error(message: string, showNotification: boolean = false) {
        this.log(LogLevel.ERROR, 'ERROR', message, showNotification);
    }

    public static dispose() {
        if (this.outputChannel) {
            this.outputChannel.dispose();
        }
    }

    /**
     * Get the output channel for direct access if needed
     */
    public static getOutputChannel(): vscode.OutputChannel {
        this.initialize();
        return this.outputChannel;
    }
}
