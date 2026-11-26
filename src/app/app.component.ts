import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, effect, signal } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { CharacterPortraitComponent } from "./components/character-portrait.component";
import { EmpireEmblemComponent } from "./components/empire-emblem.component";
import { GAME_CONFIG } from "./config/game.config";
import type {
	AiConfiguration,
	AiProviderId,
	EmpireStatistics,
	GameCharacter,
	GameTab,
	KingdomState,
	NeighboringEmpireChange,
	ReignPeriod,
	StatisticChanges,
} from "./models/game.models";
import { FACTION_LABELS, STATISTIC_LABELS } from "./models/game.models";
import { AiConfigurationService } from "./services/ai-configuration.service";
import { AiProviderService } from "./services/ai-provider.service";
import { GameCalendarService } from "./services/game-calendar.service";
import { GameStateService } from "./services/game-state.service";
import { TextToSpeechService } from "./services/text-tos-peech.service";

@Component({
	selector: "imp-root",
	standalone: true,
	imports: [CommonModule, FormsModule, CharacterPortraitComponent, EmpireEmblemComponent],
	templateUrl: "./app.component.html",
})
export class AppComponent implements OnInit {
	public readonly selectedTab = signal<GameTab>("audience");
	public readonly selectedCharacterId = signal<string | null>(null);
	public readonly isHiddenCharacterDetailsVisible = signal(false);
	public readonly selectedChoiceId = signal<string | null>(null);
	public readonly showSettings = signal(false);
	public readonly showSaveManager = signal(false);
	public readonly isTestingConnection = signal(false);
	public readonly isStartingGame = signal(false);
	public readonly newGameError = signal<string | null>(null);
	public readonly configurationMessage = signal<string | null>(null);
	public readonly configurationError = signal<string | null>(null);
	public readonly setupKingdomName = signal("Imperium Smoka");
	public readonly selectedProvider = signal<AiProviderId>("openai");
	public readonly selectedModel = signal<string>(GAME_CONFIG.providers.defaultModels.openai);
	public readonly gameConfig = GAME_CONFIG;
	public readonly apiKey = signal("");
	public readonly persistApiKey = signal(false);
	public readonly statisticLabels = STATISTIC_LABELS;
	public readonly factionLabels = FACTION_LABELS;
	public readonly selectedCharacter = computed(() => {
		const currentState = this.game.state();
		const selectedId = this.selectedCharacterId();
		if (!currentState || !selectedId) {
			return null;
		}
		return [...currentState.livingCharacters, ...currentState.historicalCharacters].find((character) => character.id === selectedId) ?? null;
	});
	public readonly currentRuler = computed(() => {
		const currentState = this.game.state();
		return currentState ? (this.game.getCurrentRuler(currentState) ?? null) : null;
	});
	public readonly currentSeason = computed(() => {
		const date = this.game.state()?.currentDate;
		return date ? this.calendar.getSeason(date) : null;
	});
	public readonly currentMoonPhase = computed(() => {
		const date = this.game.state()?.currentDate;
		return date ? this.calendar.getMoonPhase(date) : null;
	});
	public readonly isInitialWorldScreen = computed(() => {
		const currentState = this.game.state();
		return Boolean(
			currentState &&
			currentState.operation === "idle" &&
			currentState.currentEvent === null &&
			currentState.lastResolution === null &&
			currentState.chronicle.length === 0,
		);
	});
	public readonly allCharacters = computed(() => {
		const currentState = this.game.state();
		return currentState ? [...currentState.livingCharacters, ...currentState.historicalCharacters] : [];
	});
	public readonly currentSpeaker = computed(() => {
		const currentState = this.game.state();
		const event = currentState?.currentEvent;
		if (!currentState || !event) {
			return null;
		}
		return currentState.livingCharacters.find((character) => character.id === event.speakerCharacterId) ?? null;
	});
	public readonly aiConfigurationReady = computed(() => {
		const configuration = this.aiConfiguration.configuration();
		return (configuration.provider === "ollama" || configuration.apiKey.trim().length > 0) && configuration.model.trim().length > 0;
	});

	public constructor(
		public readonly game: GameStateService,
		public readonly aiConfiguration: AiConfigurationService,
		private readonly aiProvider: AiProviderService,
		private readonly calendar: GameCalendarService,
		public readonly textToSpeech: TextToSpeechService,
	) {
		const configuration = aiConfiguration.configuration();
		this.selectedProvider.set(configuration.provider);
		this.selectedModel.set(configuration.model);
		this.apiKey.set(configuration.apiKey);
		this.persistApiKey.set(configuration.persistApiKey);
		effect(() => {
			const state = this.game.state();
			const isEnabled = this.textToSpeech.isEnabled();
			if (!state || this.selectedTab() !== "audience" || state.operation !== "idle") {
				this.textToSpeech.stop();
				return;
			}
			if (!isEnabled) {
				this.textToSpeech.stop();
				this.lastAutoReadKey = null;
				return;
			}

			if (state.currentEvent) {
				const event = state.currentEvent;
				const narrationKey = `${state.id}:event:${event.id}`;
				if (this.lastAutoReadKey === narrationKey) {
					return;
				}
				this.lastAutoReadKey = narrationKey;
				this.startCurrentNarration();
				return;
			}

			const resolution = state.lastResolution;
			if (resolution) {
				const narrationKey = `${state.id}:resolution:${resolution.appliedAt}:${resolution.title}`;
				if (this.lastAutoReadKey === narrationKey) {
					return;
				}
				this.lastAutoReadKey = narrationKey;
				this.startCurrentNarration();
				return;
			}

			if (this.isInitialWorldScreen()) {
				const narrationKey = `${state.id}:intro`;
				if (this.lastAutoReadKey === narrationKey) {
					return;
				}
				this.lastAutoReadKey = narrationKey;
				this.startCurrentNarration();
			}
		});
	}

	private lastAutoReadKey: string | null = null;

	public startCurrentNarration(): void {
		const state = this.game.state();
		if (!state || !this.textToSpeech.isEnabled() || this.selectedTab() !== "audience" || state.operation !== "idle") {
			return;
		}
		if (state.currentEvent) {
			const event = state.currentEvent;
			const choices = event.choices.map((choice, index) => `Możliwość ${index + 1}: ${choice.description}`).join(". ");
			this.textToSpeech.speak(`${event.title}. ${event.situation}. Dostępne możliwości. ${choices}`);
			return;
		}
		const resolution = state.lastResolution;
		if (resolution) {
			const consequences = state.chronicle
				.filter((entry) => entry.kind === "delayed-consequence" && entry.date > resolution.appliedAt && entry.date <= resolution.nextEventDate)
				.map((entry) => `${entry.title}. ${entry.consequenceDescription}`)
				.join(". ");
			this.textToSpeech.speak(`${resolution.title}. ${resolution.description}${consequences ? `. W międzyczasie nadeszły wieści. ${consequences}` : ""}`);
			return;
		}
		if (this.isInitialWorldScreen()) {
			const ruler = this.game.getCurrentRuler(state);
			const rulerIntroduction = ruler ? `Władca założyciel: ${ruler.fullName}. ${ruler.occupation}. Początek kroniki. ${ruler.biography.join(". ")}` : "";
			this.textToSpeech.speak(`Początek nowego panowania w ${state.kingdomName}. ${this.formatDate(state.currentDate)}. ${rulerIntroduction}`);
		}
	}

	public async ngOnInit(): Promise<void> {
		await this.game.initialize();
		if (!this.aiConfigurationReady()) {
			this.openSettings();
			this.configurationError.set("Skonfiguruj dostawcę AI, model i wymagany klucz API, aby rozpocząć rozgrywkę.");
		}
	}

	public openSettings(): void {
		const configuration = this.aiConfiguration.configuration();
		this.selectedProvider.set(configuration.provider);
		this.selectedModel.set(configuration.model);
		this.apiKey.set(configuration.apiKey);
		this.persistApiKey.set(configuration.persistApiKey);
		this.configurationMessage.set(null);
		this.configurationError.set(null);
		this.showSettings.set(true);
	}

	public onProviderChanged(provider: AiProviderId): void {
		this.selectedProvider.set(provider);
		const availableModels = this.aiConfiguration.providerModels[provider];
		this.selectedModel.set(availableModels[0]);
		this.configurationMessage.set(null);
	}

	public saveConfiguration(): void {
		this.aiConfiguration.updateProvider(this.selectedProvider());
		this.aiConfiguration.updateModel(this.selectedModel().trim());
		this.aiConfiguration.updateApiKey(this.apiKey().trim());
		this.aiConfiguration.updatePersistApiKey(this.persistApiKey());
		this.configurationMessage.set("Konfiguracja została zapisana. Klucz pozostaje w pamięci przeglądarki tylko zgodnie z wybraną opcją.");
		this.configurationError.set(null);
		this.showSettings.set(false);
		this.game.prepareNextAudience();
	}

	public async testConnection(): Promise<void> {
		const configuration = this.buildCurrentConfiguration();
		if ((configuration.provider !== "ollama" && !configuration.apiKey.trim()) || !configuration.model.trim()) {
			this.configurationError.set(configuration.provider === "ollama" ? "Wprowadź nazwę modelu." : "Wprowadź klucz API i nazwę modelu.");
			return;
		}
		this.isTestingConnection.set(true);
		this.configurationMessage.set(null);
		this.configurationError.set(null);
		try {
			await this.aiProvider.testConnection(configuration);
			this.configurationMessage.set("Połączenie działa. Dostawca zwrócił poprawną odpowiedź JSON.");
		} catch (error: unknown) {
			this.configurationError.set(error instanceof Error ? error.message : "Nie udało się przetestować połączenia.");
		} finally {
			this.isTestingConnection.set(false);
		}
	}

	public async startNewGame(): Promise<void> {
		this.newGameError.set(null);
		if (!this.setupKingdomName().trim()) {
			this.newGameError.set("Wpisz nazwę imperium.");
			return;
		}
		if (!this.aiConfigurationReady()) {
			this.openSettings();
			this.configurationError.set("Przed rozpoczęciem gry skonfiguruj dostawcę AI, model i wymagany klucz API.");
			return;
		}
		this.isStartingGame.set(true);
		try {
			await this.game.startNewGame(this.setupKingdomName());
			this.selectedTab.set("audience");
		} catch (error: unknown) {
			this.newGameError.set(error instanceof Error ? error.message : "Nie udało się utworzyć imperium.");
		} finally {
			this.isStartingGame.set(false);
		}
	}

	public returnToMainMenu(): void {
		this.textToSpeech.stop();
		this.game.cancelNextEventPrefetch();
		this.game.state.set(null);
		this.showSaveManager.set(false);
		this.selectedCharacterId.set(null);
	}

	public async loadGame(gameId: string): Promise<void> {
		await this.game.loadGame(gameId);
		this.showSaveManager.set(false);
		this.selectedTab.set("audience");
		this.selectedCharacterId.set(null);
	}

	public async deleteGame(gameId: string): Promise<void> {
		const confirmed = window.confirm("Czy na pewno usunąć ten zapis imperium? Tej operacji nie można cofnąć.");
		if (confirmed) {
			await this.game.deleteGame(gameId);
		}
	}

	public async continueStory(): Promise<void> {
		this.textToSpeech.stop();
		await this.game.generateNextEvent();
	}

	public async chooseOption(choiceId: string): Promise<void> {
		this.textToSpeech.stop();
		this.selectedChoiceId.set(choiceId);
		await this.game.resolveChoice(choiceId);
		if (this.game.state()?.currentEvent === null) {
			this.selectedChoiceId.set(null);
		}
	}

	public async retryLastOperation(): Promise<void> {
		const currentState = this.game.state();
		const selectedChoice = this.selectedChoiceId();
		if (currentState?.currentEvent && selectedChoice) {
			await this.game.resolveChoice(selectedChoice);
			if (this.game.state()?.currentEvent === null) {
				this.selectedChoiceId.set(null);
			}
			return;
		}
		await this.game.generateNextEvent();
	}

	public selectTab(tab: GameTab): void {
		this.selectedTab.set(tab);
		this.selectedCharacterId.set(null);
	}

	public showCharacter(character: GameCharacter): void {
		this.isHiddenCharacterDetailsVisible.set(false);
		this.selectedCharacterId.set(character.id);
	}

	public toggleHiddenCharacterDetails(): void {
		this.isHiddenCharacterDetailsVisible.update((visible) => !visible);
	}

	public closeCharacter(): void {
		this.isHiddenCharacterDetailsVisible.set(false);
		this.selectedCharacterId.set(null);
	}

	public getCharacterEmpire(character: GameCharacter): { name: string; color: string } | undefined {
		const state = this.game.state();
		if (!state) {
			return undefined;
		}
		if (character.empireId === state.id) {
			return { name: state.kingdomName, color: state.empireColor };
		}
		const empire = state.neighboringEmpires.find((candidate) => candidate.id === character.empireId);
		return empire ? { name: empire.name, color: empire.color } : undefined;
	}

	public formatDate(date: string): string {
		const parsedDate = new Date(`${date}T${GAME_CONFIG.content.dateDisplayHour}:00:00`);
		return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", year: "numeric" }).format(parsedDate);
	}

	public formatYear(date: string): number {
		return Number(date.slice(0, 4));
	}

	public formatDayMonth(date: string): string {
		const parsedDate = new Date(`${date}T${GAME_CONFIG.content.dateDisplayHour}:00:00`);
		return new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" }).format(parsedDate);
	}

	public formatShortDate(date: string): string {
		const parsedDate = new Date(`${date}T${GAME_CONFIG.content.dateDisplayHour}:00:00`);
		return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "short", year: "numeric" }).format(parsedDate);
	}

	public getInitials(character: GameCharacter): string {
		return character.fullName
			.split(" ")
			.slice(0, GAME_CONFIG.characters.initialsNamePartLimit)
			.map((part) => part.charAt(0))
			.join("")
			.toUpperCase();
	}

	public getStatisticKeys(): Array<keyof EmpireStatistics> {
		return Object.keys(STATISTIC_LABELS) as Array<keyof EmpireStatistics>;
	}

	public getChangedStatisticKeys(changes: StatisticChanges): Array<keyof EmpireStatistics> {
		return (Object.keys(changes) as Array<keyof EmpireStatistics>).filter((key) => changes[key] !== undefined && changes[key] !== 0);
	}

	public getResolutionConsequences(resolution: NonNullable<KingdomState["lastResolution"]>): KingdomState["chronicle"] {
		const chronicle = this.game.state()?.chronicle ?? [];
		return chronicle.filter((entry) => entry.kind === "delayed-consequence" && entry.date > resolution.appliedAt && entry.date <= resolution.nextEventDate);
	}

	public getResolutionStatisticChanges(resolution: NonNullable<KingdomState["lastResolution"]>): StatisticChanges | undefined {
		const chronicle = this.game.state()?.chronicle ?? [];
		return chronicle.find((entry) => entry.kind === "decision" && entry.date === resolution.appliedAt && entry.title === resolution.title)?.statisticChanges;
	}

	public getResolutionNeighboringEmpireChanges(resolution: NonNullable<KingdomState["lastResolution"]>): NeighboringEmpireChange[] | undefined {
		const chronicle = this.game.state()?.chronicle ?? [];
		return chronicle.find((entry) => entry.kind === "decision" && entry.date === resolution.appliedAt && entry.title === resolution.title)
			?.neighboringEmpireChanges;
	}

	public getNeighboringEmpireChangeLabel(change: NeighboringEmpireChange): string {
		if (change.previousRelationship === null) {
			if (change.nextRelationship === null) {
				throw new Error("Zapis zmiany sąsiedniego imperium nie zawiera nowej wartości relacji.");
			}
			return `${change.empireName}: nowe imperium · relacja ${change.nextRelationship}`;
		}
		if (change.nextRelationship === null) {
			return `${change.empireName}: upadło`;
		}
		const delta = change.nextRelationship - change.previousRelationship;
		return `${change.empireName} ${delta > 0 ? "+" : ""}${delta}`;
	}

	public getStatisticDisplay(state: KingdomState, key: keyof KingdomState["statistics"]): string {
		const value = state.statistics[key];
		return key === "population" ? Math.round(value).toLocaleString("pl-PL") : `${Math.round(value)} / 100`;
	}

	public getStatisticWidth(state: KingdomState, key: keyof KingdomState["statistics"]): string {
		const value = state.statistics[key];
		return `${Math.max(GAME_CONFIG.statistics.min, Math.min(GAME_CONFIG.statistics.max, value))}%`;
	}

	public getStatisticTone(state: KingdomState, key: keyof KingdomState["statistics"]): string {
		const value = state.statistics[key];
		if (key === "administrativeIntegrity") {
			return value < GAME_CONFIG.statistics.integrityLow
				? "text-red-300"
				: value < GAME_CONFIG.statistics.integrityHigh
					? "text-amber-200"
					: "text-emerald-300";
		}
		return value < GAME_CONFIG.statistics.relationsLow
			? "text-red-300"
			: value < GAME_CONFIG.statistics.relationsNeutral
				? "text-amber-200"
				: "text-emerald-300";
	}

	public getNeighborRelationshipTone(relationship: number): string {
		return relationship < GAME_CONFIG.statistics.relationsLow
			? "text-red-300"
			: relationship < GAME_CONFIG.statistics.relationsNeutral
				? "text-amber-200"
				: "text-emerald-300";
	}

	public getReignRuler(reign: ReignPeriod): GameCharacter | undefined {
		return this.allCharacters().find((character) => character.id === reign.rulerCharacterId);
	}

	public hasOpenReign(state: KingdomState, reign: ReignPeriod): boolean {
		return reign.endDate === null && state.currentRulerId === reign.rulerCharacterId;
	}

	public trackById(_index: number, item: { id: string }): string {
		return item.id;
	}

	public getModelOptions(provider: AiProviderId): string[] {
		return this.aiConfiguration.providerModels[provider];
	}

	private buildCurrentConfiguration(): AiConfiguration {
		return {
			provider: this.selectedProvider(),
			model: this.selectedModel().trim(),
			apiKey: this.apiKey().trim(),
			persistApiKey: this.persistApiKey(),
		};
	}
}
