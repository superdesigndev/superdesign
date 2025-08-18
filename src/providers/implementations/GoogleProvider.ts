/**
 * Google Provider Implementation
 * Handles Google's Gemini models
 */

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import {
    AIProvider,
    type ProviderMetadataWithApiKey,
    type ModelConfig,
    type VsCodeConfiguration,
    type ValidationResult,
    type ProviderInstanceParams,
} from '../types';
import type { LanguageModelV2 } from '@ai-sdk/provider';

export class GoogleProvider extends AIProvider {
    static readonly metadata: ProviderMetadataWithApiKey = {
        id: 'google',
        name: 'Google',
        apiKeyConfigKey: 'googleApiKey',
        configureCommand: 'securedesign.configureGoogleApiKey',
        description: 'Google Gemini models for AI applications',
        documentationUrl: 'https://ai.google.dev/docs',
    };

    readonly models: ModelConfig[] = [
        {
            id: 'gemini-2.5-pro',
            displayName: 'Gemini 2.5 Pro',
            isDefault: true,
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-2.5-flash-lite',
            displayName: 'Gemini 2.5 Flash Lite',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-2.0-flash-exp',
            displayName: 'Gemini 2.0 Flash Experimental',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-1.5-flash',
            displayName: 'Gemini 1.5 Flash',
            maxTokens: 1000000,
            supportsVision: true,
        },
        {
            id: 'gemini-1.5-flash-8b',
            displayName: 'Gemini 1.5 Flash 8B',
            maxTokens: 1000000,
            supportsVision: true,
        },
    ];

    createInstance(params: ProviderInstanceParams): LanguageModelV2 {
        const apiKey = params.config.config.get<string>(GoogleProvider.metadata.apiKeyConfigKey);
        if (!apiKey) {
            throw new Error(this.getCredentialsErrorMessage());
        }

        params.config.outputChannel.appendLine('Google API key found.');

        const google = createGoogleGenerativeAI({
            apiKey: apiKey,
        });

        params.config.outputChannel.appendLine(`Using Google model: ${params.model}`);
        return google(params.model);
    }

    validateCredentials(config: VsCodeConfiguration): ValidationResult {
        const apiKey = config.config.get<string>(GoogleProvider.metadata.apiKeyConfigKey);

        if (apiKey === undefined) {
            return {
                isValid: false,
                error: 'Google API key is not configured',
            };
        }

        // Google API keys are typically 39 characters and start with 'AI'
        if (apiKey.length < 20) {
            return {
                isValid: false,
                error: 'Google API key appears to be too short',
            };
        }

        // Basic pattern validation for Google API keys
        if (!/^[A-Za-z0-9_-]+$/.test(apiKey)) {
            return {
                isValid: false,
                error: 'Google API key contains invalid characters',
            };
        }

        return {
            isValid: true,
        };
    }
}
