import { Injectable } from "@angular/core";
import type {
	AiCharacterReference,
	CharacterGender,
	DecisionAiResponse,
	EmpireStatistics,
	GameCharacter,
	GameEvent,
	KingdomState,
	ThreadDirective,
} from "../models/game.models";
import { STATISTIC_LABELS } from "../models/game.models";
import { GAME_CONFIG } from "../config/game.config";
import { GameCalendarService } from "./game-calendar.service";

@Injectable({ providedIn: "root" })
export class AiPromptService {
	public constructor(private readonly calendar: GameCalendarService) {}

	public buildInitialWorldPrompts(
		kingdomName: string,
		initialDate: string,
		initialStatistics: EmpireStatistics,
		initialNeighborRelationship: number,
		initialRulerGender: CharacterGender,
	): { system: string; user: string } {
		const season = this.calendar.getSeason(initialDate);
		const moonPhase = this.calendar.getMoonPhase(initialDate);
		const system = [
			"Jesteś kronikarzem mrocznego świata fantasy, w którym imperium rodzi się pośród niedostatku, spisków, zdrady i brutalnej walki o tron.",
			`Stwórz kompletny, grywalny świat początkowy dla imperium o nazwie: ${kingdomName}.`,
			"Data currentDate jest kontekstem. Użyj jej do stworzenia dokładnie jednej postaci założycielskiej z frakcji royal-family; data urodzenia musi być wcześniejsza.",
			"Uwzględnij porę roku i fazę księżyca naturalnie w książkowej historii mrocznego fantasy. To trudne czasy: głód, choroby, przemoc, morderstwa, egzekucje i okrucieństwo polityczne mogą kształtować los imperium. Nie łagodź ich na siłę ani nie zakładaj szczęśliwego zakończenia; opisuj je poważnie, bez epatowania drastycznymi szczegółami.",
			"Pisz obrazowo, nie jak raport lub karta postaci. Walka o tron ma być niebezpieczna i niepewna, a władca nie musi być szlachetny ani zwycięski.",
			"Statystyki początkowe służą wyłącznie jako tło świata. Nie wpisuj do żadnego tekstu ich wartości, procentów, nazw ani ukrytych cech władcy. Niskie lub wysokie wskaźniki pokaż przez sceny i wydarzenia, nie przez liczby. Nie zmieniaj statystyk, nie obliczaj ich ponownie ani nie zwracaj pola statistics.",
			"Zasada tekstów: biography, fullName i occupation mają być wolne od cyfr i liczbowych dopisków; w każdym tekście narracyjnym używaj wyłącznie prozy. Data urodzenia jest jedynym polem daty.",
			"Utwórz nazwę jednego sąsiedniego imperium pasującą do świata. Jego relacja z imperium gracza jest ustalona przez aplikację; nie zwracaj jej ani nie zmieniaj.",
			"Nie twórz ani nie zwracaj identyfikatorów. Zwróć wyłącznie dane zgodne z tym interfejsem TypeScript:",
			"type InitialWorldResponse = {",
			"  characters: [{",
			'    fullName: string; birthDate: string; faction: "royal-family"; gender: "female" | "male";',
			"    occupation: string; biography: string[]; hiddenTraits: [string, string, string];",
			"  }];",
			"  neighboringEmpireName: string;",
			"};",
			`characters ma zawierać dokładnie jedną postać, dokładnie jeden wpis, a gender ma być dokładnie "${initialRulerGender}". hiddenTraits ma zawierać dokładnie trzy różne opisy cech (maksymalnie 80 znaków każdy).`,
			"Nie dodawaj statusu postaci, komentarzy, Markdown ani tekstu poza obiektem JSON.",
		].join("\n");
		return {
			system,
			user: `NAZWA IMPERIUM:\n${kingdomName}\nPŁEĆ WŁADCY:\n${initialRulerGender}\n\nDATA ŚWIATA (currentDate, kontekst):\n${initialDate}\nPORA ROKU: ${season}\nFAZA KSIĘŻYCA: ${moonPhase.label}\nPOCZĄTKOWA RELACJA Z SĄSIEDNIM IMPERIUM (ustalona przez aplikację): ${initialNeighborRelationship}/100\n\nSTATYSTYKI STARTOWE (kontekst, nie zwracaj ich w JSON):\n${JSON.stringify(initialStatistics)}`,
		};
	}

	public buildNewEventPrompts(state: KingdomState, threadDirective: ThreadDirective, forceNewSpeaker = false): { system: string; user: string } {
		const eligibleExistingSpeakers = state.livingCharacters
			.filter((character) => character.id !== state.currentRulerId)
			.map((character) => this.toAiCharacter(character, state));
		const currentRuler = state.livingCharacters.find((character) => character.id === state.currentRulerId);
		const recentChronicle = this.getChronicleContext(state, GAME_CONFIG.content.maxRecentChronicleEntries);
		const indicatorStatistics = [
			{ key: "rulerTrust", value: state.statistics.rulerTrust },
			{ key: "publicSatisfaction", value: state.statistics.publicSatisfaction },
			{ key: "religiosity", value: state.statistics.religiosity },
			{ key: "militaryStrength", value: state.statistics.militaryStrength },
			{ key: "treasury", value: state.statistics.treasury },
			{ key: "foodSupplies", value: state.statistics.foodSupplies },
			{ key: "economicCondition", value: state.statistics.economicCondition },
			{ key: "administrativeIntegrity", value: state.statistics.administrativeIntegrity },
		] as const;
		const lowestStatisticValue = Math.min(...indicatorStatistics.map((statistic) => statistic.value));
		const highestStatisticValue = Math.max(...indicatorStatistics.map((statistic) => statistic.value));
		const statisticExtremes = {
			lowest: indicatorStatistics
				.filter((statistic) => statistic.value === lowestStatisticValue)
				.map((statistic) => ({ name: STATISTIC_LABELS[statistic.key], value: statistic.value })),
			highest: indicatorStatistics
				.filter((statistic) => statistic.value === highestStatisticValue)
				.map((statistic) => ({ name: STATISTIC_LABELS[statistic.key], value: statistic.value })),
		};
		const context = {
			kingdom: state.kingdomName,
			currentDate: state.currentDate,
			season: this.calendar.getSeason(state.currentDate),
			moonPhase: this.calendar.getMoonPhase(state.currentDate).label,
			populationScale: this.getPopulationScale(state.statistics.population),
			currentRuler: currentRuler ? this.toAiCharacter(currentRuler, state) : null,
			statistics: state.statistics,
			statisticExtremes,
			neighboringEmpires: state.neighboringEmpires.map(({ name, relationship }) => ({ name, relationship })),
			livingCharacters: eligibleExistingSpeakers,
			historicalCharacters: state.historicalCharacters.slice(-GAME_CONFIG.content.maxRecentChronicleEntries).map((character) => ({
				...this.toAiCharacter(character, state),
				deathDate: character.deathDate,
				deathCause: character.deathCause ? this.truncateContextText(character.deathCause, 100) : undefined,
			})),
			recentChronicle,
			historicalSummary: this.truncateContextText(state.historicalSummary, 1500),
			unresolvedThreads: state.unresolvedThreads.slice(-GAME_CONFIG.content.maxUnresolvedThreadsShown).map((thread) => this.truncateContextText(thread, 200)),
			threadAgenda: threadDirective,
			pendingConsequences: this.getPendingConsequencesContext(state),
			activeCharacterLimit: GAME_CONFIG.characters.activeLimit,
			activeCharacterSlots: GAME_CONFIG.characters.activeLimit - state.livingCharacters.length,
			mustGenerateNewCharacter: forceNewSpeaker,
		};
		const system = [
			"Jesteś kronikarzem mrocznego fantasy. Wygeneruj wyłącznie wyjątkowe, przełomowe wydarzenie, które może trwale zmienić bieg historii imperium i wymaga decyzji władcy o dalekosiężnych skutkach; imperium jest areną brutalnej walki o tron, przetrwanie i władzę.",
			"Nie generuj codziennych spraw, rutynowych raportów, zwykłych próśb, drobnych sporów ani lokalnych incydentów bez poważnych następstw. Stawka musi dotyczyć losu tronu lub dynastii, wojny i granic, buntu, sojuszy, wiary, przetrwania ludności albo przyszłości państwa. Możesz budować lub eskalować istniejące wątki, ale nie powtarzaj podobnego wydarzenia bez nowego, istotnego zwrotu. Zachowaj skalę odpowiednią do populationScale.",
			"Zazwyczaj buduj audiencję wokół jednej ze skrajnych statystyk podanych w statisticExtremes: wybierz najniższą albo najwyższą, tę która najlepiej pasuje do historii i prowadzi do przełomowej sytuacji. Jeśli threadAgenda.topic wskazuje konkretny temat, ma on pierwszeństwo. Przełóż stan statystyki na kryzys, napięcie lub szansę, nie cytuj wartości liczbowej; przy populacji uwzględniaj populationScale zamiast surowej liczby. Odchodź od wybranego tematu tylko wtedy, gdy ważniejsza jest ciągłość historii lub pilna konsekwencja.",
			"Zastosuj threadAgenda z kontekstu: jeśli forceResolvedThreads zawiera wątki, audiencja ma przygotować ich rozwiązanie; jeśli forceNewThread jest true, audiencja musi wprowadzić nowy, fabularnie uzasadniony wątek. Jeśli topic nie jest null, audiencja ma dotyczyć wskazanego tematu (statystyki albo relacji z podanym sąsiadem). Wymuszone rozwiązania i utworzenie muszą zostać wykonane bezpośrednio w najbliższym rozstrzygnięciu tej audiencji.",
			`Skaluj wydarzenie do populationScale. Uwzględnij sezon, fazę księżyca i relacje sąsiadów (${GAME_CONFIG.statistics.min}=wojna, ${GAME_CONFIG.statistics.relationsNeutral}=neutralność, ${GAME_CONFIG.statistics.max}=współpraca), jeśli pasują.`,
			"Każde wydarzenie jest audiencją: speaker przybywa przed władcę, by przedstawić mu wiadomości, prośbę, oskarżenie, raport lub własne świadectwo. situation opisuje sprawę przedstawioną władcy, nie scenę, w której speaker sam podejmuje decyzję za tron.",
			"Data ma być dokładnie równa currentDate. Nie ujawniaj ukrytych cech; postacie mogą kłamać. situation: 2-4 zdania książkowej prozy mrocznego fantasy, bez dialogów. Spiski, zdrada, przemoc i morderstwa są dozwolone, jeśli wynikają z sytuacji; nie unikaj tragicznych zdarzeń ani nie obiecuj szczęśliwego finału. choices: krótkie, różne decyzje dostępne władcy, opisane z perspektywy jego rozkazu lub działania; speaker i doradcy mogą proponować, ale decyzję podejmuje wyłącznie władca.",
			"W żadnym tekście narracyjnym ani nazwie postaci/imperium (title, situation, choices, fullName, biography, occupation, name) nie używaj cyfr, procentów, surowych statystyk ani nazw mechanicznych. Daty zapisuj jako YYYY-MM-DD. Pokazuj nastroje oraz skutki przez sceny, obrazy i zachowania postaci, nie przez raportowe liczby.",
			`speaker musi wskazywać postać przez jej pełny profil z livingCharacters albo zawierać nową postać. Nigdy nie wybieraj aktualnego władcy jako existing. Jeśli mustGenerateNewCharacter jest true, speaker MUSI być nową postacią. W pozostałych przypadkach wybierz postać istniejącą albo nową stosownie do fabuły. Nowa postać może pochodzić z sąsiedniego imperium. Nie generuj identyfikatorów.`,
			"Zwróć wyłącznie dane zgodne z tym interfejsem TypeScript:",
			'type CharacterFaction = "royal-family" | "aristocracy" | "clergy" | "military" | "commoners" | "merchants" | "diplomacy";',
			'type CharacterGender = "female" | "male";',
			"type CharacterReference = { fullName: string; birthDate: string; faction: CharacterFaction; gender: CharacterGender | null; occupation: string; empireName: string; };",
			"type CharacterData = { fullName: string; birthDate: string; faction: CharacterFaction; gender: CharacterGender; occupation: string; biography: string[]; hiddenTraits: [string, string, string]; empireName?: string; };",
			'type NewEventResponse = { date: string; title: string; situation: string; speaker: { kind: "existing"; character: CharacterReference; } | { kind: "new"; character: CharacterData; }; choices: Array<{ description: string; }>; };',
			`date ma być równe currentDate. Zwróć od ${GAME_CONFIG.content.minChoiceCount} do ${GAME_CONFIG.content.maxChoiceCount} choices. Nowa postać ma mieć co najmniej jeden wpis biography i dokładnie trzy hiddenTraits.`,
			"Nie dodawaj żadnych pól spoza interfejsu. Nie zwracaj id ani innych identyfikatorów. Bez Markdown i tekstu poza JSON.",
		].join("\n");
		return { system, user: `KONTEKST ŚWIATA:\n${JSON.stringify(context)}` };
	}

	public buildDecisionPrompts(state: KingdomState, event: GameEvent, selectedChoiceId: string): { system: string; user: string } {
		const selectedChoice = event.choices.find((choice) => choice.id === selectedChoiceId);
		const currentRuler = state.livingCharacters.find((character) => character.id === state.currentRulerId);
		const eventSpeaker = [...state.livingCharacters, ...state.historicalCharacters].find((character) => character.id === event.speakerCharacterId);
		const threadDirective = event.threadDirective ?? { topic: null, forceNewThread: false, forceResolvedThreads: [] };
		const context = {
			kingdom: state.kingdomName,
			currentDate: state.currentDate,
			season: this.calendar.getSeason(state.currentDate),
			moonPhase: this.calendar.getMoonPhase(state.currentDate).label,
			populationScale: this.getPopulationScale(state.statistics.population),
			currentRuler: currentRuler ? this.toAiCharacter(currentRuler, state) : null,
			statistics: state.statistics,
			neighboringEmpires: state.neighboringEmpires.map(({ name, relationship }) => ({ name, relationship })),
			livingCharacters: state.livingCharacters.map((character) => this.toAiCharacter(character, state)),
			eligibleSuccessors: state.livingCharacters
				.filter((character) => character.id !== state.currentRulerId)
				.map((character) => this.toAiCharacter(character, state)),
			historicalCharacters: state.historicalCharacters.slice(-GAME_CONFIG.content.maxRecentChronicleEntries).map((character) => ({
				...this.toAiCharacter(character, state),
				deathDate: character.deathDate,
				deathCause: character.deathCause ? this.truncateContextText(character.deathCause, 100) : undefined,
			})),
			event: {
				date: event.date,
				title: this.truncateContextText(event.title, 100),
				situation: this.truncateContextText(event.situation, 700),
				speaker: eventSpeaker ? this.toAiCharacter(eventSpeaker, state) : null,
				choices: event.choices.map((choice) => ({ description: this.truncateContextText(choice.description, 240) })),
			},
			selectedChoice: selectedChoice ? { description: this.truncateContextText(selectedChoice.description, 240) } : null,
			threadAgenda: threadDirective,
			chronicle: this.getChronicleContext(state, GAME_CONFIG.content.maxContextChronicleEntries),
			historicalSummary: this.truncateContextText(state.historicalSummary, 1500),
			unresolvedThreads: state.unresolvedThreads.slice(-GAME_CONFIG.content.maxUnresolvedThreadsShown).map((thread) => this.truncateContextText(thread, 200)),
			maximumUnresolvedThreads: GAME_CONFIG.content.maxUnresolvedThreads,
			pendingConsequences: this.getPendingConsequencesContext(state),
			activeCharacterSlots: GAME_CONFIG.characters.activeLimit - state.livingCharacters.length,
		};
		const system = [
			"Jesteś kronikarzem mrocznego fantasy. Zwróć jeden JSON z wiarygodnym, proporcjonalnym do populationScale rozstrzygnięciem decyzji podjętej przez władcę. Wybrana opcja jest rozkazem lub działaniem władcy, nigdy speakera, doradcy ani innej postaci. Opisz konsekwencje z perspektywy władcy i jego panowania. Uwzględnij historię, statystyki, sezon, fazę księżyca i motywacje postaci. To brutalna walka o tron i przetrwanie: decyzje mogą zawieść, przynieść pyrrusowe zwycięstwo, śmierć, zdradę lub utratę władzy. Nie gwarantuj dobrego ani szczęśliwego zakończenia i nie łagodź konsekwencji na siłę. Pisz zwięźle, ale książkowo; przemoc i morderstwa są dozwolone, bez epatowania drastycznymi szczegółami.",
			"W każdym polu tekstowym przeznaczonym dla gracza — description, effect.description, title, biographyAddition, occupation, cause, summaryAddition, newThreads, fullName i name — nie wpisuj cyfr (0-9), procentów, surowych wartości statystyk ani technicznych nazw statystyk. Daty zapisuj jako YYYY-MM-DD; delty statisticChanges oraz change są liczbami. Zamiast raportować liczby, opisz ich wpływ przez nastroje, obrazy i wydarzenia; nie ujawniaj ukrytych cech postaci w narracji.",
			`W statisticChanges zwracaj DELTY (nie wartości docelowe), a wzrost każdej statystyki jest korzystny. Używaj dokładnie klucza religiosity (nie "religiousity"). Obsługiwane klucze: population (liczba całkowita), rulerTrust, publicSatisfaction, religiosity, militaryStrength, treasury, foodSupplies, economicCondition, administrativeIntegrity. Wysoka administrativeIntegrity oznacza uczciwą administrację.`,
			`Relacje z sąsiadami: ${GAME_CONFIG.statistics.min}=wojna, ${GAME_CONFIG.statistics.relationsNeutral}=neutralność, ${GAME_CONFIG.statistics.max}=współpraca. neighboringEmpireRelationshipChanges wskazuje imperium przez jego dokładną nazwę z kontekstu, a change jest deltą, nie wartością docelową. Możesz utworzyć imperium, jeśli łączna liczba sąsiadów nie przekroczy ${GAME_CONFIG.world.maxNeighboringEmpires}; po efekcie musi pozostać co najmniej jedno. Upadające imperia wskazuj ich nazwami; nie zmieniaj relacji z imperium upadającym w tym samym efekcie.`,
			"Rozstrzygnięcie audiencji i jego konsekwencje odroczone nie mogą tworzyć nowych postaci. Nowe postacie pojawiają się wyłącznie jako speaker audiencji. Odnoś się do istniejących postaci przez dokładny profil z kontekstu.",
			'gender każdej nowej postaci musi być dokładnie "female" albo "male"; nie tłumacz tych wartości ani nie zastępuj ich opisem tekstowym.',
			"OBOWIĄZKOWA SUKCESJA: jeśli efekt zabija aktualnego władcę, newRuler musi być profilem innej postaci z eligibleSuccessors, która nie jest uśmiercana w tym efekcie. Jeśli nie ma dostępnego następcy, nie uśmiercaj aktualnego władcy.",
			"Każde odwołanie do istniejącej postaci w characterUpdates, deaths lub newRuler musi zawierać jej dokładny profil skopiowany z livingCharacters lub eligibleSuccessors. Nie używaj postaci historycznych ani nowo tworzonych jako celu tych odwołań.",
			"newThreads i resolvedThreads to tablice tekstów. Każdy effect ma własne description, statisticChanges i neighboringEmpireRelationshipChanges. Zmiany relacji nie mogą dotyczyć imperium, które upada w tym samym efekcie.",
			"Zastosuj threadAgenda z kontekstu w immediateEffect tej odpowiedzi: każdy wątek z forceResolvedThreads musi zostać rozwiązany teraz przez wpis o identycznym tekście w immediateEffect.resolvedThreads; nie odkładaj tego na delayedConsequences. Jeśli forceNewThread jest true, immediateEffect.newThreads musi zawierać co najmniej jeden nowy, unikalny wątek. Jeśli topic nie jest null, konsekwencje audiencji powinny dotyczyć wskazanego tematu. Po zastosowaniu zmian nie może pozostać więcej nierozwiązanych wątków niż maximumUnresolvedThreads.",
			"Preferuj 0-2 konsekwencje odroczone; dodawaj więcej tylko, jeśli jest to istotne fabularnie. Każda musi mieć dueDate w formacie YYYY-MM-DD, title i pełny obiekt effect. Przenieś opis konsekwencji również do effect.description, aby efekt był poprawnie opisany. Zawsze zwróć nextEventDate późniejszą od currentDate.",
			"Zwróć wszystkie pola wymagane przez interfejs. Gdy nie ma zmian, zwróć puste tablice i pusty obiekt statisticChanges; newRuler ustaw na null, jeśli nie zmienia się władca. immediateEffect i każde effect muszą być obiektami z niepustym description; opis główny odpowiedzi to osobna narracja. Nie twórz nowych rodzajów statystyk ani systemów mechanicznych.",
			"Zwróć wyłącznie dane zgodne z tym interfejsem TypeScript:",
			'type CharacterFaction = "royal-family" | "aristocracy" | "clergy" | "military" | "commoners" | "merchants" | "diplomacy";',
			'type CharacterGender = "female" | "male";',
			"type CharacterReference = { fullName: string; birthDate: string; faction: CharacterFaction; gender: CharacterGender | null; occupation: string; empireName: string; };",
			"type CharacterData = { fullName: string; birthDate: string; faction: CharacterFaction; gender: CharacterGender; occupation: string; biography: string[]; hiddenTraits: [string, string, string]; empireName?: string; };",
			'type Effect = { description: string; statisticChanges: Partial<Record<"population" | "rulerTrust" | "publicSatisfaction" | "religiosity" | "militaryStrength" | "treasury" | "foodSupplies" | "economicCondition" | "administrativeIntegrity", number>>; neighboringEmpireRelationshipChanges: Array<{ neighboringEmpireName: string; change: number; }>; newNeighboringEmpires: Array<{ name: string; relationship: number; }>; fallenNeighboringEmpireNames: string[]; characterUpdates: Array<{ character: CharacterReference; empireName?: string; biographyAddition?: string; occupation?: string; }>; deaths: Array<{ character: CharacterReference; cause: string; }>; newRuler: CharacterReference | null; summaryAddition: string; newThreads: string[]; resolvedThreads: string[]; };',
			"type DecisionResponse = { title: string; description: string; immediateEffect: Effect; delayedConsequences: Array<{ dueDate: string; title: string; effect: Effect; }>; nextEventDate: string; };",
			"Każde pole ma typ i znaczenie dokładnie takie, jak w interfejsie. Identyfikatory wszystkich nowych obiektów tworzy aplikacja: nie zwracaj żadnych identyfikatorów. Istniejące postacie i imperia wskazuj przez pełne profile/nazwy z kontekstu. CharacterReference musi być skopiowany dokładnie, łącznie z gender null, jeśli tak podano. CharacterData.empireName może być nazwą imperium gracza lub sąsiada; pominięcie oznacza imperium gracza. newNeighboringEmpires.relationship to relacja początkowa (liczba całkowita w zakresie od 0 do 100), a neighboringEmpireRelationshipChanges.change to delta. Każdy element newThreads i resolvedThreads jest tekstem.",
			"Nie dodawaj Markdown, komentarzy ani tekstu poza JSON. Nie ujawniaj ukrytych cech postaci.",
		].join("\n");
		return { system, user: `AKTUALNY STAN I WYBRANA DECYZJA:\n${JSON.stringify(context)}` };
	}

	private getChronicleContext(state: KingdomState, limit: number): Array<Record<string, string>> {
		return state.chronicle.slice(-limit).map((entry) => ({
			date: entry.date,
			title: this.truncateContextText(entry.title, 120),
			situation: this.truncateContextText(entry.situation, 160),
			chosenResponse: this.truncateContextText(entry.chosenResponse, 120),
			consequenceDescription: this.truncateContextText(entry.consequenceDescription, 180),
		}));
	}

	private getPendingConsequencesContext(state: KingdomState): Array<Record<string, string>> {
		return state.pendingConsequences
			.slice()
			.sort((first, second) => first.dueDate.localeCompare(second.dueDate))
			.slice(0, 3)
			.map((consequence) => ({
				dueDate: consequence.dueDate,
				title: this.truncateContextText(consequence.title, 80),
				effect: this.truncateContextText(consequence.effect.description, 120),
			}));
	}

	private truncateContextText(value: string, maximumLength: number): string {
		return value.length <= maximumLength ? value : `${value.slice(0, maximumLength - 1)}…`;
	}

	private getPopulationScale(population: number): string {
		const bands = GAME_CONFIG.world.scaleBands;
		if (population <= bands.villageMaxPopulation) {
			return "jedna mała wieś lub osada; wydarzenia lokalne, niewielu mieszkańców i najwyżej mała straż";
		}
		if (population <= bands.smallDomainMaxPopulation) {
			return "kilka wsi lub niewielkie miasteczko; ograniczony dwór i lokalne siły";
		}
		if (population <= bands.regionalDomainMaxPopulation) {
			return "małe państwo lub region; kilka osad, skromna administracja i ograniczone wojsko";
		}
		return "rozległe państwo; większe instytucje i siły są możliwe, ale nadal proporcjonalne do populacji i zasobów";
	}

	public getResolutionSummary(response: DecisionAiResponse): string {
		return response.immediateEffect.description;
	}

	private toAiCharacter(character: GameCharacter, state: KingdomState): AiCharacterReference & { biography: string[]; hiddenTraits: string[] } {
		return {
			fullName: this.truncateContextText(character.fullName, 60),
			birthDate: character.birthDate,
			faction: character.faction,
			gender: character.gender ?? null,
			occupation: this.truncateContextText(character.occupation, 50),
			empireName:
				character.empireId === state.id
					? state.kingdomName
					: (state.neighboringEmpires.find((empire) => empire.id === character.empireId)?.name ?? "Nieznane imperium"),
			biography: character.biography.slice(-3).map((entry) => this.truncateContextText(entry, 140)),
			hiddenTraits: character.hiddenTraits,
		};
	}
}
