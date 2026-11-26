export const GAME_CONFIG = {
	world: {
		initialDateMin: "1000-01-01", // Najwcześniejsza możliwa data rozpoczęcia świata.
		initialDateMax: "1000-12-31", // Najpóźniejsza możliwa data rozpoczęcia świata.
		defaultEventIntervalDays: 30, // Liczba dni między rozstrzygnięciem a kolejną audiencją.
		initialPopulationMin: 20, // Minimalna losowana liczba ludności imperium na starcie.
		initialPopulationMax: 100, // Maksymalna losowana liczba ludności imperium na starcie.
		minNeighboringEmpires: 1, // Minimalna liczba sąsiednich imperiów, która musi pozostać.
		maxNeighboringEmpires: 3, // Maksymalna liczba sąsiednich imperiów.
		initialNeighborRelationshipMin: 80, // Minimalna początkowa wartość relacji z sąsiadem.
		initialNeighborRelationshipMax: 100, // Maksymalna początkowa wartość relacji z sąsiadem.
		minNeighboringEmpireNameLength: 2, // Minimalna długość nazwy sąsiedniego imperium.
		maxNeighboringEmpireNameLength: 50, // Maksymalna długość nazwy sąsiedniego imperium.
		initialIndicatorBands: {
			counted: [
				{ min: 10, max: 30, count: 1 }, // Dokładnie tyle wskaźników wylosuj z tego przedziału.
				{ min: 30, max: 50, count: 1 },
				{ min: 80, max: 100, count: 2 },
			],
			remaining: { min: 60, max: 80 }, // Przedział dla pozostałych wskaźników początkowych.
		},
		scaleBands: {
			villageMaxPopulation: 300, // Górny limit skali małej wsi lub osady.
			smallDomainMaxPopulation: 2000, // Górny limit skali kilku wsi lub miasteczka.
			regionalDomainMaxPopulation: 10000, // Górny limit skali małego państwa lub regionu.
		},
	},
	characters: {
		activeLimit: 12, // Maksymalna liczba jednocześnie żyjących i aktywnych postaci.
		maxBiographyEntries: 12, // Maksymalna liczba wpisów w biografii postaci.
		minBiographyEntries: 1, // Minimalna liczba wpisów w biografii postaci.
		maxInitialBiographyEntries: 3, // Maksymalna liczba wpisów biografii na starcie.
		maxHiddenTraits: 3, // Maksymalna liczba ukrytych cech.
		newCharacterAudienceChance: 0.25, // Szansa na wymaganie nowej postaci przy generowaniu.
		maxCharacterUpdates: 3, // Maksymalna liczba aktualizacji postaci w jednym efekcie.
		maxDeathsPerEffect: 20, // Maksymalna liczba śmierci w jednym efekcie.
		minFullNameLength: 3, // Minimalna długość pełnego imienia postaci.
		minOccupationLength: 3, // Minimalna długość opisu zajęcia postaci.
		minBiographyEntryLength: 3, // Minimalna długość pojedynczego wpisu biografii.
		minIdLength: 1, // Minimalna długość identyfikatora postaci.
		initialsNamePartLimit: 2, // Liczba członów imienia używanych do tworzenia inicjałów.
	},
	content: {
		maxUnresolvedThreads: 5, // Maksymalna liczba nierozwiązanych wątków fabularnych.
		minChoiceCount: 2, // Minimalna liczba decyzji dostępnych podczas audiencji.
		maxChoiceCount: 4, // Maksymalna liczba decyzji dostępnych podczas audiencji.
		minChoiceDescriptionLength: 5, // Minimalna długość opisu decyzji.
		minEventTitleLength: 4, // Minimalna długość tytułu wydarzenia.
		minSituationLength: 30, // Minimalna długość opisu sytuacji podczas audiencji.
		minCharacterDeathCauseLength: 3, // Minimalna długość opisu przyczyny śmierci.
		minEffectDescriptionLength: 5, // Minimalna długość opisu pojedynczego efektu.
		minResolutionDescriptionLength: 10, // Minimalna długość opisu rozstrzygnięcia decyzji.
		maxNewThreadsPerEffect: 2, // Maksymalna liczba nowych wątków w jednym efekcie.
		maxResolvedThreadsPerEffect: 5, // Maksymalna liczba rozwiązanych wątków w jednym efekcie.
		forcedThreadResolutionChance: 0.02, // Szansa wymuszenia rozwiązania każdego istniejącego wątku przy audiencji.
		forcedThreadCreationChance: 0.02, // Szansa wymuszenia utworzenia nowego wątku, gdy jest na niego miejsce.
		maxDelayedConsequences: 3, // Maksymalna liczba konsekwencji odroczonych w jednej odpowiedzi AI.
		maxContextChronicleEntries: 6, // Liczba ostatnich wpisów kroniki przekazywanych AI jako kontekst.
		maxRecentChronicleEntries: 4, // Liczba wpisów używana do budowy skróconego kontekstu historii.
		maxUnresolvedThreadsShown: 5, // Maksymalna liczba otwartych wątków przekazywanych AI.
		kingdomNameMaxLength: 50, // Maksymalna długość nazwy imperium gracza.
		dateDisplayHour: 12, // Godzina używana przy formatowaniu dat bez przesunięcia strefy.
	},
	statistics: {
		min: 0, // Minimalna wartość wskaźników i relacji.
		max: 100, // Maksymalna wartość wskaźników i relacji.
		populationMin: 1, // Minimalna ludność po zastosowaniu zmian populacji.
		integrityLow: 35, // Poniżej tej wartości administracja jest oceniana jako słaba.
		integrityHigh: 65, // Od tej wartości administracja jest oceniana jako silna.
		relationsLow: 25, // Dolny próg tonu relacji lub wskaźnika.
		relationsNeutral: 50, // Wartość neutralna relacji z sąsiadem.
		neutralStatistic: 70, // Wartość neutralna statystyki.
	},
	ai: {
		requestAttempts: 3, // Maksymalna liczba prób uzyskania poprawnej odpowiedzi AI.
		requestTimeoutMilliseconds: 90000, // Limit czasu pojedynczego żądania AI w milisekundach.
		maxOutputTokens: 8192, // Maksymalna długość odpowiedzi AI w tokenach.
		ollamaTemperature: 1.5, // Temperatura generowania dla lokalnego modelu Ollama.
		ollamaTopP: 0.8, // Próg nucleus sampling dla lokalnego modelu Ollama.
		ollamaContextSize: 16384, // Rozmiar kontekstu lokalnego modelu Ollama.
	},
	providers: {
		defaultModels: {
			openai: "gpt-6.2-astra", // Domyślny identyfikator modelu OpenAI.
			anthropic: "claude-sonnet-5", // Domyślny identyfikator modelu Anthropic.
			gemini: "gemini-3.8-flash", // Domyślny identyfikator modelu Google Gemini.
			groq: "openai/gpt-oss-20b", // Domyślny identyfikator modelu Groq.
			openrouter: "openai/gpt-4o-mini", // Domyślny identyfikator modelu OpenRouter.
			ollama: "qwen3:30b-a3b", // Domyślny identyfikator modelu Ollama.
		},
		availableModels: {
			openai: ["gpt-6.2-astra", "gpt-6.1-sol", "gpt-6-astra"], // Proponowane modele OpenAI w ustawieniach.
			anthropic: ["claude-sonnet-5", "claude-opus-5", "claude-haiku-4-5-20251001"], // Proponowane modele Anthropic.
			gemini: ["gemini-3.8-flash", "gemini-3.1-pro-preview", "gemini-3.5-flash-lite"], // Proponowane modele Google Gemini.
			groq: ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "meta-llama/llama-4-scout-17b-16e-instruct"], // Proponowane modele Groq.
			openrouter: ["openai/gpt-4o-mini", "anthropic/claude-3.7-sonnet", "google/gemini-2.5-flash"], // Proponowane modele OpenRouter.
			ollama: ["qwen3.5:9B", "qwen3:30b-a3b", "qwen3.8:27b", "qwen3:4b", "qwen3:14b"], // Proponowane modele Ollama.
		},
	},
} as const;
