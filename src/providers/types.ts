/**
 * Provider System Types
 * Defines the interfaces and types for the AI provider registry system
 */

import type * as vscode from 'vscode';
import type { LanguageModelV2 } from '@ai-sdk/provider';

/**
 * Supported AI provider identifiers
 */
export type ProviderId = 'anthropic' | 'openai' | 'openrouter' | 'google' | 'bedrock' | 'moonshot';

/**
 * Configuration for a specific AI model
 */
export interface ModelConfig {
    /** Unique model identifier (e.g., 'claude-3-5-sonnet-20241022') */
    id: string;
    /** Human-readable model name (e.g., 'Claude 3.5 Sonnet') */
    displayName: string;
    /** Whether this is the default model for the provider */
    isDefault?: boolean;
    /** Maximum tokens supported by the model */
    maxTokens?: number;
    /** Whether the model supports vision/images */
    supportsVision?: boolean;
    /** Additional model-specific configuration */
    metadata?: Record<string, any>;
}

/**
 * Provider configuration from VS Code settings
 */
export interface VsCodeConfiguration {
    /** VS Code configuration object */
    config: vscode.WorkspaceConfiguration;
    /** Output channel for logging */
    outputChannel: vscode.OutputChannel;
}

/**
 * Credentials validation result
 */
export interface ValidationResult {
    /** Whether credentials are valid */
    isValid: boolean;
    /** Error message if validation failed */
    error?: string;
    /** Warning message for partial validation */
    warning?: string;
}

/**
 * Provider metadata and configuration
 */
export interface ProviderMetadata {
    /** Unique provider identifier */
    id: ProviderId;
    /** Human-readable provider name */
    name: string;
    /** VS Code setting key for the primary API key */
    apiKeyConfigKey: string;
    /** VS Code command to configure this provider */
    configureCommand: string;
    /** Additional configuration keys this provider requires */
    additionalConfigKeys?: string[];
    /** Provider description */
    description?: string;
    /** Provider documentation URL */
    documentationUrl?: string;
}

/**
 * Provider instance creation parameters
 */
export interface ProviderInstanceParams {
    /** The model to use */
    model: string;
    /** Provider configuration */
    config: VsCodeConfiguration;
    /** Additional instance-specific options */
    options?: Record<string, any>;
}

/**
 * Abstract base class for AI providers
 * Implements the Strategy pattern for different AI service providers
 */
export abstract class AIProvider {
    /** Provider metadata */
    static readonly metadata: ProviderMetadata;

    /** Available models for this provider */
    abstract readonly models: ModelConfig[];

    /**
     * Get the default model for this provider
     * @returns Default model configuration
     */
    getDefaultModel(): ModelConfig {
        const defaultModel = this.models.find(m => m.isDefault);
        const metadata = (this.constructor as typeof AIProvider).metadata;
        if (!defaultModel) {
            throw new Error(`No default model defined for provider ${metadata.id}`);
        }
        return defaultModel;
    }

    /**
     * Get model configuration by ID
     * @param modelId Model identifier
     * @returns Model configuration or undefined if not found
     */
    getModel(modelId: string): ModelConfig | undefined {
        return this.models.find(m => m.id === modelId);
    }

    /**
     * Get human-readable display name for a model
     * @param modelId Model identifier
     * @returns Display name or the model ID if not found
     */
    getModelDisplayName(modelId: string): string {
        const model = this.getModel(modelId);
        return model ? model.displayName : modelId;
    }

    /**
     * Check if provider has required credentials configured
     * @param config Provider configuration
     * @returns true if credentials are present
     */
    hasCredentials(config: VsCodeConfiguration): boolean {
        const metadata = (this.constructor as typeof AIProvider).metadata;
        const primaryKey = config.config.get<string>(metadata.apiKeyConfigKey);
        if (!primaryKey) {
            return false;
        }

        // Check additional config keys if any
        if (metadata.additionalConfigKeys) {
            return metadata.additionalConfigKeys.every(key => config.config.get<string>(key));
        }

        return true;
    }

    /**
     * Get provider-specific error message for missing credentials
     * @returns Error message string
     */
    getCredentialsErrorMessage(): string {
        const metadata = (this.constructor as typeof AIProvider).metadata;
        return `${metadata.name} credentials not configured. Please run "${metadata.configureCommand}" command.`;
    }

    /**
     * Create an AI SDK model instance
     * @param params Provider instance parameters
     * @returns AI SDK model instance
     */
    abstract createInstance(params: ProviderInstanceParams): LanguageModelV2;

    /**
     * Validate provider credentials
     * @param config Provider configuration
     * @returns Validation result
     */
    abstract validateCredentials(config: VsCodeConfiguration): ValidationResult;
}

/**
 * Provider registry interface
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IProviderRegistry {
    /**
     * Register a provider
     * @param provider Provider instance to register
     */
    register(provider: AIProvider): void;

    /**
     * Get provider by ID
     * @param providerId Provider identifier
     * @returns Provider instance or undefined
     */
    getProvider(providerId: ProviderId): AIProvider | undefined;

    /**
     * Get all registered providers
     * @returns Array of all providers
     */
    getAllProviders(): AIProvider[];

    /**
     * Get all available models across all providers
     * @returns Array of all model configurations
     */
    getAllModels(): ModelConfig[];
}

/**
 * Provider service interface for high-level operations
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export interface IProviderService {
    /**
     * Create a model instance for the given model string
     * @param model Model identifier
     * @param providerId Provider identifier
     * @param config Provider configuration
     * @returns AI SDK model instance
     */
    createModel(model: string, providerId: ProviderId, config: VsCodeConfiguration): LanguageModelV2;

    /**
     * Validate credentials for a specific provider
     * @param providerId Provider identifier
     * @param config Provider configuration
     * @returns Validation result
     */
    validateCredentialsForProvider(
        providerId: ProviderId,
        config: VsCodeConfiguration
    ): ValidationResult;

    /**
     * Get display name for a model from a specific provider
     * @param model Model identifier
     * @param providerId Provider identifier
     * @returns Human-readable model name
     */
    getModelDisplayName(model: string, providerId: ProviderId): string;

    /**
     * Get all available providers
     * @returns Array of provider metadata
     */
    getAvailableProviders(): ProviderMetadata[];

    /**
     * Get all available models
     * @returns Array of model configurations with provider info
     */
    getAvailableModels(): Array<ModelConfig & { providerId: ProviderId }>;
}
