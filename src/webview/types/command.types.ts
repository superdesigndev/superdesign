interface Command {
    command: string;
}

export interface ChangeProvider extends Command {
    command: 'changeProvider';
    model: string;
    providerId: string;
}

export function ChangeProvider(providerId: string, model: string): ChangeProvider {
    return {
        command: 'changeProvider',
        model,
        providerId,
    };
}
