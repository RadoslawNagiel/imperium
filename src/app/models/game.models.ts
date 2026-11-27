export type AiProviderId = "openai" | "anthropic" | "gemini" | "groq" | "openrouter" | "ollama";
export type GameTab = "audience" | "chronicle" | "characters" | "dynasty";
export type CharacterFaction = "aristocracy" | "clergy" | "chivalry" | "peasantry" | "merchants";
export type CharacterGender = "female" | "male";
export type CharacterStatus = "alive" | "dead";
export type GameOperation = "idle" | "generating-event" | "resolving-decision";
export const EMPIRE_COLORS = ["#d4af37", "#7299c7", "#b86f7d", "#70a780"] as const;
export type EmpireColor = (typeof EMPIRE_COLORS)[number];

export interface EmpireStatistics {
	population: number;
	rulerTrust: number;
	publicSatisfaction: number;
	religiosity: number;
	militaryStrength: number;
	treasury: number;
	foodSupplies: number;
	economicCondition: number;
	administrativeIntegrity: number;
}

export type BoundedStatisticKey = Exclude<keyof EmpireStatistics, "population">;
export type StatisticChanges = Partial<Record<keyof EmpireStatistics, number>>;

export interface GameCharacter {
	id: string;
	empireId: string;
	fullName: string;
	birthDate: string;
	faction: CharacterFaction;
	gender?: CharacterGender;
	occupation: string;
	biography: string[];
	status: CharacterStatus;
	deathDate?: string;
	deathCause?: string;
	hiddenTraits: string[];
}

export interface PlayerChoice {
	id: string;
	description: string;
}

export interface GameEvent {
	id: string;
	date: string;
	title: string;
	situation: string;
	speakerCharacterId: string;
	choices: PlayerChoice[];
	speakerIsNew?: boolean;
	threadDirective?: ThreadDirective;
}

export type ThreadTopic =
	| {
			kind: "statistic";
			statistic: keyof EmpireStatistics;
			label: string;
	  }
	| {
			kind: "neighboring-empire-relationship";
			empireName: string;
	  };

export interface ThreadDirective {
	topic: ThreadTopic | null;
	forceNewThread: boolean;
	forceResolvedThreads: string[];
}

export interface NeighboringEmpire {
	id: string;
	name: string;
	relationship: number;
	color: EmpireColor;
}

export interface NeighboringEmpireChange {
	empireName: string;
	previousRelationship: number | null;
	nextRelationship: number | null;
}

export interface CharacterCreationData {
	id: string;
	empireId: string;
	fullName: string;
	birthDate: string;
	faction: CharacterFaction;
	gender: CharacterGender;
	occupation: string;
	biography: string[];
	hiddenTraits: string[];
}

export type AiCharacterData = Omit<CharacterCreationData, "id" | "empireId"> & { empireName?: string };

export interface AiCharacterReference {
	fullName: string;
	birthDate: string;
	faction: CharacterFaction;
	gender: CharacterGender | null;
	occupation: string;
	empireName: string;
}

export interface InitialWorldAiResponse {
	characters: AiCharacterData[];
	neighboringEmpireName: string;
}

export interface AiCharacterUpdate {
	character: AiCharacterReference;
	empireName?: string;
	biographyAddition?: string;
	occupation?: string;
}

export interface AiCharacterDeath {
	character: AiCharacterReference;
	cause: string;
}

export interface AiConsequenceEffect {
	description: string;
	statisticChanges: StatisticChanges;
	neighboringEmpireRelationshipChanges: Array<{ neighboringEmpireName: string; change: number }>;
	newNeighboringEmpires: Array<{ name: string; relationship: number }>;
	fallenNeighboringEmpireNames: string[];
	characterUpdates: AiCharacterUpdate[];
	deaths: AiCharacterDeath[];
	newRuler: AiCharacterReference | null;
	summaryAddition: string;
	newThreads: string[];
	resolvedThreads: string[];
}

export interface CharacterUpdate {
	characterId: string;
	empireId?: string;
	biographyAddition?: string;
	occupation?: string;
}

export interface CharacterDeath {
	characterId: string;
	cause: string;
}

export interface ConsequenceEffect {
	description: string;
	statisticChanges: StatisticChanges;
	neighboringEmpireRelationshipChanges: Array<{ neighboringEmpireId: string; change: number }>;
	newNeighboringEmpires: Array<{ id: string; name: string; relationship: number }>;
	fallenNeighboringEmpireIds: string[];
	characterUpdates: CharacterUpdate[];
	deaths: CharacterDeath[];
	newRulerId: string | null;
	summaryAddition: string;
	newThreads: string[];
	resolvedThreads: string[];
}

export interface DelayedConsequence {
	id: string;
	sourceEventId: string;
	sourceChoiceId: string;
	dueDate: string;
	title: string;
	effect: ConsequenceEffect;
}

export interface ChronicleEntry {
	id: string;
	date: string;
	title: string;
	situation: string;
	speakerCharacterId: string;
	chosenResponse: string;
	consequenceDescription: string;
	involvedCharacterIds: string[];
	statisticChanges: StatisticChanges;
	neighboringEmpireChanges?: NeighboringEmpireChange[];
	relatedEventIds: string[];
	kind: "decision" | "delayed-consequence" | "succession";
}

export interface ReignPeriod {
	id: string;
	rulerCharacterId: string;
	startDate: string;
	endDate: string | null;
}

export interface KingdomState {
	id: string;
	kingdomName: string;
	empireColor: EmpireColor;
	currentDate: string;
	currentRulerId: string;
	statistics: EmpireStatistics;
	neighboringEmpires: NeighboringEmpire[];
	livingCharacters: GameCharacter[];
	historicalCharacters: GameCharacter[];
	reignHistory: ReignPeriod[];
	chronicle: ChronicleEntry[];
	pendingConsequences: DelayedConsequence[];
	currentEvent: GameEvent | null;
	lastResolution: {
		title: string;
		description: string;
		appliedAt: string;
		nextEventDate: string;
		delayedCount: number;
	} | null;
	historicalSummary: string;
	unresolvedThreads: string[];
	operation: GameOperation;
	lastError: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface NewEventAiResponse {
	date: string;
	title: string;
	situation: string;
	speaker:
		| {
				kind: "existing";
				character: AiCharacterReference;
		  }
		| {
				kind: "new";
				character: AiCharacterData;
		  };
	choices: Array<Pick<PlayerChoice, "description">>;
}

export interface DecisionAiResponse {
	title: string;
	description: string;
	immediateEffect: AiConsequenceEffect;
	delayedConsequences: Array<{
		dueDate: string;
		title: string;
		effect: AiConsequenceEffect;
	}>;
	nextEventDate: string;
}

export interface MaterializedDecisionResponse {
	id: string;
	title: string;
	description: string;
	immediateEffect: ConsequenceEffect;
	delayedConsequences: Array<{
		id: string;
		dueDate: string;
		title: string;
		effect: ConsequenceEffect;
	}>;
	nextEventDate: string;
}

export interface AiConfiguration {
	provider: AiProviderId;
	model: string;
	apiKey: string;
	persistApiKey: boolean;
}

export interface PersistedAiPreferences {
	provider: AiProviderId;
	model: string;
	persistApiKey: boolean;
}

export interface SaveSummary {
	id: string;
	kingdomName: string;
	currentDate: string;
	currentRulerName: string;
	updatedAt: string;
}

export const STATISTIC_LABELS: Record<keyof EmpireStatistics, string> = {
	population: "Ludność",
	rulerTrust: "Zaufanie władcy",
	publicSatisfaction: "Zadowolenie społeczeństwa",
	religiosity: "Religijność",
	militaryStrength: "Siła wojska",
	treasury: "Bogactwo imperium",
	foodSupplies: "Zapasy żywności",
	economicCondition: "Kondycja gospodarcza",
	administrativeIntegrity: "Uczciwość administracji",
};

export const FACTION_LABELS: Record<CharacterFaction, string> = {
	aristocracy: "Arystokracja",
	clergy: "Duchowieństwo",
	chivalry: "Rycerstwo",
	peasantry: "Chłopstwo",
	merchants: "Kupcy",
};
