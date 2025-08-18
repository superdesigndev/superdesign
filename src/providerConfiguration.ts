import * as vscode from 'vscode';
import { AnthropicProvider } from './providers/implementations/AnthropicProvider';
import { OpenAIProvider } from './providers/implementations/OpenAIProvider';
import { OpenRouterProvider } from './providers/implementations/OpenRouterProvider';
import { BedrockProvider } from './providers/implementations/BedrockProvider';
import { GoogleProvider } from './providers/implementations/GoogleProvider';
import { MoonshotProvider } from './providers/implementations/MoonshotProvider';

export function registerProviderCommands(): vscode.Disposable[] {
    const disposables: vscode.Disposable[] = [];
    disposables.push(
        vscode.commands.registerCommand(
            AnthropicProvider.metadata.configureCommand,
            configureAnthropicApiKey
        ),
        vscode.commands.registerCommand(
            OpenAIProvider.metadata.configureCommand,
            configureOpenAIApiKey
        ),
        vscode.commands.registerCommand('securedesign.configureOpenAIUrl', configureOpenAIUrl),
        vscode.commands.registerCommand(
            OpenRouterProvider.metadata.configureCommand,
            configureOpenRouterApiKey
        ),
        vscode.commands.registerCommand(
            BedrockProvider.metadata.configureCommand,
            configureAWSBedrock
        ),
        vscode.commands.registerCommand(
            GoogleProvider.metadata.configureCommand,
            configureGoogleApiKey
        ),
        vscode.commands.registerCommand(
            MoonshotProvider.metadata.configureCommand,
            configureMoonshotApiKey
        )
    );
    return disposables;
}

async function configureAnthropicApiKey() {
    const currentKey = vscode.workspace
        .getConfiguration('securedesign')
        .get<string>('anthropicApiKey');

    const input = await vscode.window.showInputBox({
        title: 'Configure Anthropic API Key',
        prompt: 'Enter your Anthropic API key (get one from https://console.anthropic.com/)',
        value: currentKey ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'sk-ant-...',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            if (!value.startsWith('sk-ant-')) {
                return 'Anthropic API keys should start with "sk-ant-"';
            }
            return null;
        },
    });

    if (input !== undefined) {
        // Only update if user didn't just keep the masked value
        if (input !== '••••••••••••••••') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('anthropicApiKey', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    '✅ Anthropic API key configured successfully!'
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('API key unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No API key was set');
        }
    }
}

// Function to configure OpenAI API key
async function configureOpenAIApiKey() {
    const currentKey = vscode.workspace
        .getConfiguration('securedesign')
        .get<string>('openaiApiKey');

    const input = await vscode.window.showInputBox({
        title: 'Configure OpenAI API Key',
        prompt: 'Enter your OpenAI API key (get one from https://platform.openai.com/api-keys)',
        value: currentKey ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'sk-...',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            if (!value.startsWith('sk-')) {
                return 'OpenAI API keys should start with "sk-"';
            }
            return null;
        },
    });

    if (input !== undefined) {
        // Only update if user didn't just keep the masked value
        if (input !== '••••••••••••••••') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('openaiApiKey', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('✅ OpenAI API key configured successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('API key unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No API key was set');
        }
    }
}

// Function to configure OpenRouter API key
async function configureOpenRouterApiKey() {
    const currentKey = vscode.workspace
        .getConfiguration('securedesign')
        .get<string>('openrouterApiKey');

    const input = await vscode.window.showInputBox({
        title: 'Configure OpenRouter API Key',
        prompt: 'Enter your OpenRouter API key (get one from https://openrouter.ai/)',
        value: currentKey ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'sk-...',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            if (!value.startsWith('sk-')) {
                return 'OpenRouter API keys should start with "sk-"';
            }
            return null;
        },
    });

    if (input !== undefined) {
        // Only update if user didn't just keep the masked value
        if (input !== '••••••••••••••••') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('openrouterApiKey', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    '✅ OpenRouter API key configured successfully!'
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('API key unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No API key was set');
        }
    }
}

// Function to configure OpenAI url
async function configureOpenAIUrl() {
    const currentKey = vscode.workspace.getConfiguration('securedesign').get<string>('openaiUrl');

    const input = await vscode.window.showInputBox({
        title: 'Configure OpenAI url',
        prompt: 'Enter your OpenAI url',
        value: currentKey ?? '',
        password: false,
        placeHolder: 'http://localhost:1234/v1',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'Url cannot be empty';
            }
            if (!value.startsWith('http')) {
                return 'Url should start with "http"';
            }
            return null;
        },
    });

    if (input !== undefined) {
        if (input !== '') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('openaiUrl', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('✅ OpenAI url configured successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save url: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('Url unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No Url was set');
        }
    }
}

async function configureGoogleApiKey() {
    const config = vscode.workspace.getConfiguration('securedesign');
    const currentKey = config.get<string>('googleApiKey');

    const input = await vscode.window.showInputBox({
        title: 'Configure Google API Key',
        prompt: 'Enter your Google API key',
        value: currentKey ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'Enter your Google API Key',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            return null;
        },
    });

    if (input !== undefined) {
        // Only update if user didn't just keep the masked value
        if (input !== '••••••••••••••••') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('googleApiKey', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage('✅ Google API key configured successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('API key unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No API key was set');
        }
    }
}

// Function to configure AWS Bedrock credentials
async function configureAWSBedrock() {
    const config = vscode.workspace.getConfiguration('securedesign');

    // Get current values
    const currentAccessKeyId = config.get<string>('awsAccessKeyId');
    const currentSecretAccessKey = config.get<string>('awsSecretAccessKey');
    const currentRegion = config.get<string>('awsRegion') ?? 'us-east-1';

    // Configure Access Key ID
    const accessKeyInput = await vscode.window.showInputBox({
        title: 'Configure AWS Access Key ID',
        prompt: 'Enter your AWS Access Key ID (get one from AWS IAM)',
        value: currentAccessKeyId ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'AKIA...',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'Access Key ID cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            if (!value.startsWith('AKIA')) {
                return 'AWS Access Key IDs should start with "AKIA"';
            }
            return null;
        },
    });

    if (accessKeyInput === undefined) {
        return; // User cancelled
    }

    // Configure Secret Access Key only if Access Key ID was provided
    if (accessKeyInput !== '••••••••••••••••' || !currentAccessKeyId) {
        const secretKeyInput = await vscode.window.showInputBox({
            title: 'Configure AWS Secret Access Key',
            prompt: 'Enter your AWS Secret Access Key',
            value: currentSecretAccessKey ? '••••••••••••••••••••••••••••••••••••••••' : '',
            password: true,
            placeHolder: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            validateInput: value => {
                if (!value || value.trim().length === 0) {
                    return 'Secret Access Key cannot be empty';
                }
                if (value === '••••••••••••••••••••••••••••••••••••••••') {
                    return null; // User didn't change the masked value, that's OK
                }
                if (value.length < 40) {
                    return 'AWS Secret Access Keys should be at least 40 characters long';
                }
                return null;
            },
        });

        if (secretKeyInput === undefined) {
            return; // User cancelled
        }

        // Configure Region
        const regionInput = await vscode.window.showInputBox({
            title: 'Configure AWS Region',
            prompt: 'Enter your preferred AWS region for Bedrock (default: us-east-1)',
            value: currentRegion,
            placeHolder: 'us-east-1',
            validateInput: value => {
                if (!value || value.trim().length === 0) {
                    return null; // Will use default
                }
                // Basic region format validation
                if (!/^[a-z]{2}-[a-z]+-\d+$/.test(value)) {
                    return 'Invalid region format. Example: us-east-1, eu-west-1';
                }
                return null;
            },
        });

        if (regionInput === undefined) {
            return; // User cancelled
        }

        try {
            // Save all configurations
            const updates: Thenable<void>[] = [];

            if (accessKeyInput !== '••••••••••••••••') {
                updates.push(
                    config.update(
                        'awsAccessKeyId',
                        accessKeyInput.trim(),
                        vscode.ConfigurationTarget.Global
                    )
                );
            }

            if (secretKeyInput !== '••••••••••••••••••••••••••••••••••••••••') {
                updates.push(
                    config.update(
                        'awsSecretAccessKey',
                        secretKeyInput.trim(),
                        vscode.ConfigurationTarget.Global
                    )
                );
            }

            const region = regionInput.trim() || 'us-east-1';
            updates.push(config.update('awsRegion', region, vscode.ConfigurationTarget.Global));

            await Promise.all(updates);

            vscode.window.showInformationMessage(
                `✅ AWS Bedrock credentials configured successfully! Region: ${region}`
            );
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to save AWS credentials: ${error}`);
        }
    } else if (currentAccessKeyId && currentSecretAccessKey) {
        vscode.window.showInformationMessage('AWS credentials unchanged (already configured)');
    } else {
        vscode.window.showWarningMessage('No AWS credentials were set');
    }
}
async function configureMoonshotApiKey() {
    const currentKey = vscode.workspace
        .getConfiguration('securedesign')
        .get<string>('moonshotApiKey');

    const input = await vscode.window.showInputBox({
        title: 'Configure Moonshot API Key',
        prompt: 'Enter your Moonshot AI API key (get one from https://platform.moonshot.cn/)',
        value: currentKey ? '••••••••••••••••' : '',
        password: true,
        placeHolder: 'sk-...',
        validateInput: value => {
            if (!value || value.trim().length === 0) {
                return 'API key cannot be empty';
            }
            if (value === '••••••••••••••••') {
                return null; // User didn't change the masked value, that's OK
            }
            if (!value.startsWith('sk-')) {
                return 'Moonshot API keys should start with "sk-"';
            }
            return null;
        },
    });

    if (input !== undefined) {
        // Only update if user didn't just keep the masked value
        if (input !== '••••••••••••••••') {
            try {
                await vscode.workspace
                    .getConfiguration('securedesign')
                    .update('moonshotApiKey', input.trim(), vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                    '✅ Moonshot API key configured successfully!'
                );
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save API key: ${error}`);
            }
        } else if (currentKey) {
            vscode.window.showInformationMessage('API key unchanged (already configured)');
        } else {
            vscode.window.showWarningMessage('No API key was set');
        }
    }
}
