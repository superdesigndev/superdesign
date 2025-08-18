import { ProviderRegistry } from './ProviderRegistry';
import { AnthropicProvider } from './implementations/AnthropicProvider';
import { OpenAIProvider } from './implementations/OpenAIProvider';
import { OpenRouterProvider } from './implementations/OpenRouterProvider';
import { GoogleProvider } from './implementations/GoogleProvider';
import { BedrockProvider } from './implementations/BedrockProvider';
import { MoonshotProvider } from './implementations/MoonshotProvider';
import type {
    IProviderService,
    VsCodeConfiguration,
    ProviderMetadata,
    ValidationResult,
    ModelConfig,
    ProviderId,
    AIProvider,
} from './types';
import type { LanguageModelV2 } from '@ai-sdk/provider';

export class ProviderService implements IProviderService {
    private static instance: ProviderService | undefined;
    private readonly registry: ProviderRegistry;

    private constructor() {
        this.registry = new ProviderRegistry();
        this.initializeProviders();
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): ProviderService {
        ProviderService.instance ??= new ProviderService();
        return ProviderService.instance;
    }

    /**
     * Create a model instance for the given model and provider
     */
    createModel(model: string, providerId: ProviderId, config: VsCodeConfiguration): LanguageModelV2 {
        const provider = this.registry.getProvider(providerId);

        const validation = provider.validateCredentials(config);
        if (!validation.isValid) {
            throw new Error(validation.error ?? 'Invalid credentials');
        }

        return provider.createInstance({ model, config });
    }

    /**
     * Validate credentials for a specific provider
     */
    validateCredentialsForProvider(
        providerId: ProviderId,
        config: VsCodeConfiguration
    ): ValidationResult {
        return this.registry.getProvider(providerId).validateCredentials(config);
    }

    /**
     * Get display name for a model from a specific provider
     */
    getModelDisplayName(model: string, providerId: ProviderId): string {
        return this.registry.getProvider(providerId).getModelDisplayName(model);
    }

    /**
     * Get all available providers
     */
    getAvailableProviders(): ProviderMetadata[] {
        return this.registry
            .getAllProviders()
            .map(provider => (provider.constructor as typeof AIProvider).metadata);
    }

    /**
     * Get all available models
     */
    getAvailableModels(): Array<ModelConfig & { providerId: ProviderId }> {
        return this.registry.getAllModels();
    }

    /**
     * Get provider by ID
     */
    getProviderMetadata(providerId: ProviderId): ProviderMetadata {
        const provider = this.registry.getProvider(providerId);
        return (provider.constructor as typeof AIProvider).metadata;
    }

    /**
     * Get models for a specific provider
     */
    getModelsForProvider(providerId: ProviderId): ModelConfig[] {
        const provider = this.registry.getProvider(providerId);
        return provider?.models ?? [];
    }

    /**
     * Get default model for a provider
     */
    getDefaultModelForProvider(providerId: ProviderId): ModelConfig | undefined {
        return this.registry.getDefaultModelForProvider(providerId);
    }

    /**
     * Get providers that support vision/multimodal capabilities
     */
    getVisionCapableProviders(): ProviderMetadata[] {
        return this.registry
            .getVisionCapableProviders()
            .map(provider => (provider.constructor as typeof AIProvider).metadata);
    }

    /**
     * Get provider registry for advanced operations
     */
    getRegistry(): ProviderRegistry {
        return this.registry;
    }

    /**
     * Get error message for missing credentials
     */
    getCredentialsErrorMessage(providerId: ProviderId): string {
        const provider = this.registry.getProvider(providerId);
        if (!provider) {
            return `Provider ${providerId} not found`;
        }
        return provider.getCredentialsErrorMessage();
    }

    /**
     * Validate all providers and return summary
     */
    validateAllProviders(config: VsCodeConfiguration): Array<{
        providerId: ProviderId;
        providerName: string;
        validation: ValidationResult;
    }> {
        const results: Array<{
            providerId: ProviderId;
            providerName: string;
            validation: ValidationResult;
        }> = [];

        for (const provider of this.registry.getAllProviders()) {
            const metadata = (provider.constructor as typeof AIProvider).metadata;
            results.push({
                providerId: metadata.id,
                providerName: metadata.name,
                validation: provider.validateCredentials(config),
            });
        }

        return results;
    }

    /**
     * Get registry statistics
     */
    getStats(): {
        providerCount: number;
        modelCount: number;
        visionCapableModels: number;
    } {
        const allModels = this.registry.getAllModels();

        return {
            providerCount: this.registry.getProviderCount(),
            modelCount: allModels.length,
            visionCapableModels: allModels.filter(model => model.supportsVision === true).length,
        };
    }

    /**
     * Initialize all available providers
     */
    private initializeProviders(): void {
        try {
            // Register all provider implementations
            this.registry.register(new AnthropicProvider());
            this.registry.register(new OpenAIProvider());
            this.registry.register(new OpenRouterProvider());
            this.registry.register(new GoogleProvider());
            this.registry.register(new BedrockProvider());
            this.registry.register(new MoonshotProvider());

            // Validate registry
            const validationErrors = this.registry.validate();
            if (validationErrors.length > 0) {
                console.warn('Provider registry validation issues:', validationErrors);
            }
        } catch (error) {
            console.error('Failed to initialize providers:', error);
            throw new Error(`Provider initialization failed: ${error}`);
        }
    }
}
