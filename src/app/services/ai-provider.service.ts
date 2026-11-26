import { Injectable } from "@angular/core";
import type { AiConfiguration, AiProviderId } from "../models/game.models";
import { GAME_CONFIG } from "../config/game.config";

export interface AiProvider {
	generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string>;
	testConnection(configuration: AiConfiguration): Promise<void>;
}

export class AiProviderError extends Error {
	public constructor(
		message: string,
		public readonly statusCode: number | null = null,
	) {
		super(message);
		this.name = "AiProviderError";
	}
}

abstract class BaseAiProvider implements AiProvider {
	protected readonly timeoutMilliseconds = GAME_CONFIG.ai.requestTimeoutMilliseconds;

	public abstract generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string>;

	public async testConnection(configuration: AiConfiguration): Promise<void> {
		const response = await this.generateJson(
			"Return JSON only. Do not include Markdown.",
			'Return exactly this JSON object: {"connection":"ok"}',
			configuration,
		);
		const parsed: unknown = JSON.parse(response);
		if (typeof parsed !== "object" || parsed === null || !("connection" in parsed)) {
			throw new AiProviderError("Dostawca zwrócił odpowiedź w nieoczekiwanym formacie.");
		}
	}

	protected async postJson(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
		const controller = new AbortController();
		const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMilliseconds);
		try {
			const response = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify(body),
				signal: controller.signal,
			});
			const responseText = await response.text();
			let parsedResponse: unknown;
			try {
				parsedResponse = JSON.parse(responseText) as unknown;
			} catch {
				throw new AiProviderError("Dostawca zwrócił odpowiedź, której nie można odczytać.", response.status);
			}
			if (!response.ok) {
				throw new AiProviderError(this.getProviderError(parsedResponse, response.status), response.status);
			}
			return parsedResponse;
		} catch (error: unknown) {
			if (error instanceof AiProviderError) {
				throw error;
			}
			if (error instanceof DOMException && error.name === "AbortError") {
				throw new AiProviderError("Przekroczono czas oczekiwania na odpowiedź AI.");
			}
			throw new AiProviderError("Nie udało się połączyć z API. Sprawdź połączenie sieciowe i ustawienia dostawcy.");
		} finally {
			window.clearTimeout(timeoutId);
		}
	}

	protected getProviderError(value: unknown, statusCode: number): string {
		const errorValue = this.readObject(value)?.["error"];
		const errorObject = this.readObject(errorValue);
		const errorMessage = typeof errorValue === "string" ? errorValue : errorObject?.["message"];
		const message = typeof errorMessage === "string" ? errorMessage : "Brak szczegółów od dostawcy.";
		if (statusCode === 401 || statusCode === 403) {
			return `Autoryzacja nie powiodła się. Sprawdź klucz API. ${message}`;
		}
		if (statusCode === 402) {
			return `Dostawca zgłasza brak środków lub aktywnego planu. ${message}`;
		}
		if (statusCode === 429) {
			return `Przekroczono limit zapytań lub tokenów. ${message}`;
		}
		return `Błąd API (${statusCode}). ${message}`;
	}

	protected readObject(value: unknown): Record<string, unknown> | null {
		return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
	}
}

class OpenAiProvider extends BaseAiProvider {
	public async generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		const response = await this.postJson(
			"https://api.openai.com/v1/responses",
			{
				"Content-Type": "application/json",
				Authorization: `Bearer ${configuration.apiKey}`,
			},
			{
				model: configuration.model,
				max_output_tokens: GAME_CONFIG.ai.maxOutputTokens,
				instructions: systemPrompt,
				input: userPrompt,
				text: { format: { type: "json_object" } },
				store: false,
			},
		);
		const responseObject = this.readObject(response);
		const output = responseObject?.["output"];
		if (!Array.isArray(output)) {
			throw new AiProviderError("Odpowiedź OpenAI nie zawiera pola output.");
		}
		const textParts: string[] = [];
		for (const item of output) {
			const itemObject = this.readObject(item);
			const content = itemObject?.["content"];
			if (!Array.isArray(content)) {
				continue;
			}
			for (const part of content) {
				const partObject = this.readObject(part);
				if (partObject?.["type"] === "output_text" && typeof partObject["text"] === "string") {
					textParts.push(partObject["text"]);
				}
			}
		}
		if (textParts.length === 0) {
			throw new AiProviderError("OpenAI nie zwróciło tekstowej odpowiedzi JSON.");
		}
		return textParts.join("\n");
	}
}

class AnthropicProvider extends BaseAiProvider {
	public async generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		const response = await this.postJson(
			"https://api.anthropic.com/v1/messages",
			{
				"Content-Type": "application/json",
				"x-api-key": configuration.apiKey,
				"anthropic-version": "2023-06-01",
				"anthropic-dangerous-direct-browser-access": "true",
			},
			{
				model: configuration.model,
				max_tokens: GAME_CONFIG.ai.maxOutputTokens,
				system: `${systemPrompt}\nZwróć wyłącznie poprawny JSON, bez Markdown i tekstu poza obiektem JSON.`,
				messages: [{ role: "user", content: userPrompt }],
			},
		);
		const responseObject = this.readObject(response);
		const content = responseObject?.["content"];
		if (!Array.isArray(content)) {
			throw new AiProviderError("Odpowiedź Anthropic nie zawiera pola content.");
		}
		const textParts = content.flatMap((part): string[] => {
			const partObject = this.readObject(part);
			return partObject?.["type"] === "text" && typeof partObject["text"] === "string" ? [partObject["text"]] : [];
		});
		if (textParts.length === 0) {
			throw new AiProviderError("Anthropic nie zwróciło tekstowej odpowiedzi JSON.");
		}
		return textParts.join("\n");
	}
}

class GeminiProvider extends BaseAiProvider {
	public async generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		const response = await this.postJson(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
			{
				"Content-Type": "application/json",
				"x-goog-api-key": configuration.apiKey,
			},
			{
				model: configuration.model,
				input: `INSTRUCTIONS:\n${systemPrompt}\n\nUSER INPUT:\n${userPrompt}`,
				response_format: { type: "text", mime_type: "application/json" },
				store: false,
			},
		);
		const responseObject = this.readObject(response);
		const steps = responseObject?.["steps"];
		if (!Array.isArray(steps)) {
			throw new AiProviderError("Odpowiedź Gemini nie zawiera kroków interakcji.");
		}
		const textParts: string[] = [];
		for (const step of steps) {
			const stepObject = this.readObject(step);
			if (stepObject?.["type"] !== "model_output" || !Array.isArray(stepObject["content"])) {
				continue;
			}
			for (const content of stepObject["content"]) {
				const contentObject = this.readObject(content);
				if (contentObject?.["type"] === "text" && typeof contentObject["text"] === "string") {
					textParts.push(contentObject["text"]);
				}
			}
		}
		if (textParts.length === 0) {
			throw new AiProviderError("Gemini nie zwróciło tekstowej odpowiedzi JSON.");
		}
		return textParts.join("\n");
	}
}

class ChatCompletionsProvider extends BaseAiProvider {
	public constructor(
		private readonly endpoint: string,
		private readonly providerName: string,
	) {
		super();
	}

	public async generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		const response = await this.postJson(
			this.endpoint,
			{
				"Content-Type": "application/json",
				Authorization: `Bearer ${configuration.apiKey}`,
			},
			{
				model: configuration.model,
				messages: [
					{ role: "system", content: `${systemPrompt}\nZwróć wyłącznie poprawny JSON, bez Markdown i tekstu poza obiektem JSON.` },
					{ role: "user", content: userPrompt },
				],
				max_tokens: GAME_CONFIG.ai.maxOutputTokens,
				response_format: { type: "json_object" },
			},
		);
		const responseObject = this.readObject(response);
		const choices = responseObject?.["choices"];
		const firstChoice = Array.isArray(choices) ? this.readObject(choices[0]) : null;
		const message = this.readObject(firstChoice?.["message"]);
		if (typeof message?.["content"] !== "string" || message["content"].length === 0) {
			throw new AiProviderError(`Odpowiedź ${this.providerName} nie zawiera tekstowej odpowiedzi JSON.`);
		}
		return message["content"];
	}
}

class OllamaProvider extends BaseAiProvider {
	public async generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		const response = await this.postJson(
			"http://localhost:11434/api/chat",
			{
				"Content-Type": "application/json",
			},
			{
				model: configuration.model,
				messages: [
					{
						role: "system",
						content: `${systemPrompt}\nZwróć wyłącznie poprawny JSON, bez Markdown i tekstu poza obiektem JSON.`,
					},
					{ role: "user", content: userPrompt },
				],
				format: "json",
				stream: false,
				think: false,
				options: {
					temperature: GAME_CONFIG.ai.ollamaTemperature,
					top_p: GAME_CONFIG.ai.ollamaTopP,
					num_ctx: GAME_CONFIG.ai.ollamaContextSize,
					num_predict: GAME_CONFIG.ai.maxOutputTokens,
				},
			},
		);
		const responseObject = this.readObject(response);
		const message = this.readObject(responseObject?.["message"]);
		if (typeof message?.["content"] !== "string" || message["content"].length === 0) {
			throw new AiProviderError("Odpowiedź Ollama nie zawiera tekstowej odpowiedzi JSON.");
		}
		return message["content"];
	}
}

@Injectable({ providedIn: "root" })
export class AiProviderService {
	private readonly providers: Record<AiProviderId, AiProvider> = {
		openai: new OpenAiProvider(),
		anthropic: new AnthropicProvider(),
		gemini: new GeminiProvider(),
		groq: new ChatCompletionsProvider("https://api.groq.com/openai/v1/chat/completions", "Groq"),
		openrouter: new ChatCompletionsProvider("https://openrouter.ai/api/v1/chat/completions", "OpenRouter"),
		ollama: new OllamaProvider(),
	};

	public generateJson(systemPrompt: string, userPrompt: string, configuration: AiConfiguration): Promise<string> {
		return this.providers[configuration.provider].generateJson(systemPrompt, userPrompt, configuration);
	}

	public testConnection(configuration: AiConfiguration): Promise<void> {
		return this.providers[configuration.provider].testConnection(configuration);
	}
}
