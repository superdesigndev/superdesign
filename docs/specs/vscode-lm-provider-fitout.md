# VS Code LM Provider Fit-Out Spec

## Overview
The Superdesign extension currently exposes a `VS Code LM` provider as a lightweight bridge to the VS Code Language Model API. The implementation offers only minimal model discovery and message handling, which leads to brittle behavior when Copilot configuration changes, and it lacks the conversion/streaming features present in other providers. This spec defines the full set of enhancements required to make the provider production-ready for design workflows, while keeping MCP features and plan/act mode out of scope for now.

## Goals
- Ensure the provider reliably connects to the active VS Code LM (e.g., GitHub Copilot) without requiring manual restarts.
- Support graceful degradation when no compatible model is available, surfacing clear guidance to designers.
- Normalize message formatting so Superdesign tool results and structured prompts map cleanly to the VS Code LM API.
- Provide cancellation, usage heuristics, and consistent logging in line with other LLM providers.
- Allow designers to pin specific Copilot models via configuration, defaulting safely to automatic selection.

## Non-Goals
- Introducing plan/act mode configuration.
- Integrating MCP tools or telemetry dashboards.
- Reworking BYOK storage (keys remain in VS Code settings for this milestone).

## Current State Summary
- `src/providers/vscodeLmProvider.ts` eagerly enumerates models at activation and throws if none exist, with no fallback stream or configuration change handling.
- System prompts are prepended, but user/assistant/tool messages are passed as raw strings; tool results are not re-encoded, and images are ignored.
- Streaming simply forwards `LanguageModelTextPart` chunks; there is no cancellation token source, token counting, or usage reporting.
- Configuration relies on a single `superdesign.aiModel` string without selector parsing; switching models requires editing settings manually and may not survive configuration change events.
- Error messaging for missing Copilot login surfaces deep within chat error handling and does not differentiate root causes clearly.

## Detailed Specification

### 1. Provider Lifecycle & Resilience
- **Files:** `src/providers/vscodeLmProvider.ts`
- **Objectives:**
  - Convert `initialize()` into a lightweight pre-flight that only sets up the working directory; defer LM discovery to a new `getClient()` helper that runs on-demand.
  - Cache the currently selected `LanguageModelChat` instance along with the selector used to obtain it.
  - Watch both `superdesign.aiModel` and VS Code `lm` configuration (via `vscode.workspace.onDidChangeConfiguration`) to invalidate cached models when relevant keys change.
  - When `selectChatModels()` returns zero results or throws, swap in a fallback pseudo-model that streams a friendly diagnostic message and logs the underlying error exactly once per invocation.
- **Implementation Steps:**
  1. Add `private client: vscode.LanguageModelChat | null` and `private clientSelector?: LanguageModelChatSelector` to cache the current client.
  2. Introduce `ensureClient(selector)` that calls `vscode.lm.selectChatModels(selector)` lazily; handle `Error` by creating a fallback client object with `sendRequest` that yields a diagnostic `LanguageModelTextPart`.
  3. Register a configuration listener in the constructor to reset `client` and `availableModels` when `superdesign.aiModel` or `lm` settings change.
  4. Replace `refreshModels()` usage with `ensureClient()` and store the latest successful selector for reuse.

### 2. Model Selection & Configuration UX
- **Files:** `src/providers/vscodeLmProvider.ts`, `src/providers/llmProviderFactory.ts`, `package.json`
- **Objectives:**
  - Normalize model IDs using the `vscodelm/{vendor}/{family}/{identifier}` scheme.
  - Keep `vscodelm/auto` as the default; interpret vendor/family/identifier segments when specified.
  - Surface schema docs for `superdesign.aiModel` to help users pick `vscodelm/*` options.
- **Implementation Steps:**
  1. Extend `buildModelKey()` to include `family`, `identifier`, and `id` when provided.
  2. Update `resolveModel()` to parse `aiModel` into `{ vendor, family, identifier }` and call `selectChatModels()` with a selector matching available fields.
  3. In `package.json`, add examples to the `superdesign.aiModel` setting description (e.g., `vscodelm/auto`, `vscodelm/github-copilot/gpt-4o`).
  4. Ensure `LLMProviderFactory` still defaults to the VS Code provider when `llmProvider` is `vscodelm`.

### 3. Message Conversion Layer
- **Files:** `src/providers/vscodeLmProvider.ts`, `src/services/chatMessageService.ts` (read-only for reference)
- **Objectives:**
  - Build a helper (e.g., `private convertMessages(messages: CoreMessage[]): vscode.LanguageModelChatMessage[]`) that:
    - Inserts the system prompt as an assistant message.
    - Converts user messages containing tool results first (turned into `LanguageModelToolResultPart`), then text segments via `LanguageModelTextPart`.
    - Converts assistant tool calls to `LanguageModelToolCallPart`; plain text segments remain `TextPart`.
    - Degrades images to placeholder text (`"[Image: not supported]"`).
  - Preserve existing `.superdesign` prompt conventions.
- **Implementation Steps:**
  1. Define typed guards for `LanguageModelTextPart`, `LanguageModelToolCallPart`, and `LanguageModelToolResultPart`, accounting for possible API variations.
  2. Rework `query()` to call `convertMessages()` before invoking `sendRequest`.
  3. Ensure that streaming tool-call updates re-use the parsed call ID and JSON arguments from the conversion layer when emitting `LLMMessage` callbacks.

### 4. Streaming Enhancements & Usage Heuristics
- **Files:** `src/providers/vscodeLmProvider.ts`
- **Objectives:**
  - Manage a `CancellationTokenSource` per request inside `query()`; link it to the passed `AbortController`.
  - Track input character length before dispatching the request; accumulate streamed output into a buffer for post-run token estimation.
  - After stream completion, log a usage object (`{ inputTokens, outputTokens }`) via `Logger.info` and push a synthetic `LLMMessage` of `type: 'usage'`.
- **Implementation Steps:**
  1. Instantiate `new vscode.CancellationTokenSource()` at the start of `query()`; pass `source.token` to `sendRequest` and tie `abortController.signal` to `source.cancel()`.
  2. Add `private estimateTokens(text: string): number` using `Math.ceil(text.length / 4)`.
  3. Accumulate text from `LanguageModelTextPart` chunks; convert tool-call parts into JSON strings before appending to the buffer.
  4. On `finally`, dispose the token source and emit/log usage counts.

### 5. Error Surfacing & Logging
- **Files:** `src/providers/vscodeLmProvider.ts`, `src/services/chatMessageService.ts`
- **Objectives:**
  - Differentiate errors caused by missing Copilot sign-in vs. rate limits vs. internal faults.
  - Emit `Logger.warn` for recoverable conditions (fallback mode) and `Logger.error` for hard failures.
  - Ensure chat service recognizes fallback streams and shows a single toast such as “VS Code LM is responding with limited functionality; please confirm Copilot access.”
- **Implementation Steps:**
  1. Map known error substrings (`'sign in'`, `'permission'`, `'ENOENT'`) to user-facing messages.
  2. When the fallback model is used, set a flag in the returned `LLMMessage` (e.g., `metadata: { degraded: true }`) so UI handlers can surface a toast once.
  3. Update `chatMessageService.handleChatMessage` to check for the degraded flag and post the toast if present.

### 6. QA & Validation
- **Files:** No code changes; manual checklist.
- **Steps:**
  1. With GitHub Copilot enabled, run a design prompt from the sidebar and confirm streaming text, tool-call handling, and usage logging.
  2. Disable Copilot (sign out or switch to a workspace without access) and trigger the provider to verify fallback messaging activates instead of hard failing.
  3. Toggle `superdesign.aiModel` between `vscodelm/auto` and a specific vendor/family ID; ensure the provider refreshes without requiring reload.
  4. Regression-test Claude API provider to confirm no changes to `LLMProviderFactory` break BYOK flows.

## Task Breakdown (Priority Order)
1. Implement provider lifecycle resilience & configuration listeners.
2. Add model selector parsing and configuration documentation updates.
3. Build message conversion utilities and integrate into the streaming loop.
4. Layer in cancellation and token usage heuristics.
5. Enhance error reporting and UI surfacing for degraded mode.
6. Execute QA checklist above and capture results in release notes.

## Dependencies & Risks
- Requires VS Code 1.95+ for the `vscode.lm` API; spec assumes extension already targets that baseline.
- Diagnostic fallback must avoid infinite recursion (ensure `sendRequest` on the pseudo-model never triggers `ensureClient` again).
- Token counting is heuristic; guard against `NaN` from malformed chunks.
- Watchers should debounce to avoid repeated `selectChatModels()` calls when configuration churns.

## Open Questions
- Should we cache multiple clients keyed by selector variants (`plan`/`act` future)? For this milestone, caching a single active selector is sufficient.
- Do we eventually expose the usage telemetry in the webview? Deferred until the broader analytics effort.

-------

Comprehensive Technical Analysis: VS Code LM Integration & BYOK Practices
Based on my meticulous analysis of the codebase, here's a detailed breakdown of how VS Code's Language Model API is integrated alongside Bring Your Own Key (BYOK) practices:

1. VS Code LM Provider Architecture
Handler Implementation (src/core/api/providers/vscode-lm.ts)
The VsCodeLmHandler class implements the ApiHandler interface and provides VS Code LM-specific functionality:

export class VsCodeLmHandler implements ApiHandler, SingleCompletionHandler {
	private options: VsCodeLmHandlerOptions
	private client: vscode.LanguageModelChat | null
	private disposable: vscode.Disposable | null
	private currentRequestCancellation: vscode.CancellationTokenSource | null

	constructor(options: VsCodeLmHandlerOptions) {
		this.options = options
		this.client = null
		this.disposable = null
		this.currentRequestCancellation = null

		// Listen for model changes and reset client
		this.disposable = vscode.workspace.onDidChangeConfiguration((event) => {
			if (event.affectsConfiguration("lm")) {
				this.client = null
				this.ensureCleanState()
			}
		})
	}
}
Key Design Decisions:

No API Keys Required: Unlike BYOK providers (Anthropic, OpenAI, etc.), VS Code LM doesn't require API key management
Configuration Listener: Automatically resets when VS Code's LM configuration changes
Lazy Client Initialization: Client is created on-demand via getClient()
Model Selection (createClient method)
async createClient(selector: vscode.LanguageModelChatSelector): Promise<vscode.LanguageModelChat> {
	try {
		const models = await vscode.lm.selectChatModels(selector)

		// Use first available model or create a minimal model object
		if (models && Array.isArray(models) && models.length > 0) {
			return models[0]
		}

		// Create a minimal model if no models are available
		return {
			id: "default-lm",
			name: "Default Language Model",
			vendor: "vscode",
			family: "lm",
			version: "1.0",
			maxInputTokens: 8192,
			sendRequest: async (_messages, _options, _token) => {
				return {
					stream: (async function* () {
						yield new vscode.LanguageModelTextPart(
							"Language model functionality is limited. Please check VS Code configuration.",
						)
					})(),
					text: (async function* () {
						yield "Language model functionality is limited. Please check VS Code configuration."
					})(),
				}
			},
			countTokens: async () => 0,
		}
	} catch (error) {
		throw new Error(`Cline <Language Model API>: Failed to select model: ${errorMessage}`)
	}
}
Model Discovery Flow:

Calls vscode.lm.selectChatModels(selector) with optional selector criteria
Selector can filter by vendor, family, version, or id
Returns first matching model or creates fallback with graceful degradation
2. Message Format Transformation
Anthropic → VS Code LM Conversion (src/core/api/transform/vscode-lm-format.ts)
export function convertToVsCodeLmMessages(
	anthropicMessages: Anthropic.Messages.MessageParam[],
): vscode.LanguageModelChatMessage[] {
	const vsCodeLmMessages: vscode.LanguageModelChatMessage[] = []

	for (const anthropicMessage of anthropicMessages) {
		// Handle simple string messages
		if (typeof anthropicMessage.content === "string") {
			vsCodeLmMessages.push(
				anthropicMessage.role === "assistant"
					? vscode.LanguageModelChatMessage.Assistant(anthropicMessage.content)
					: vscode.LanguageModelChatMessage.User(anthropicMessage.content),
			)
			continue
		}

		// Handle complex message structures
		switch (anthropicMessage.role) {
			case "user": {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolResultBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_result") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				// Process tool messages first then non-tool messages
				const contentParts = [
					// Convert tool messages to ToolResultParts
					...toolMessages.map((toolMessage) => {
						const toolContentParts: vscode.LanguageModelTextPart[] =
							typeof toolMessage.content === "string"
								? [new vscode.LanguageModelTextPart(toolMessage.content)]
								: (toolMessage.content?.map((part) => {
										if (part.type === "image") {
											return new vscode.LanguageModelTextPart(
												`[Image (${part.source?.type || "Unknown source-type"}): ${part.source?.media_type || "unknown media-type"} not supported by VSCode LM API]`,
											)
										}
										return new vscode.LanguageModelTextPart(part.text)
									}) ?? [new vscode.LanguageModelTextPart("")])

						return new vscode.LanguageModelToolResultPart(toolMessage.tool_use_id, toolContentParts)
					}),

					// Convert non-tool messages to TextParts after tool messages
					...nonToolMessages.map((part) => {
						if (part.type === "image") {
							return new vscode.LanguageModelTextPart(
								`[Image (${part.source?.type || "Unknown source-type"}): ${part.source?.media_type || "unknown media-type"} not supported by VSCode LM API]`,
							)
						}
						return new vscode.LanguageModelTextPart(part.text)
					}),
				]

				vsCodeLmMessages.push(vscode.LanguageModelChatMessage.User(contentParts))
				break
			}

			case "assistant": {
				const { nonToolMessages, toolMessages } = anthropicMessage.content.reduce<{
					nonToolMessages: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam)[]
					toolMessages: Anthropic.ToolUseBlockParam[]
				}>(
					(acc, part) => {
						if (part.type === "tool_use") {
							acc.toolMessages.push(part)
						} else if (part.type === "text" || part.type === "image") {
							acc.nonToolMessages.push(part)
						}
						return acc
					},
					{ nonToolMessages: [], toolMessages: [] },
				)

				const contentParts = [
					// Convert tool messages to ToolCallParts first
					...toolMessages.map(
						(toolMessage) =>
							new vscode.LanguageModelToolCallPart(
								toolMessage.id,
								toolMessage.name,
								asObjectSafe(toolMessage.input),
							),
					),

					// Convert non-tool messages to TextParts after tool messages
					...nonToolMessages.map((part) => {
						if (part.type === "image") {
							return new vscode.LanguageModelTextPart("[Image generation not supported by VSCode LM API]")
						}
						return new vscode.LanguageModelTextPart(part.text)
					}),
				]

				vsCodeLmMessages.push(vscode.LanguageModelChatMessage.Assistant(contentParts))
				break
			}
		}
	}

	return vsCodeLmMessages
}
Transformation Features:

Tool Support: Converts Anthropic tool_use/tool_result to VS Code's ToolCallPart/ToolResultPart
Image Handling: Gracefully degrades images to text placeholders (VS Code LM API doesn't support images)
Message Ordering: Preserves tool messages before text content
3. Streaming Implementation
Message Creation with Streaming (createMessage method)
@withRetry()
async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
	this.ensureCleanState()
	const client: vscode.LanguageModelChat = await this.getClient()

	// Clean system prompt and messages (removes terminal escape sequences)
	const cleanedSystemPrompt = this.cleanTerminalOutput(systemPrompt)
	const cleanedMessages = messages.map((msg) => ({
		...msg,
		content: this.cleanMessageContent(msg.content),
	}))

	// Convert Anthropic messages to VS Code LM messages
	const vsCodeLmMessages: vscode.LanguageModelChatMessage[] = [
		vscode.LanguageModelChatMessage.Assistant(cleanedSystemPrompt),
		...convertToVsCodeLmMessages(cleanedMessages),
	]

	// Initialize cancellation token for the request
	this.currentRequestCancellation = new vscode.CancellationTokenSource()

	// Calculate input tokens before starting the stream
	const totalInputTokens: number = await this.calculateTotalInputTokens(vsCodeLmMessages)

	// Accumulate the text and count at the end of the stream
	let accumulatedText: string = ""

	try {
		// Create the response stream with minimal required options
		const requestOptions: vscode.LanguageModelChatRequestOptions = {
			justification: `Cline would like to use '${client.name}' from '${client.vendor}', Click 'Allow' to proceed.`,
		}

		const response: vscode.LanguageModelChatResponse = await client.sendRequest(
			vsCodeLmMessages,
			requestOptions,
			this.currentRequestCancellation.token,
		)

		// Consume the stream and handle both text and tool call chunks
		for await (const chunk of response.stream) {
			if (chunk instanceof vscode.LanguageModelTextPart) {
				if (typeof chunk.value !== "string") {
					console.warn("Cline <Language Model API>: Invalid text part value received:", chunk.value)
					continue
				}

				accumulatedText += chunk.value
				yield {
					type: "text",
					text: chunk.value,
				}
			} else if (chunk instanceof vscode.LanguageModelToolCallPart) {
				try {
					// Validate tool call parameters
					if (!chunk.name || typeof chunk.name !== "string") {
						console.warn("Cline <Language Model API>: Invalid tool name received:", chunk.name)
						continue
					}

					if (!chunk.callId || typeof chunk.callId !== "string") {
						console.warn("Cline <Language Model API>: Invalid tool callId received:", chunk.callId)
						continue
					}

					if (!chunk.input || typeof chunk.input !== "object") {
						console.warn("Cline <Language Model API>: Invalid tool input received:", chunk.input)
						continue
					}

					// Convert tool calls to text format
					const toolCall = {
						type: "tool_call",
						name: chunk.name,
						arguments: chunk.input,
						callId: chunk.callId,
					}

					const toolCallText = JSON.stringify(toolCall)
					accumulatedText += toolCallText

					yield {
						type: "text",
						text: toolCallText,
					}
				} catch (error) {
					console.error("Cline <Language Model API>: Failed to process tool call:", error)
				}
			}
		}

		// Count tokens in the accumulated text after stream completion
		const totalOutputTokens: number = await this.countTokens(accumulatedText)

		// Report final usage after stream completion
		yield {
			type: "usage",
			inputTokens: totalInputTokens,
			outputTokens: totalOutputTokens,
			totalCost: calculateApiCostAnthropic(this.getModel().info, totalInputTokens, totalOutputTokens),
		}
	} catch (error: unknown) {
		this.ensureCleanState()

		if (error instanceof vscode.CancellationError) {
			throw new Error("Cline <Language Model API>: Request cancelled by user")
		}

		throw error
	}
}
Streaming Features:

Cancellation Support: Uses CancellationTokenSource for graceful abort
Token Counting: Uses chars/4 heuristic (intentional trade-off to avoid large tokenizer dependencies)
Tool Call Handling: Converts tool calls to JSON text format for compatibility
Terminal Output Cleaning: Removes ANSI escape sequences and control characters
4. BYOK Provider Comparison
API Handler Factory (src/core/api/index.ts)
function createHandlerForProvider(
	apiProvider: string | undefined,
	options: Omit<ApiConfiguration, "apiProvider">,
	mode: Mode,
): ApiHandler {
	switch (apiProvider) {
		case "anthropic":
			return new AnthropicHandler({
				onRetryAttempt: options.onRetryAttempt,
				apiKey: options.apiKey, // ← BYOK: User provides API key
				anthropicBaseUrl: options.anthropicBaseUrl,
				apiModelId: mode === "plan" ? options.planModeApiModelId : options.actModeApiModelId,
				thinkingBudgetTokens:
					mode === "plan" ? options.planModeThinkingBudgetTokens : options.actModeThinkingBudgetTokens,
			})
		case "openrouter":
			return new OpenRouterHandler({
				onRetryAttempt: options.onRetryAttempt,
				openRouterApiKey: options.openRouterApiKey, // ← BYOK: User provides API key
				openRouterModelId: mode === "plan" ? options.planModeOpenRouterModelId : options.actModeOpenRouterModelId,
				openRouterModelInfo: mode === "plan" ? options.planModeOpenRouterModelInfo : options.actModeOpenRouterModelInfo,
			})
		case "vscode-lm":
			return new VsCodeLmHandler({
				onRetryAttempt: options.onRetryAttempt,
				vsCodeLmModelSelector: // ← NO API KEY: Uses VS Code's built-in auth
					mode === "plan" ? options.planModeVsCodeLmModelSelector : options.actModeVsCodeLmModelSelector,
			})
		// ... other providers
	}
}
BYOK Providers (require API keys):

anthropic → apiKey
openrouter → openRouterApiKey
openai → openAiApiKey
gemini → geminiApiKey
deepseek → deepSeekApiKey
bedrock → awsAccessKey, awsSecretKey
And 30+ more providers...
VS Code LM Provider (no API key):

Uses vsCodeLmModelSelector (vendor/family/version/id)
Authentication handled by VS Code's extension host
Models provided by GitHub Copilot, Azure OpenAI, or other VS Code extensions
5. State Management & Persistence
API Configuration Storage (src/core/storage/StateManager.ts)
export interface Settings {
	// Plan mode configurations
	planModeApiProvider: ApiProvider
	planModeApiModelId: string | undefined
	planModeThinkingBudgetTokens: number | undefined
	planModeReasoningEffort: string | undefined
	planModeVsCodeLmModelSelector: LanguageModelChatSelector | undefined // ← VS Code LM selector
	planModeAwsBedrockCustomSelected: boolean | undefined
	// ... other plan mode settings

	// Act mode configurations
	actModeApiProvider: ApiProvider
	actModeApiModelId: string | undefined
	actModeThinkingBudgetTokens: number | undefined
	actModeReasoningEffort: string | undefined
	actModeVsCodeLmModelSelector: LanguageModelChatSelector | undefined // ← VS Code LM selector
	actModeAwsBedrockCustomSelected: boolean | undefined
	// ... other act mode settings
}

export interface Secrets {
	apiKey: string | undefined // Anthropic
	openRouterApiKey: string | undefined
	awsAccessKey: string | undefined
	awsSecretKey: string | undefined
	openAiApiKey: string | undefined
	geminiApiKey: string | undefined
	// ... 30+ more API keys
	// NOTE: No vsCodeLmApiKey - authentication is delegated to VS Code
}
Storage Architecture:

Global State: Stored in VS Code's globalState (non-sensitive settings)
Secrets: Stored in VS Code's SecretStorage (encrypted API keys)
Task Settings: Per-task overrides stored in tasks/{taskId}/settings.json
Debounced Persistence: 500ms delay to batch writes and reduce I/O
Model Selector Serialization (src/shared/vsCodeSelectorUtils.ts)
export const SELECTOR_SEPARATOR = "/"

export function stringifyVsCodeLmModelSelector(selector: LanguageModelChatSelector): string {
	return [selector.vendor, selector.family, selector.version, selector.id].filter(Boolean).join(SELECTOR_SEPARATOR)
}
Example Selectors:

copilot/gpt-4o → GitHub Copilot's GPT-4o
azure-openai/gpt-4/turbo → Azure OpenAI GPT-4 Turbo
Empty selector {} → First available model
6. Chat History Management
Conversation History Storage (src/core/storage/disk.ts)
export async function getSavedApiConversationHistory(taskId: string): Promise<Anthropic.MessageParam[]> {
	const filePath = path.join(await ensureTaskDirectoryExists(taskId), GlobalFileNames.apiConversationHistory)
	const fileExists = await fileExistsAtPath(filePath)
	if (fileExists) {
		return JSON.parse(await fs.readFile(filePath, "utf8"))
	}
	return []
}

export async function saveApiConversationHistory(taskId: string, apiConversationHistory: Anthropic.MessageParam[]) {
	try {
		const filePath = path.join(await ensureTaskDirectoryExists(taskId), GlobalFileNames.apiConversationHistory)
		await fs.writeFile(filePath, JSON.stringify(apiConversationHistory))
	} catch (error) {
		console.error("Failed to save API conversation history:", error)
	}
}
Storage Locations:

API Conversation History: ~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/tasks/{taskId}/api_conversation_history.json
UI Messages: tasks/{taskId}/ui_messages.json
Task Metadata: tasks/{taskId}/task_metadata.json
Context History: tasks/{taskId}/context_history.json
History Format (Anthropic-compatible):

[
  {
    "role": "user",
    "content": "Hello, can you help me?"
  },
  {
    "role": "assistant",
    "content": [
      {
        "type": "text",
        "text": "Of course! What do you need help with?"
      }
    ]
  }
]
7. MCP (Model Context Protocol) Integration
MCP Tool Registration (src/services/mcp/McpHub.ts)
export class McpHub {
	private connections: Array<{
		server: McpServer
		client: Client
		transport: StdioClientTransport
	}> = []

	async callTool(
		serverName: string,
		toolName: string,
		toolArguments: Record<string, unknown> | undefined,
		ulid: string,
	): Promise<McpToolCallResponse> {
		const connection = this.connections.find((conn) => conn.server.name === serverName)
		if (!connection) {
			throw new Error(`MCP server '${serverName}' not found`)
		}

		try {
			const result = await connection.client.callTool({
				name: toolName,
				arguments: toolArguments,
			})

			this.telemetryService.captureMcpToolCall(
				ulid,
				serverName,
				toolName,
				Object.keys(toolArguments || {}),
				"success",
			)

			return {
				content: result.content,
				isError: result.isError,
			}
		} catch (error) {
			this.telemetryService.captureMcpToolCall(
				ulid,
				serverName,
				toolName,
				Object.keys(toolArguments || {}),
				"error",
			)
			throw error
		}
	}
}
MCP Features:

Tool Discovery: Fetches available tools from MCP servers
Resource Access: Reads resources (files, databases, APIs) via MCP
Auto-Approval: Configurable auto-approval for trusted tools
Marketplace: Catalog of pre-configured MCP servers
VS Code LM + MCP:

VS Code LM API doesn't directly support MCP tools
Cline bridges this by:
Registering MCP tools in the system prompt
Parsing tool calls from model responses
Executing tools via McpHub.callTool()
Returning results in the conversation
8. Reasoning & Thinking Budget
Extended Thinking Support (Anthropic Claude 3.7+)
interface ModelInfo {
	maxTokens?: number
	contextWindow?: number
	supportsImages?: boolean
	supportsPromptCache: boolean
	inputPrice?: number
	outputPrice?: number
	thinkingConfig?: {
		maxBudget?: number // Max allowed thinking budget tokens
		outputPrice?: number // Output price per million tokens when budget > 0
		outputPriceTiers?: PriceTier[] // Optional: Tiered output price when budget > 0
	}
	// ...
}
Thinking Budget Configuration:

Plan Mode: planModeThinkingBudgetTokens (e.g., 6000 tokens)
Act Mode: actModeThinkingBudgetTokens (e.g., 1024 tokens)
Reasoning Effort (OpenAI o1/o3): planModeReasoningEffort ("minimal" | "low" | "medium" | "high")
VS Code LM Limitation:

VS Code LM API doesn't expose thinking budget configuration
Models like GitHub Copilot may use internal reasoning, but it's not controllable
9. Model Discovery & Selection
VS Code LM Model Listing (src/core/controller/models/getVsCodeLmModels.ts)
export async function getVsCodeLmModels(_controller: Controller, _request: EmptyRequest): Promise<VsCodeLmModelsArray> {
	try {
		const models = await vscode.lm.selectChatModels({})

		const protoModels = convertVsCodeNativeModelsToProtoModels(models || [])

		return VsCodeLmModelsArray.create({ models: protoModels })
	} catch (error) {
		console.error("Error fetching VS Code LM models:", error)
		return VsCodeLmModelsArray.create({ models: [] })
	}
}
Model Discovery Flow:

Extension calls vscode.lm.selectChatModels({}) to get all available models
Converts native VS Code models to protobuf format
Sends to webview for UI rendering
User selects model via dropdown (vendor/family/version)
Available Models (depends on installed extensions):

GitHub Copilot: gpt-4o, gpt-4o-mini, o1-preview, o1-mini
Azure OpenAI: Custom deployments
Other Extensions: Any extension implementing vscode.lm API
10. Cost Tracking & Telemetry
Token Counting (VS Code LM)
private async countTokens(text: string | vscode.LanguageModelChatMessage): Promise<number> {
	/**
	 * NOTE (intentional trade-off):
	 * We use a coarse chars/4 heuristic here instead of a real tokenizer (e.g., js-tiktoken with o200k_base).
	 * Rationale:
	 *  - Avoid pulling multi‑MB rank files and increasing the extension install/download size.
	 *  - Eliminate encoder lifecycle/memory concerns in long-running sessions.
	 * Consequences:
	 *  - This is not model-accurate and can under/over-estimate tokens, especially with tool/function calls.
	 *  - It is "good enough" for budgeting/context checks, and we accept the inaccuracy by design.
	 */
	const textContent = typeof text === "string" ? text : this.extractTextFromMessage(text)
	return Math.ceil((textContent || "").length / 4)
}
Cost Calculation:

yield {
	type: "usage",
	inputTokens: totalInputTokens,
	outputTokens: totalOutputTokens,
	totalCost: calculateApiCostAnthropic(this.getModel().info, totalInputTokens, totalOutputTokens),
}
VS Code LM Pricing:

GitHub Copilot: Included in subscription (
10/monthindividual,19/month business)
Azure OpenAI: Pay-as-you-go (user's Azure account)
Other Extensions: Varies by provider
11. Security & Privacy
API Key Storage (BYOK Providers)
// Secrets stored in VS Code's encrypted SecretStorage
export interface Secrets {
	apiKey: string | undefined // Anthropic
	openRouterApiKey: string | undefined
	awsAccessKey: string | undefined
	awsSecretKey: string | undefined
	openAiApiKey: string | undefined
	geminiApiKey: string | undefined
	// ... 30+ more API keys
}

// Stored via VS Code's SecretStorage API
await this.context.secrets.store("apiKey", value)
const apiKey = await this.context.secrets.get("apiKey")
VS Code LM Security:

No API Keys: Authentication delegated to VS Code's extension host
User Consent: Requires user approval for each model request
Justification: Shows reason for model access in approval prompt
const requestOptions: vscode.LanguageModelChatRequestOptions = {
	justification: `Cline would like to use '${client.name}' from '${client.vendor}', Click 'Allow' to proceed.`,
}
12. Plan/Act Mode Architecture
Dual-Mode Configuration
export interface Settings {
	// Plan mode configurations
	planModeApiProvider: ApiProvider
	planModeApiModelId: string | undefined
	planModeVsCodeLmModelSelector: LanguageModelChatSelector | undefined
	planModeThinkingBudgetTokens: number | undefined

	// Act mode configurations
	actModeApiProvider: ApiProvider
	actModeApiModelId: string | undefined
	actModeVsCodeLmModelSelector: LanguageModelChatSelector | undefined
	actModeThinkingBudgetTokens: number | undefined
}
Mode Switching:

async togglePlanActMode(modeToSwitchTo: Mode, chatContent?: ChatContent): Promise<boolean> {
	// Store mode to global state
	this.stateManager.setGlobalState("mode", modeToSwitchTo)

	// Update API handler with new mode
	if (this.task) {
		const apiConfiguration = this.stateManager.getApiConfiguration()
		this.task.api = buildApiHandler({ ...apiConfiguration, ulid: this.task.ulid }, modeToSwitchTo)
	}

	await this.postStateToWebview()
	// ...
}
Use Cases:

Plan Mode: High-reasoning model (e.g., Claude Opus, o1-preview) for planning
Act Mode: Fast model (e.g., Claude Sonnet, GPT-4o) for execution
VS Code LM: Can use different models for each mode (e.g., o1-preview for plan, gpt-4o for act)
13. Key Differences: VS Code LM vs BYOK
| Feature | VS Code LM | BYOK (Anthropic, OpenAI, etc.) | |---------|------------|--------------------------------| | Authentication | VS Code extension host | User-provided API keys | | API Key Management | None (delegated to VS Code) | Stored in encrypted SecretStorage | | Model Selection | vscode.lm.selectChatModels() | Direct API calls with model ID | | Cost | Included in Copilot subscription | Pay-per-token (user's account) | | User Consent | Required for each request | Not required (user owns keys) | | Image Support | No (gracefully degrades) | Yes (Anthropic, OpenAI, Gemini) | | Tool Calling | Yes (via ToolCallPart) | Yes (native support) | | Streaming | Yes (AsyncIterable) | Yes (SSE/WebSocket) | | Token Counting | Heuristic (chars/4) | Exact (from API response) | | Thinking Budget | Not supported | Supported (Anthropic, OpenAI) | | Prompt Caching | Not exposed | Supported (Anthropic, Gemini) |

14. Integration Points
Controller → Task → API Handler
// Controller initializes task with API handler
this.task = new Task({
	controller: this,
	mcpHub: this.mcpHub,
	// ...
})

// Task creates API handler based on mode
const apiConfiguration = this.stateManager.getApiConfiguration()
this.task.api = buildApiHandler({ ...apiConfiguration, ulid: this.task.ulid }, mode)

// Task uses API handler for streaming
for await (const chunk of this.task.api.createMessage(systemPrompt, messages, tools)) {
	if (chunk.type === "text") {
		// Process text chunk
	} else if (chunk.type === "usage") {
		// Track token usage
	}
}
Summary
The VS Code LM integration is a first-class alternative to BYOK providers, offering:

Zero Configuration: No API keys, no billing setup
Seamless Authentication: Leverages VS Code's extension host
Model Flexibility: Works with GitHub Copilot, Azure OpenAI, and any extension implementing vscode.lm
Tool Support: Full tool calling via ToolCallPart/ToolResultPart
Streaming: Efficient async iteration over response chunks
Graceful Degradation: Handles missing features (images, thinking budget) transparently
The architecture demonstrates excellent separation of concerns, with:

Provider abstraction: All providers implement ApiHandler interface
Message transformation: Clean conversion between Anthropic and VS Code formats
State management: Unified storage for both BYOK keys and VS Code selectors
Mode switching: Seamless transitions between plan/act modes
This design allows users to mix and match providers, while maintaining a single codebase for common features like token counting, cost tracking, and tool calling.
