import * as vscode from 'vscode';
import type { ModelConfigWithProvider, ProviderId } from './types';
import { ProviderService } from './ProviderService';

export const PROVIDER_KEY = 'aiModelProvider';
export const MODEL_KEY = 'aiModel';

export function getProvider(): ProviderId {
    const service = ProviderService.getInstance();
    const config = vscode.workspace.getConfiguration(service.configPrefix);
    const stored = config.get<string>(PROVIDER_KEY);
    if (stored === undefined) {
        return ProviderService.defaultProvider;
    }
    try {
        // Validate against the registry; fall back if unknown
        service.getProviderMetadata(stored as ProviderId);
        return stored as ProviderId;
    } catch {
        return ProviderService.defaultProvider;
    }
}

export function getModel(): ModelConfigWithProvider | undefined {
    const service = ProviderService.getInstance();
    const provider = getProvider();
    const config = vscode.workspace.getConfiguration(service.configPrefix);
    const stored = config.get<string>(MODEL_KEY);
    return stored !== undefined
        ? service.getModelForProvider(provider, stored)
        : service.getDefaultModelForProvider(getProvider());
}
