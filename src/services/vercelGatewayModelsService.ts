const GATEWAY_MODELS_URL = 'https://ai-gateway.vercel.sh/v1/models?include_mappings';

let cachedMapping: Map<string, string> | null = null;

async function fetchModelMapping(): Promise<Map<string, string>> {
    const response = await fetch(GATEWAY_MODELS_URL);
    if (!response.ok) {
        throw new Error(`Failed to fetch Vercel AI Gateway models: ${response.statusText}`);
    }

    const data = await response.json() as { data: { id: string; compat_id: string[] }[] };
    const mapping = new Map<string, string>();

    for (const model of data.data) {
        for (const compatId of (model.compat_id ?? [])) {
            mapping.set(compatId, model.id);
        }
    }

    return mapping;
}

export async function resolveVercelModelId(modelId: string): Promise<string> {
    if (!cachedMapping) {
        cachedMapping = await fetchModelMapping();
    }

    return cachedMapping.get(modelId) ?? modelId;
}
