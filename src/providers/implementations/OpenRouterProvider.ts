/**
 * OpenRouter Provider Implementation
 * Handles OpenRouter's unified API for multiple models
 */

import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import {
    AIProvider,
    type ProviderMetadataWithApiKey,
    type ModelConfig,
    type VsCodeConfiguration,
    type ValidationResult,
    type ProviderInstanceParams,
} from '../types';
import type { LanguageModelV2 } from '@ai-sdk/provider';

export class OpenRouterProvider extends AIProvider {
    static readonly metadata: ProviderMetadataWithApiKey = {
        id: 'openrouter',
        name: 'OpenRouter',
        apiKeyConfigKey: 'openrouterApiKey',
        configureCommand: 'securedesign.configureOpenRouterApiKey',
        description: 'OpenRouter unified API for multiple AI models',
        documentationUrl: 'https://openrouter.ai/docs',
    };

    readonly models: ModelConfig[] = [
        // Anthropic models via OpenRouter
        {
            id: 'anthropic/claude-3-7-sonnet-20250219',
            displayName: 'Claude 3.7 Sonnet',
            isDefault: true,
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic/claude-3-5-sonnet-20241022',
            displayName: 'Claude 3.5 Sonnet',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic/claude-3-opus-20240229',
            displayName: 'Claude 3 Opus',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic/claude-3-sonnet-20240229',
            displayName: 'Claude 3 Sonnet',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic/claude-3-haiku-20240307',
            displayName: 'Claude 3 Haiku',
            maxTokens: 200000,
            supportsVision: true,
        },

        // Google models via OpenRouter
        {
            id: 'google/gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'google/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'google/gemini-2.0-flash-001',
            displayName: 'Gemini 2.0 Flash',
            maxTokens: 1000000,
            supportsVision: true,
        },

        // Meta models via OpenRouter
        {
            id: 'meta-llama/llama-3.3-70b-instruct',
            displayName: 'Llama 3.3 70B',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'meta-llama/llama-3.2-90b-vision-instruct',
            displayName: 'Llama 3.2 90B Vision',
            maxTokens: 131072,
            supportsVision: true,
        },
        {
            id: 'meta-llama/llama-3.1-405b-instruct',
            displayName: 'Llama 3.1 405B',
            maxTokens: 131072,
            supportsVision: false,
        },

        // DeepSeek models via OpenRouter
        {
            id: 'deepseek/deepseek-r1',
            displayName: 'DeepSeek R1',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'deepseek/deepseek-chat-v3',
            displayName: 'DeepSeek Chat V3',
            maxTokens: 131072,
            supportsVision: false,
        },

        // Mistral models via OpenRouter
        {
            id: 'mistralai/mistral-large-2411',
            displayName: 'Mistral Large 2411',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'mistralai/pixtral-large-2411',
            displayName: 'Pixtral Large',
            maxTokens: 131072,
            supportsVision: true,
        },

        // xAI models via OpenRouter
        {
            id: 'x-ai/grok-3',
            displayName: 'Grok 3',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'x-ai/grok-2-vision-1212',
            displayName: 'Grok 2 Vision',
            maxTokens: 131072,
            supportsVision: true,
        },

        // Qwen models via OpenRouter
        {
            id: 'qwen/qwen-2.5-72b-instruct',
            displayName: 'Qwen 2.5 72B',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'qwen/qwen2.5-vl-72b-instruct',
            displayName: 'Qwen2.5 VL 72B',
            maxTokens: 131072,
            supportsVision: true,
        },

        // Perplexity models via OpenRouter
        {
            id: 'perplexity/sonar-reasoning-pro',
            displayName: 'Sonar Reasoning Pro',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'perplexity/sonar-pro',
            displayName: 'Sonar Pro',
            maxTokens: 131072,
            supportsVision: false,
        },

        // OpenRouter Auto
        {
            id: 'openrouter/auto',
            displayName: 'Auto (Best Available)',
            maxTokens: 200000,
            supportsVision: true,
        },
    ];

    createInstance(params: ProviderInstanceParams): LanguageModelV2 {
        const apiKey = params.config.config.get<string>(
            OpenRouterProvider.metadata.apiKeyConfigKey
        );
        if (apiKey === undefined || apiKey.trim() === '') {
            throw new Error(this.getCredentialsErrorMessage());
        }

        params.config.outputChannel.appendLine('OpenRouter API key found');

        const openrouter = createOpenRouter({
            apiKey: apiKey,
        });

        params.config.outputChannel.appendLine(`Using OpenRouter model: ${params.model}`);
        return openrouter.chat(params.model);
    }

    validateCredentials(config: VsCodeConfiguration): ValidationResult {
        const apiKey = config.config.get<string>(OpenRouterProvider.metadata.apiKeyConfigKey);

        if (apiKey === undefined || apiKey.trim() === '') {
            return {
                isValid: false,
                error: 'OpenRouter API key is not configured',
            };
        }

        if (!apiKey.startsWith('sk-')) {
            return {
                isValid: false,
                error: 'OpenRouter API keys should start with "sk-"',
            };
        }

        if (apiKey.length < 20) {
            return {
                isValid: false,
                error: 'OpenRouter API key appears to be too short',
            };
        }

        return {
            isValid: true,
        };
    }
}
