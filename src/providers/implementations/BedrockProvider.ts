/**
 * AWS Bedrock Provider Implementation
 * Handles AWS Bedrock models from various providers
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import {
    AIProvider,
    type ProviderMetadataWithApiKey,
    type ModelConfig,
    type VsCodeConfiguration,
    type ValidationResult,
    type ProviderInstanceParams,
} from '../types';
import type { LanguageModelV2 } from '@ai-sdk/provider';

export class BedrockProvider extends AIProvider {
    static readonly metadata: ProviderMetadataWithApiKey = {
        id: 'bedrock',
        name: 'AWS Bedrock',
        apiKeyConfigKey: 'awsAccessKeyId',
        configureCommand: 'securedesign.configureAWSBedrock',
        additionalConfigKeys: ['awsSecretAccessKey', 'awsRegion'],
        description: 'AWS Bedrock unified API for multiple foundation models',
        documentationUrl: 'https://docs.aws.amazon.com/bedrock/',
    };

    readonly models: ModelConfig[] = [
        // Anthropic models on Bedrock
        {
            id: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
            displayName: 'Claude 3.5 Sonnet v2',
            isDefault: true,
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic.claude-3-5-sonnet-20240620-v1:0',
            displayName: 'Claude 3.5 Sonnet',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic.claude-3-opus-20240229-v1:0',
            displayName: 'Claude 3 Opus',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic.claude-3-sonnet-20240229-v1:0',
            displayName: 'Claude 3 Sonnet',
            maxTokens: 200000,
            supportsVision: true,
        },
        {
            id: 'anthropic.claude-3-haiku-20240307-v1:0',
            displayName: 'Claude 3 Haiku',
            maxTokens: 200000,
            supportsVision: true,
        },

        // Amazon models
        {
            id: 'amazon.nova-pro-v1:0',
            displayName: 'Amazon Nova Pro',
            maxTokens: 300000,
            supportsVision: true,
        },
        {
            id: 'amazon.nova-lite-v1:0',
            displayName: 'Amazon Nova Lite',
            maxTokens: 300000,
            supportsVision: true,
        },
        {
            id: 'amazon.nova-micro-v1:0',
            displayName: 'Amazon Nova Micro',
            maxTokens: 128000,
            supportsVision: false,
        },

        // Meta models
        {
            id: 'meta.llama3-2-90b-instruct-v1:0',
            displayName: 'Llama 3.2 90B Instruct',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'meta.llama3-2-11b-instruct-v1:0',
            displayName: 'Llama 3.2 11B Instruct',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'meta.llama3-1-405b-instruct-v1:0',
            displayName: 'Llama 3.1 405B Instruct',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'meta.llama3-1-70b-instruct-v1:0',
            displayName: 'Llama 3.1 70B Instruct',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'meta.llama3-1-8b-instruct-v1:0',
            displayName: 'Llama 3.1 8B Instruct',
            maxTokens: 131072,
            supportsVision: false,
        },

        // Mistral models
        {
            id: 'mistral.mistral-large-2407-v1:0',
            displayName: 'Mistral Large 2407',
            maxTokens: 131072,
            supportsVision: false,
        },
        {
            id: 'mistral.mistral-small-2402-v1:0',
            displayName: 'Mistral Small 2402',
            maxTokens: 32768,
            supportsVision: false,
        },
        {
            id: 'mistral.mixtral-8x7b-instruct-v0:1',
            displayName: 'Mixtral 8x7B Instruct',
            maxTokens: 32768,
            supportsVision: false,
        },

        // AI21 models
        {
            id: 'ai21.jamba-1-5-large-v1:0',
            displayName: 'AI21 Jamba 1.5 Large',
            maxTokens: 262144,
            supportsVision: false,
        },
        {
            id: 'ai21.jamba-1-5-mini-v1:0',
            displayName: 'AI21 Jamba 1.5 Mini',
            maxTokens: 262144,
            supportsVision: false,
        },

        // Cohere models
        {
            id: 'cohere.command-r-plus-v1:0',
            displayName: 'Cohere Command R+',
            maxTokens: 128000,
            supportsVision: false,
        },
        {
            id: 'cohere.command-r-v1:0',
            displayName: 'Cohere Command R',
            maxTokens: 128000,
            supportsVision: false,
        },
    ];

    createInstance(params: ProviderInstanceParams): LanguageModelV2 {
        const awsAccessKeyId = params.config.config.get<string>('awsAccessKeyId');
        const awsSecretAccessKey = params.config.config.get<string>('awsSecretAccessKey');
        const awsRegion = params.config.config.get<string>('awsRegion') || 'us-east-1';

        if (!awsAccessKeyId || !awsSecretAccessKey) {
            throw new Error(this.getCredentialsErrorMessage());
        }

        params.config.outputChannel.appendLine(`AWS region: ${awsRegion}`);
        params.config.outputChannel.appendLine('AWS credentials are configured');
        const bedrock = createAmazonBedrock({
            region: awsRegion,
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
        });

        params.config.outputChannel.appendLine(`Using Bedrock model: ${params.model}`);
        return bedrock(params.model);
    }

    validateCredentials(config: VsCodeConfiguration): ValidationResult {
        const awsAccessKeyId = config.config.get<string>('awsAccessKeyId');
        const awsSecretAccessKey = config.config.get<string>('awsSecretAccessKey');
        const awsRegion = config.config.get<string>('awsRegion');

        if (!awsAccessKeyId) {
            return {
                isValid: false,
                error: 'AWS Access Key ID is not configured',
            };
        }

        if (!awsSecretAccessKey) {
            return {
                isValid: false,
                error: 'AWS Secret Access Key is not configured',
            };
        }

        if (!awsAccessKeyId.startsWith('AKIA')) {
            return {
                isValid: false,
                error: 'AWS Access Key IDs should start with "AKIA"',
            };
        }

        if (awsAccessKeyId.length !== 20) {
            return {
                isValid: false,
                error: 'AWS Access Key ID should be exactly 20 characters',
            };
        }

        if (awsSecretAccessKey.length !== 40) {
            return {
                isValid: false,
                error: 'AWS Secret Access Key should be exactly 40 characters',
            };
        }

        // Validate region format if provided
        if (awsRegion) {
            const regionPattern = /^[a-z]{2}-[a-z]+-\d+$/;
            if (!regionPattern.test(awsRegion)) {
                return {
                    isValid: false,
                    error: 'AWS region format is invalid. Example: us-east-1, eu-west-1',
                };
            }
        }

        return {
            isValid: true,
            warning: !awsRegion
                ? 'No AWS region specified, will use us-east-1 as default'
                : undefined,
        };
    }
}
