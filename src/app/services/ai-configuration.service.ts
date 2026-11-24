import { Injectable, signal } from "@angular/core";
import type { AiConfiguration, AiProviderId, PersistedAiPreferences } from "../models/game.models";
import { GAME_CONFIG } from "../config/game.config";

const PREFERENCES_STORAGE_KEY = "imperium-ai-preferences";
const API_KEY_STORAGE_KEY = "imperium-ai-api-key";

const DEFAULT_MODELS: Record<AiProviderId, string> = {
	openai: GAME_CONFIG.providers.defaultModels.openai,
	anthropic: GAME_CONFIG.providers.defaultModels.anthropic,
	gemini: GAME_CONFIG.providers.defaultModels.gemini,
	ollama: GAME_CONFIG.providers.defaultModels.ollama,
};

@Injectable({ providedIn: "root" })
export class AiConfigurationService {
	public readonly configuration = signal<AiConfiguration>({
		provider: "openai",
		model: DEFAULT_MODELS.openai,
		apiKey: "",
		persistApiKey: false,
	});

	public readonly providerModels: Record<AiProviderId, string[]> = {
		openai: [...GAME_CONFIG.providers.availableModels.openai],
		anthropic: [...GAME_CONFIG.providers.availableModels.anthropic],
		gemini: [...GAME_CONFIG.providers.availableModels.gemini],
		ollama: [...GAME_CONFIG.providers.availableModels.ollama],
	};

	public constructor() {
		this.loadPreferences();
	}

	public updateProvider(provider: AiProviderId): void {
		this.configuration.update((current) => ({
			...current,
			provider,
			model: DEFAULT_MODELS[provider],
		}));
		this.persistPreferences();
	}

	public updateModel(model: string): void {
		this.configuration.update((current) => ({ ...current, model }));
		this.persistPreferences();
	}

	public updateApiKey(apiKey: string): void {
		this.configuration.update((current) => ({ ...current, apiKey }));
		if (this.configuration().persistApiKey) {
			this.persistApiKey(apiKey);
		}
	}

	public updatePersistApiKey(persistApiKey: boolean): void {
		this.configuration.update((current) => ({ ...current, persistApiKey }));
		if (persistApiKey) {
			this.persistApiKey(this.configuration().apiKey);
		} else {
			localStorage.removeItem(API_KEY_STORAGE_KEY);
		}
		this.persistPreferences();
	}

	public clearApiKey(): void {
		this.configuration.update((current) => ({ ...current, apiKey: "", persistApiKey: false }));
		localStorage.removeItem(API_KEY_STORAGE_KEY);
		this.persistPreferences();
	}

	private loadPreferences(): void {
		try {
			const rawPreferences = localStorage.getItem(PREFERENCES_STORAGE_KEY);
			if (!rawPreferences) {
				return;
			}
			const preferences = JSON.parse(rawPreferences) as PersistedAiPreferences;
			const provider = preferences.provider in DEFAULT_MODELS ? preferences.provider : "openai";
			const model = typeof preferences.model === "string" && preferences.model.length > 0 ? preferences.model : DEFAULT_MODELS[provider];
			const apiKey = preferences.persistApiKey ? (localStorage.getItem(API_KEY_STORAGE_KEY) ?? "") : "";
			this.configuration.set({ provider, model, apiKey, persistApiKey: preferences.persistApiKey });
		} catch {
			localStorage.removeItem(PREFERENCES_STORAGE_KEY);
			localStorage.removeItem(API_KEY_STORAGE_KEY);
		}
	}

	private persistPreferences(): void {
		const configuration = this.configuration();
		const preferences: PersistedAiPreferences = {
			provider: configuration.provider,
			model: configuration.model,
			persistApiKey: configuration.persistApiKey,
		};
		localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
	}

	private persistApiKey(apiKey: string): void {
		if (apiKey.length > 0) {
			localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
		} else {
			localStorage.removeItem(API_KEY_STORAGE_KEY);
		}
	}
}
