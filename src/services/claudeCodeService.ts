import * as vscode from 'vscode';
import { Logger } from './logger';
import { LLMProviderFactory } from '../providers/llmProviderFactory';
import { LLMProvider, LLMProviderOptions, LLMMessage, LLMStreamCallback } from '../providers/llmProvider';

export class ClaudeCodeService {
    private providerFactory: LLMProviderFactory;
    private outputChannel: vscode.OutputChannel;

    constructor(outputChannel: vscode.OutputChannel) {
        this.outputChannel = outputChannel;
        this.providerFactory = LLMProviderFactory.getInstance(outputChannel);
    }

    private async getCurrentProvider(): Promise<LLMProvider> {
        return await this.providerFactory.getProvider();
    }



    async query(prompt: string, options?: Partial<LLMProviderOptions>, abortController?: AbortController, onMessage?: LLMStreamCallback): Promise<LLMMessage[]> {
        Logger.info('Starting LLM query via provider');
        
        try {
            const provider = await this.getCurrentProvider();
            return await provider.query(prompt, options, abortController, onMessage);
        } catch (error) {
            Logger.error(`LLM query failed: ${error}`);
            throw error;
        }
    }

    get isReady(): boolean {
        const currentProvider = this.providerFactory.getCurrentProvider();
        return currentProvider ? currentProvider.isReady() : false;
    }

    async waitForInitialization(): Promise<boolean> {
        try {
            const provider = await this.getCurrentProvider();
            return await provider.waitForInitialization();
        } catch (error) {
            Logger.error(`Initialization failed: ${error}`);
            return false;
        }
    }

    getWorkingDirectory(): string {
        const currentProvider = this.providerFactory.getCurrentProvider();
        return currentProvider ? currentProvider.getWorkingDirectory() : process.cwd();
    }

    // Method to refresh configuration and reinitialize if needed
    async refreshApiKey(): Promise<boolean> {
        try {
            return await this.providerFactory.refreshCurrentProvider();
        } catch (error) {
            Logger.error(`Failed to refresh configuration: ${error}`);
            return false;
        }
    }

    // Method to check if current provider has valid configuration
    async hasApiKey(): Promise<boolean> {
        try {
            const provider = await this.getCurrentProvider();
            return provider.hasValidConfiguration();
        } catch (error) {
            Logger.error(`Failed to check provider configuration: ${error}`);
            return false;
        }
    }


    // Method to detect if an error is related to authentication
    public isApiKeyAuthError(errorMessage: string): boolean {
        const currentProvider = this.providerFactory.getCurrentProvider();
        return currentProvider ? currentProvider.isAuthError(errorMessage) : false;
    }

    // Method to get current provider information
    async getProviderInfo(): Promise<{ name: string; type: 'api' | 'binary' }> {
        try {
            const provider = await this.getCurrentProvider();
            return {
                name: provider.getProviderName(),
                type: provider.getProviderType()
            };
        } catch (error) {
            Logger.error(`Failed to get provider info: ${error}`);
            return { name: 'Unknown', type: 'api' };
        }
    }

    // Method to get provider status for debugging
    async getProviderStatus() {
        return await this.providerFactory.getProviderStatus();
    }

    // Method to get current configuration for debugging
    async debugProviderConfig(): Promise<void> {
        try {
            const config = vscode.workspace.getConfiguration('superdesign');
            const providerType = config.get<string>('llmProvider');
            Logger.info(`Current LLM provider setting: ${providerType}`);
            
            const providerInfo = await this.getProviderInfo();
            Logger.info(`Active provider: ${providerInfo.name} (${providerInfo.type})`);
            
            const hasValidConfig = await this.hasApiKey();
            Logger.info(`Provider has valid configuration: ${hasValidConfig}`);
        } catch (error) {
            Logger.error(`Failed to debug provider config: ${error}`);
        }
    }
}

// Legacy export for backward compatibility
export type { LLMMessage, LLMProviderOptions, LLMStreamCallback }; 