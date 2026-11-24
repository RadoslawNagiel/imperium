import { Injectable } from "@angular/core";
import type { CharacterGender, DecisionAiResponse, EmpireStatistics, GameCharacter, GameEvent, KingdomState } from "../models/game.models";
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
		initialEmpireId: string,
		initialRulerGender: CharacterGender,
	): { system: string; user: string } {
		const season = this.calendar.getSeason(initialDate);
		const moonPhase = this.calendar.getMoonPhase(initialDate);
		const system = [
			"Jesteś kronikarzem mrocznego świata fantasy, w którym imperium rodzi się pośród niedostatku, spisków, zdrady i brutalnej walki o tron.",
			`Stwórz kompletny, grywalny świat początkowy dla imperium o nazwie: ${kingdomName}.`,
			`Aplikacja przekazała currentDate w kontekście. Użyj dokładnie tej daty przy tworzeniu świata i nie wymyślaj innej. Wygeneruj dokładnie 1 postać - władcę z frakcji royal-family.`,
			`Władca musi mieć: id jako tekst (np. "ruler-1", nigdy liczbę), empireId dokładnie "${initialEmpireId}", fullName jako tekst, birthDate jako tekst YYYY-MM-DD wcześniejszy niż przekazane currentDate, faction dokładnie "royal-family", gender dokładnie "${initialRulerGender}", occupation jako krótką pozycję społeczną, biography jako tablicę dokładnie 1 tekstu oraz relations jako pustą tablicę [].`,
			`hiddenTraits musi zawierać wszystkie klucze loyalty, ambition, intelligence, charisma i cruelty; każda wartość to liczba całkowita od ${GAME_CONFIG.characters.traitMin} do ${GAME_CONFIG.characters.traitMax}. rulerId musi być tym samym tekstem co characters[0].id, a nie liczbą.`,
			"Uwzględnij porę roku i fazę księżyca naturalnie w książkowej historii mrocznego fantasy. To trudne czasy: głód, choroby, przemoc, morderstwa, egzekucje i okrucieństwo polityczne mogą kształtować los imperium. Nie łagodź ich na siłę ani nie zakładaj szczęśliwego zakończenia; opisuj je poważnie, bez epatowania drastycznymi szczegółami.",
			"Pisz obrazowo, nie jak raport lub karta postaci. Walka o tron ma być niebezpieczna i niepewna, a władca nie musi być szlachetny ani zwycięski.",
			"Statystyki początkowe służą wyłącznie jako tło świata. Nie wpisuj do żadnego tekstu ich wartości, procentów, nazw ani ukrytych cech władcy. Niskie lub wysokie wskaźniki pokaż przez sceny i wydarzenia, nie przez liczby. Nie zmieniaj statystyk, nie obliczaj ich ponownie ani nie zwracaj pola statistics.",
			"Zasada tekstów: biography, fullName i occupation mają być wolne od cyfr i liczbowych dopisków; w każdym tekście narracyjnym używaj wyłącznie prozy. Cyfry są dozwolone tylko w wymaganych polach strukturalnych, takich jak id, birthDate i hiddenTraits.",
			"Nie zwracaj pola currentDate — data została ustalona przez aplikację i jest przekazana wyłącznie jako kontekst.",
			"Utwórz nazwę jednego sąsiedniego imperium pasującą do świata. Jego relacja z imperium gracza jest ustalona przez aplikację; nie zwracaj jej ani nie zmieniaj.",
			`Zwróć jeden JSON dokładnie z polami rulerId (id władcy), characters (tablica dokładnie 1 postać zgodna z wymaganymi wyżej polami) oraz neighboringEmpireName (nazwa sąsiedniego imperium). Nie pomijaj wymaganych pól i nie dodawaj innych pól.`,
			"Nie dodawaj statusu postaci, komentarzy, Markdown ani tekstu poza obiektem JSON.",
		].join("\n");
		return {
			system,
			user: `NAZWA IMPERIUM:\n${kingdomName}\nID IMPERIUM (użyj jako characters[0].empireId):\n${initialEmpireId}\nPŁEĆ WŁADCY (użyj dokładnie):\n${initialRulerGender}\n\nDATA STARTOWA (currentDate, kontekst — nie zwracaj w JSON):\n${initialDate}\nPORA ROKU: ${season}\nFAZA KSIĘŻYCA: ${moonPhase.label}\nPOCZĄTKOWA RELACJA Z SĄSIEDNIM IMPERIUM (ustalona przez aplikację, nie zwracaj w JSON): ${initialNeighborRelationship}/100\n\nSTATYSTYKI STARTOWE (kontekst, nie zwracaj ich w JSON):\n${JSON.stringify(initialStatistics)}`,
		};
	}

	public buildNewEventPrompts(state: KingdomState): { system: string; user: string } {
		const activeCharacters = state.livingCharacters.map((character) => this.toAiCharacter(character));
		const eligibleExistingSpeakers = activeCharacters.filter((character) => character.id !== state.currentRulerId);
		const currentRuler = state.livingCharacters.find((character) => character.id === state.currentRulerId);
		const recentChronicle = this.getChronicleContext(state, GAME_CONFIG.content.maxRecentChronicleEntries);
		const context = {
			kingdom: state.kingdomName,
			empireId: state.id,
			currentDate: state.currentDate,
			season: this.calendar.getSeason(state.currentDate),
			moonPhase: this.calendar.getMoonPhase(state.currentDate).label,
			populationScale: this.getPopulationScale(state.statistics.population),
			currentRulerId: state.currentRulerId,
			currentRuler: currentRuler
				? {
						id: currentRuler.id,
						fullName: this.truncateContextText(currentRuler.fullName, 60),
						occupation: this.truncateContextText(currentRuler.occupation, 50),
					}
				: null,
			statistics: state.statistics,
			neighboringEmpires: state.neighboringEmpires,
			livingCharacters: eligibleExistingSpeakers,
			eligibleExistingSpeakerIds: eligibleExistingSpeakers.map((character) => character.id),
			historicalCharacters: state.historicalCharacters.slice(-GAME_CONFIG.content.maxRecentChronicleEntries).map((character) => ({
				id: character.id,
				empireId: character.empireId,
				fullName: this.truncateContextText(character.fullName, 60),
				faction: character.faction,
				deathDate: character.deathDate,
				deathCause: character.deathCause ? this.truncateContextText(character.deathCause, 100) : undefined,
			})),
			recentChronicle,
			historicalSummary: this.truncateContextText(state.historicalSummary, 1500),
			unresolvedThreads: state.unresolvedThreads.slice(-GAME_CONFIG.content.maxUnresolvedThreadsShown).map((thread) => this.truncateContextText(thread, 200)),
			pendingConsequences: this.getPendingConsequencesContext(state),
			activeCharacterLimit: GAME_CONFIG.characters.activeLimit,
			activeCharacterSlots: GAME_CONFIG.characters.activeLimit - state.livingCharacters.length,
		};
		const system = [
			"Jesteś kronikarzem mrocznego fantasy. Wygeneruj jedno wiarygodne wydarzenie wynikające z kontekstu, decyzji, statystyk i motywacji postaci; imperium jest areną brutalnej walki o tron, przetrwanie i władzę.",
			`Skaluj wydarzenie do populationScale. Uwzględnij sezon, fazę księżyca i relacje sąsiadów (${GAME_CONFIG.statistics.min}=wojna, ${GAME_CONFIG.statistics.relationsNeutral}=neutralność, ${GAME_CONFIG.statistics.max}=współpraca), jeśli pasują.`,
			"Każde wydarzenie jest audiencją: speaker przybywa przed władcę, by przedstawić mu wiadomości, prośbę, oskarżenie, raport lub własne świadectwo. situation opisuje sprawę przedstawioną władcy, nie scenę, w której speaker sam podejmuje decyzję za tron.",
			"Data ma być dokładnie równa currentDate. Nie ujawniaj ukrytych cech; postacie mogą kłamać. situation: 2-4 zdania książkowej prozy mrocznego fantasy, bez dialogów. Spiski, zdrada, przemoc i morderstwa są dozwolone, jeśli wynikają z sytuacji; nie unikaj tragicznych zdarzeń ani nie obiecuj szczęśliwego finału. choices: krótkie, różne decyzje dostępne władcy, opisane z perspektywy jego rozkazu lub działania; speaker i doradcy mogą proponować, ale decyzję podejmuje wyłącznie władca.",
			"W żadnym tekście narracyjnym ani nazwie postaci/imperium (title, situation, choices, fullName, biography, occupation, name) nie używaj cyfr, procentów, surowych statystyk ani nazw mechanicznych. Wartości liczbowe należą wyłącznie do wymaganych pól strukturalnych, np. id, date i hiddenTraits. Pokazuj nastroje oraz skutki przez sceny, obrazy i zachowania postaci, nie przez raportowe liczby.",
			`speaker musi być existing z characterId z eligibleExistingSpeakerIds albo new, gdy lista jest pusta lub nie ma odpowiedniego gościa. Nigdy nie wybieraj aktualnego władcy jako existing. Preferuj istniejące postacie i twórz nową tylko wtedy, gdy jest potrzebna i jest wolne miejsce (limit ${GAME_CONFIG.characters.activeLimit}).`,
			`Nowa postać musi zawierać tekstowe pole id (nie textId), empireId (ID imperium gracza ${state.id} lub sąsiada z kontekstu; jeśli przynależność nie wynika z opisu, użyj ${state.id}), fullName, birthDate YYYY-MM-DD, faction (royal-family, aristocracy, clergy, military, commoners, merchants, diplomacy), gender (female, male), occupation oraz hiddenTraits jako obiekt z loyalty, ambition, intelligence, charisma, cruelty (liczby całkowite ${GAME_CONFIG.characters.traitMin}-${GAME_CONFIG.characters.traitMax}). biography i relations mogą być pominięte lub puste; nie dodawaj pustych wpisów biografii. Każda relacja musi zawierać targetCharacterId, relation i description; nie twórz relacji bez tych danych.`,
			`Zwróć tylko JSON: {id,date,title,situation,speaker,choices}. speaker: {kind:"existing",characterId} lub {kind:"new",character:{id,empireId,fullName,birthDate,faction,gender,occupation,biography,relations,hiddenTraits}}; wszystkie pola postaci, w tym biography i relations, umieść wewnątrz character, nie obok niego. choices są wymagane i nie mogą być pominięte: zwróć ${GAME_CONFIG.content.minChoiceCount}-${GAME_CONFIG.content.maxChoiceCount} obiektów {id,description}. Bez Markdown i tekstu poza JSON.`,
		].join("\n");
		return { system, user: `KONTEKST ŚWIATA:\n${JSON.stringify(context)}` };
	}

	public buildDecisionPrompts(state: KingdomState, event: GameEvent, selectedChoiceId: string): { system: string; user: string } {
		const selectedChoice = event.choices.find((choice) => choice.id === selectedChoiceId);
		const currentRuler = state.livingCharacters.find((character) => character.id === state.currentRulerId);
		const context = {
			kingdom: state.kingdomName,
			empireId: state.id,
			currentDate: state.currentDate,
			season: this.calendar.getSeason(state.currentDate),
			moonPhase: this.calendar.getMoonPhase(state.currentDate).label,
			populationScale: this.getPopulationScale(state.statistics.population),
			currentRulerId: state.currentRulerId,
			currentRuler: currentRuler
				? {
						id: currentRuler.id,
						fullName: this.truncateContextText(currentRuler.fullName, 60),
						occupation: this.truncateContextText(currentRuler.occupation, 50),
					}
				: null,
			statistics: state.statistics,
			neighboringEmpires: state.neighboringEmpires,
			livingCharacters: state.livingCharacters.map((character) => this.toAiCharacter(character)),
			historicalCharacters: state.historicalCharacters.slice(-GAME_CONFIG.content.maxRecentChronicleEntries).map((character) => ({
				id: character.id,
				empireId: character.empireId,
				fullName: this.truncateContextText(character.fullName, 60),
				faction: character.faction,
				deathDate: character.deathDate,
				deathCause: character.deathCause ? this.truncateContextText(character.deathCause, 100) : undefined,
			})),
			event: {
				id: event.id,
				date: event.date,
				title: this.truncateContextText(event.title, 100),
				situation: this.truncateContextText(event.situation, 700),
				speakerCharacterId: event.speakerCharacterId,
				choices: event.choices.map((choice) => ({ id: choice.id, description: this.truncateContextText(choice.description, 240) })),
			},
			selectedChoice: selectedChoice ? { id: selectedChoice.id, description: this.truncateContextText(selectedChoice.description, 240) } : null,
			chronicle: this.getChronicleContext(state, GAME_CONFIG.content.maxContextChronicleEntries),
			historicalSummary: this.truncateContextText(state.historicalSummary, 1500),
			unresolvedThreads: state.unresolvedThreads.slice(-GAME_CONFIG.content.maxUnresolvedThreadsShown).map((thread) => this.truncateContextText(thread, 200)),
			pendingConsequences: this.getPendingConsequencesContext(state),
			activeCharacterSlots: GAME_CONFIG.characters.activeLimit - state.livingCharacters.length,
		};
		const system = [
			"Jesteś kronikarzem mrocznego fantasy. Zwróć jeden JSON z wiarygodnym, proporcjonalnym do populationScale rozstrzygnięciem decyzji podjętej przez władcę. Wybrana opcja jest rozkazem lub działaniem władcy, nigdy speakera, doradcy ani innej postaci. Opisz konsekwencje z perspektywy władcy i jego panowania. Uwzględnij historię, statystyki, sezon, fazę księżyca i motywacje postaci. To brutalna walka o tron i przetrwanie: decyzje mogą zawieść, przynieść pyrrusowe zwycięstwo, śmierć, zdradę lub utratę władzy. Nie gwarantuj dobrego ani szczęśliwego zakończenia i nie łagodź konsekwencji na siłę. Pisz zwięźle, ale książkowo; przemoc i morderstwa są dozwolone, bez epatowania drastycznymi szczegółami.",
			"W każdym polu tekstowym przeznaczonym dla gracza — description, effect.description, title, biographyAddition, occupation, cause, summaryAddition, newThreads, fullName, name i opisach relacji — nie wpisuj cyfr (0-9), procentów, surowych wartości statystyk ani technicznych nazw statystyk. Dane liczbowe podawaj wyłącznie w polach strukturalnych, takich jak statisticChanges, relationship, hiddenTraits, id i daty. Zamiast raportować liczby, opisz ich wpływ przez nastroje, obrazy i wydarzenia; nie ujawniaj też hiddenTraits.",
			`W statisticChanges zwracaj DELTY (nie wartości docelowe), a wzrost każdej statystyki jest korzystny. Używaj dokładnie klucza religiosity (nie "religiousity"). Obsługiwane klucze: population (liczba całkowita), rulerTrust, publicSatisfaction, religiosity, militaryStrength, treasury, foodSupplies, economicCondition, administrativeIntegrity. Wysoka administrativeIntegrity oznacza uczciwą administrację.`,
			`Relacje z sąsiadami: ${GAME_CONFIG.statistics.min}=wojna, ${GAME_CONFIG.statistics.relationsNeutral}=neutralność, ${GAME_CONFIG.statistics.max}=współpraca. Każdy element neighboringEmpireRelationshipChanges musi mieć dokładny kształt {"neighboringEmpireId":"id-istniejącego-sąsiada","change":5}; change to delta, nie wartość docelowa. Nie używaj tam empireId, name ani relationship. Możesz dodać imperium (unikalne id, name, relationship), jeśli ich łączna liczba nie przekroczy 3; po efekcie musi pozostać co najmniej jedno. Upadłe usuń przez fallenNeighboringEmpireIds.`,
			`Zwracaj tylko niezbędne zmiany: preferuj maksymalnie 4 characterUpdates, 1 newCharacter, 2 deaths oraz po 2 newThreads i resolvedThreads na effect; przekraczaj to tylko, gdy jest konieczne. Używaj istniejących id postaci. Każda śmierć musi wskazywać characterId istniejącej, aktualnie żyjącej postaci z livingCharacters; nigdy nie wymyślaj id ani nie wskazuj anonimowych lub historycznych postaci. Jeśli nie ma właściwej postaci, pomiń śmierć. cause może być pominięte, wtedy aplikacja oznaczy przyczynę jako nieznaną. Nowa postać wymaga id, empireId, fullName, birthDate, faction, gender, occupation i hiddenTraits; biography i relations mogą być pominięte lub puste, bez pustych wpisów biografii. Każda relacja musi zawierać targetCharacterId, relation i description. empireId musi należeć do gracza (${state.id}) lub aktywnego sąsiada. characterUpdates wymaga characterId z livingCharacters. Nie wskrzeszaj zmarłych; newRulerId może wskazać tylko istniejącą żyjącą postać. Postacie z upadłego imperium zostaną przypisane do gracza.`,
			"ZASADA deaths: każda pozycja musi mieć dokładny kształt {\"characterId\":\"istniejące-id-z-livingCharacters\",\"cause\":\"przyczyna\"}. Wartość characterId kopiuj wyłącznie z id postaci na liście livingCharacters przekazanej w kontekście. deaths dotyczy tylko tych żyjących postaci; nie używaj id z historicalCharacters, nie wymyślaj id i nie wpisuj anonimowych osób. Jeśli nie możesz wskazać pasującego id z livingCharacters, pomiń tę śmierć lub zwróć pustą tablicę. Nigdy nie uśmiercaj tej samej postaci dwa razy.",
			"newThreads i resolvedThreads to tablice tekstów. Każdy effect ma własne description, statisticChanges i neighboringEmpireRelationshipChanges. Zmiany relacji nie mogą dotyczyć imperium, które upada w tym samym efekcie.",
			"Preferuj 0-2 konsekwencje odroczone; dodawaj więcej tylko, jeśli jest to istotne fabularnie. Każda ma unikalne id, dueDate w formacie YYYY-MM-DD, title i pełny obiekt effect. Przenieś opis konsekwencji również do effect.description, aby efekt był poprawnie opisany. Jeśli pominiesz dueDate, aplikacja ustawi je na nextEventDate. nextEventDate możesz pominąć; wtedy aplikacja wyznaczy je jako 30 dni po currentDate.",
			"Możesz pominąć puste tablice lub zwrócić je jako null. statisticChanges może być pominięte lub null. immediateEffect i każde effect muszą być obiektami z niepustym description; opis główny odpowiedzi to osobna narracja. Nie twórz nowych rodzajów statystyk ani systemów mechanicznych.",
			'Kształt: {"id":"decision-1","title":"Decyzja","description":"Opis rozstrzygnięcia","immediateEffect":{"description":"Skutek","statisticChanges":{},"neighboringEmpireRelationshipChanges":[],"newNeighboringEmpires":[],"fallenNeighboringEmpireIds":[],"characterUpdates":[],"newCharacters":[],"deaths":[],"newRulerId":null,"summaryAddition":"","newThreads":[],"resolvedThreads":[]},"delayedConsequences":[],"nextEventDate":"0100-08-01"}. characterUpdates: [{"characterId":"id-z-livingCharacters","biographyAddition":"Nowy fakt"}]. Każdy element newThreads/resolvedThreads to tekst. neighboringEmpireRelationshipChanges jest na tym samym poziomie co statisticChanges.',
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
				id: consequence.id,
				dueDate: consequence.dueDate,
				title: this.truncateContextText(consequence.title, 80),
				effect: this.truncateContextText(consequence.effect.description, 120),
			}));
	}

	private truncateContextText(value: string, maximumLength: number): string {
		return value.length <= maximumLength ? value : `${value.slice(0, maximumLength)}…`;
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

	private toAiCharacter(character: GameCharacter): GameCharacter {
		return {
			id: character.id,
			empireId: character.empireId,
			fullName: this.truncateContextText(character.fullName, 60),
			birthDate: character.birthDate,
			faction: character.faction,
			gender: character.gender,
			occupation: this.truncateContextText(character.occupation, 50),
			biography: character.biography.slice(-1).map((entry) => this.truncateContextText(entry, 140)),
			status: character.status,
			relations: character.relations.slice(-2).map((relation) => ({
				targetCharacterId: relation.targetCharacterId,
				relation: this.truncateContextText(relation.relation, 50),
				description: this.truncateContextText(relation.description, 70),
			})),
			hiddenTraits: character.hiddenTraits,
		};
	}
}
