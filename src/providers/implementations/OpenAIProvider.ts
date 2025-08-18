/**
 * OpenAI Provider Implementation
 * Handles OpenAI's GPT models and compatible APIs
 */

import { createOpenAI } from '@ai-sdk/openai';
import {
    AIProvider,
    type ProviderMetadata,
    type ModelConfig,
    type VsCodeConfiguration,
    type ValidationResult,
    type ProviderInstanceParams,
} from '../types';
import type { LanguageModelV2 } from '@ai-sdk/provider';

export class OpenAIProvider extends AIProvider {
    static readonly metadata: ProviderMetadata = {
        id: 'openai',
        name: 'OpenAI',
        apiKeyConfigKey: 'openaiApiKey',
        configureCommand: 'securedesign.configureOpenAIApiKey',
        additionalConfigKeys: ['openaiUrl'], // Optional base URL for compatible APIs
        description: 'OpenAI GPT models and compatible APIs',
        documentationUrl: 'https://platform.openai.com/docs/',
    };

    readonly models: ModelConfig[] = [
        {
            id: 'gpt-4.1',
            displayName: 'GPT-4.1',
            maxTokens: 128000,
            supportsVision: true,
        },
        {
            id: 'gpt-4.1-mini',
            displayName: 'GPT-4.1 Mini',
            maxTokens: 128000,
            supportsVision: true,
        },
        {
            id: 'gpt-4.1-nano',
            displayName: 'GPT-4.1 Nano',
            maxTokens: 128000,
            supportsVision: false,
        },
        {
            id: 'gpt-4o',
            displayName: 'GPT-4o',
            isDefault: true,
            maxTokens: 128000,
            supportsVision: true,
        },
        {
            id: 'gpt-4o-mini',
            displayName: 'GPT-4o Mini',
            maxTokens: 128000,
            supportsVision: true,
        },
        {
            id: 'gpt-4-turbo',
            displayName: 'GPT-4 Turbo',
            maxTokens: 128000,
            supportsVision: true,
        },
        {
            id: 'gpt-4',
            displayName: 'GPT-4',
            maxTokens: 8192,
            supportsVision: false,
        },
        {
            id: 'gpt-3.5-turbo',
            displayName: 'GPT-3.5 Turbo',
            maxTokens: 16384,
            supportsVision: false,
        },
    ];

    createInstance(params: ProviderInstanceParams): LanguageModelV2 {
        const apiKey = params.config.config.get<string>(OpenAIProvider.metadata.apiKeyConfigKey);
        const baseURL = params.config.config.get<string>('openaiUrl');

        if (apiKey === undefined) {
            throw new Error(this.getCredentialsErrorMessage());
        }

        params.config.outputChannel.appendLine('OpenAI API key found');

        if (baseURL !== undefined) {
            params.config.outputChannel.appendLine(`Using custom OpenAI base URL: ${baseURL}`);
        }

        const openai = createOpenAI({apiKey, baseURL});

        params.config.outputChannel.appendLine(`Using OpenAI model: ${params.model}`);
        return openai(params.model);
    }

    validateCredentials(config: VsCodeConfiguration): ValidationResult {
        const apiKey = config.config.get<string>(OpenAIProvider.metadata.apiKeyConfigKey);
        const baseURL = config.config.get<string>('openaiUrl');

        if (!apiKey) {
            return {
                isValid: false,
                error: 'OpenAI API key is not configured',
            };
        }

        if (!apiKey.startsWith('sk-')) {
            return {
                isValid: false,
                error: 'OpenAI API keys should start with "sk-"',
            };
        }

        if (apiKey.length < 20) {
            return {
                isValid: false,
                error: 'OpenAI API key appears to be too short',
            };
        }

        // Validate base URL if provided
        if (baseURL !== undefined) {
            try {
                new URL(baseURL);
                if (!baseURL.startsWith('http')) {
                    return {
                        isValid: false,
                        error: 'OpenAI base URL must start with http:// or https://',
                    };
                }
            } catch {
                return {
                    isValid: false,
                    error: 'OpenAI base URL is not a valid URL',
                };
            }
        }

        return {
            isValid: true,
        };
    }
}
