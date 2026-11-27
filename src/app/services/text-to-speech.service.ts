import { DestroyRef, Injectable, PLATFORM_ID, inject, signal } from "@angular/core";
import { isPlatformBrowser } from "@angular/common";

const SPEECH_PREFERENCES_STORAGE_KEY = "imperium-speech-preferences";

interface PersistedSpeechPreferences {
	isEnabled: boolean;
	selectedVoiceURI: string;
}

@Injectable({
	providedIn: "root",
})
export class TextToSpeechService {
	private readonly platformId = inject(PLATFORM_ID);
	private readonly destroyRef = inject(DestroyRef);

	private readonly speechSynthesis: SpeechSynthesis | null;
	private readonly handleVoicesChanged = (): void => this.loadVoices();
	private currentUtterance: SpeechSynthesisUtterance | null = null;

	public readonly voices = signal<SpeechSynthesisVoice[]>([]);
	public readonly isSupported: boolean;
	public readonly isEnabled = signal(true);
	public readonly selectedVoiceURI = signal("");
	public readonly isSpeaking = signal(false);
	public readonly isPaused = signal(false);

	public constructor() {
		this.isSupported = isPlatformBrowser(this.platformId) && "speechSynthesis" in window;
		this.speechSynthesis = this.isSupported ? window.speechSynthesis : null;
		this.loadPreferences();

		if (!this.speechSynthesis) {
			return;
		}

		this.speechSynthesis.addEventListener("voiceschanged", this.handleVoicesChanged);
		this.loadVoices();

		this.destroyRef.onDestroy(() => {
			this.speechSynthesis?.removeEventListener("voiceschanged", this.handleVoicesChanged);
		});
	}

	public speak(text: string, voice?: SpeechSynthesisVoice): void {
		if (!this.isEnabled() || !this.speechSynthesis || !text.trim()) {
			return;
		}

		this.speechSynthesis.cancel();

		const utterance = new SpeechSynthesisUtterance(text);
		const selectedVoice = voice ?? this.getSelectedVoice() ?? this.getDefaultVoice();

		utterance.lang = selectedVoice?.lang ?? "pl-PL";
		utterance.voice = selectedVoice ?? null;
		utterance.rate = 0.95;
		utterance.pitch = 1;
		utterance.volume = 1;
		utterance.onstart = () => {
			if (this.currentUtterance === utterance) {
				this.isSpeaking.set(true);
				this.isPaused.set(false);
			}
		};
		utterance.onend = () => this.finishUtterance(utterance);
		utterance.onerror = () => this.finishUtterance(utterance);

		this.currentUtterance = utterance;
		this.isSpeaking.set(true);
		this.isPaused.set(false);
		this.speechSynthesis.speak(utterance);
	}

	public pause(): void {
		if (this.currentUtterance && this.isSpeaking() && !this.isPaused()) {
			this.speechSynthesis?.pause();
			this.isPaused.set(true);
		}
	}

	public resume(): void {
		if (this.currentUtterance && this.isPaused()) {
			this.speechSynthesis?.resume();
			this.isPaused.set(false);
		}
	}

	public stop(): void {
		this.speechSynthesis?.cancel();
		this.currentUtterance = null;
		this.isSpeaking.set(false);
		this.isPaused.set(false);
	}

	public setEnabled(enabled: boolean): void {
		this.isEnabled.set(enabled);
		if (!enabled) {
			this.stop();
		}
		this.persistPreferences();
	}

	public selectVoice(voiceURI: string): void {
		this.selectedVoiceURI.set(voiceURI);
		this.persistPreferences();
	}

	public getPolishVoices(): SpeechSynthesisVoice[] {
		return this.voices().filter((voice) => voice.lang.toLowerCase().startsWith("pl"));
	}

	private loadVoices(): void {
		this.voices.set(this.speechSynthesis?.getVoices() ?? []);
	}

	private getDefaultVoice(): SpeechSynthesisVoice | undefined {
		const voices = this.voices();

		return (
			voices.find((voice) => voice.lang.toLowerCase() === "pl-pl" && voice.default) ??
			voices.find((voice) => voice.lang.toLowerCase() === "pl-pl") ??
			voices.find((voice) => voice.lang.toLowerCase().startsWith("pl"))
		);
	}

	private getSelectedVoice(): SpeechSynthesisVoice | undefined {
		const selectedVoiceURI = this.selectedVoiceURI();
		return selectedVoiceURI ? this.voices().find((voice) => voice.voiceURI === selectedVoiceURI) : undefined;
	}

	private finishUtterance(utterance: SpeechSynthesisUtterance): void {
		if (this.currentUtterance !== utterance) {
			return;
		}
		this.currentUtterance = null;
		this.isSpeaking.set(false);
		this.isPaused.set(false);
	}

	private loadPreferences(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}
		try {
			const rawPreferences = localStorage.getItem(SPEECH_PREFERENCES_STORAGE_KEY);
			if (!rawPreferences) {
				return;
			}
			const preferences: unknown = JSON.parse(rawPreferences);
			if (typeof preferences !== "object" || preferences === null || Array.isArray(preferences)) {
				throw new Error("Nieprawidłowy format ustawień czytania.");
			}
			const savedPreferences = preferences as Partial<PersistedSpeechPreferences>;
			this.isEnabled.set(typeof savedPreferences.isEnabled === "boolean" ? savedPreferences.isEnabled : true);
			this.selectedVoiceURI.set(typeof savedPreferences.selectedVoiceURI === "string" ? savedPreferences.selectedVoiceURI : "");
		} catch {
			localStorage.removeItem(SPEECH_PREFERENCES_STORAGE_KEY);
		}
	}

	private persistPreferences(): void {
		if (!isPlatformBrowser(this.platformId)) {
			return;
		}
		const preferences: PersistedSpeechPreferences = {
			isEnabled: this.isEnabled(),
			selectedVoiceURI: this.selectedVoiceURI(),
		};
		localStorage.setItem(SPEECH_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));
	}
}
