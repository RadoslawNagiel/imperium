import { Injectable } from "@angular/core";
import type {
	BoundedStatisticKey,
	CharacterGender,
	EmpireColor,
	EmpireStatistics,
	GameCharacter,
	InitialWorldAiResponse,
	KingdomState,
	NeighboringEmpire,
	ReignPeriod,
} from "../models/game.models";
import { EMPIRE_COLORS } from "../models/game.models";
import { GAME_CONFIG } from "../config/game.config";

@Injectable({ providedIn: "root" })
export class GameFactoryService {
	public createInitialStatistics(): EmpireStatistics {
		const bands = GAME_CONFIG.world.initialIndicatorBands;
		const statisticKeys: BoundedStatisticKey[] = [
			"rulerTrust",
			"publicSatisfaction",
			"religiosity",
			"militaryStrength",
			"treasury",
			"foodSupplies",
			"economicCondition",
			"administrativeIntegrity",
		];
		this.validateInitialIndicatorBands(bands, statisticKeys.length);
		const shuffledKeys = this.shuffle(statisticKeys);
		const assignedBands = new Map<BoundedStatisticKey, { min: number; max: number }>();
		let nextStatisticIndex = 0;
		for (const band of bands.counted) {
			for (const key of shuffledKeys.slice(nextStatisticIndex, nextStatisticIndex + band.count)) {
				assignedBands.set(key, band);
			}
			nextStatisticIndex += band.count;
		}
		for (const key of shuffledKeys.slice(nextStatisticIndex)) {
			assignedBands.set(key, bands.remaining);
		}
		const randomIndicator = (key: BoundedStatisticKey): number => {
			const band = assignedBands.get(key);
			if (!band) {
				throw new Error(`Nie przypisano przedziału początkowej statystyce ${key}.`);
			}
			return this.randomInteger(band.min, band.max);
		};

		return {
			population: this.randomInteger(GAME_CONFIG.world.initialPopulationMin, GAME_CONFIG.world.initialPopulationMax),
			rulerTrust: randomIndicator("rulerTrust"),
			publicSatisfaction: randomIndicator("publicSatisfaction"),
			religiosity: randomIndicator("religiosity"),
			militaryStrength: randomIndicator("militaryStrength"),
			treasury: randomIndicator("treasury"),
			foodSupplies: randomIndicator("foodSupplies"),
			economicCondition: randomIndicator("economicCondition"),
			administrativeIntegrity: randomIndicator("administrativeIntegrity"),
		};
	}

	public createInitialNeighborRelationship(): number {
		return this.randomInteger(GAME_CONFIG.world.initialNeighborRelationshipMin, GAME_CONFIG.world.initialNeighborRelationshipMax);
	}

	public createInitialRulerGender(): CharacterGender {
		const genders: CharacterGender[] = ["female", "male"];
		return genders[this.randomInteger(0, genders.length - 1)];
	}

	public createEmpireId(): string {
		return crypto.randomUUID();
	}

	public createEmpireColor(existingColors: EmpireColor[] = []): EmpireColor {
		const availableColors = EMPIRE_COLORS.filter((color) => !existingColors.includes(color));
		if (availableColors.length === 0) {
			throw new Error("Nie ma wolnego koloru dla kolejnego imperium.");
		}
		return availableColors[this.randomInteger(0, availableColors.length - 1)];
	}

	public createInitialDate(): string {
		const dayInMilliseconds = 24 * 60 * 60 * 1000;
		const firstDay = Date.parse(`${GAME_CONFIG.world.initialDateMin}T00:00:00.000Z`);
		const lastDay = Date.parse(`${GAME_CONFIG.world.initialDateMax}T00:00:00.000Z`);
		const dayCount = Math.floor((lastDay - firstDay) / dayInMilliseconds);
		return new Date(firstDay + this.randomInteger(0, dayCount) * dayInMilliseconds).toISOString().slice(0, 10);
	}

	public createNextEventDate(currentDate: string): string {
		const dayInMilliseconds = 24 * 60 * 60 * 1000;
		const currentTimestamp = Date.parse(`${currentDate}T00:00:00.000Z`);
		if (!Number.isFinite(currentTimestamp) || new Date(currentTimestamp).toISOString().slice(0, 10) !== currentDate) {
			throw new Error(`Nie można wyznaczyć następnej daty na podstawie nieprawidłowej daty: ${currentDate}.`);
		}
		const nextDate = new Date(currentTimestamp + GAME_CONFIG.world.defaultEventIntervalDays * dayInMilliseconds).toISOString().slice(0, 10);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
			throw new Error("Nie można wyznaczyć prawidłowej daty następnego wydarzenia.");
		}
		return nextDate;
	}

	public createNewGame(
		kingdomName: string,
		initialWorld: InitialWorldAiResponse,
		initialDate: string,
		statistics: EmpireStatistics,
		initialNeighborRelationship: number,
		empireId: string,
		empireColor: EmpireColor,
	): KingdomState {
		const now = new Date().toISOString();
		const characterIds = new Map(initialWorld.characters.map((character) => [character.id, crypto.randomUUID()]));
		const getCharacterId = (sourceId: string): string => {
			const characterId = characterIds.get(sourceId);
			if (!characterId) {
				throw new Error(`Nie odnaleziono początkowej postaci o identyfikatorze ${sourceId}.`);
			}
			return characterId;
		};
		const livingCharacters: GameCharacter[] = initialWorld.characters.map(({ id, ...character }) => ({
			...character,
			id: getCharacterId(id),
			status: "alive",
			relations: character.relations.map((relation) => ({
				...relation,
				targetCharacterId: getCharacterId(relation.targetCharacterId),
			})),
		}));
		const rulerId = getCharacterId(initialWorld.rulerId);
		const firstReign: ReignPeriod = {
			id: crypto.randomUUID(),
			rulerCharacterId: rulerId,
			startDate: initialDate,
			endDate: null,
		};
		return {
			id: empireId,
			kingdomName: kingdomName.trim(),
			empireColor,
			currentDate: initialDate,
			currentRulerId: rulerId,
			statistics,
			neighboringEmpires: [this.createNeighboringEmpire(initialWorld.neighboringEmpireName, initialNeighborRelationship, [], empireId, empireColor)],
			livingCharacters,
			historicalCharacters: [],
			reignHistory: [firstReign],
			chronicle: [],
			pendingConsequences: [],
			currentEvent: null,
			lastResolution: null,
			historicalSummary: "",
			unresolvedThreads: [],
			operation: "idle",
			lastError: null,
			createdAt: now,
			updatedAt: now,
		};
	}

	public createNeighboringEmpire(
		name: string,
		relationship: number,
		existing: NeighboringEmpire[],
		empireId: string,
		empireColor: EmpireColor,
		id: string = crypto.randomUUID(),
	): NeighboringEmpire {
		const normalizedName = name.trim();
		if (normalizedName.length < GAME_CONFIG.world.minNeighboringEmpireNameLength || normalizedName.length > GAME_CONFIG.world.maxNeighboringEmpireNameLength) {
			throw new Error("Nazwa sąsiedniego imperium ma nieprawidłową długość.");
		}
		if (!Number.isInteger(relationship) || relationship < GAME_CONFIG.statistics.min || relationship > GAME_CONFIG.statistics.max) {
			throw new Error("Relacja z sąsiednim imperium musi być liczbą całkowitą z dozwolonego zakresu.");
		}
		if (existing.length >= GAME_CONFIG.world.maxNeighboringEmpires) {
			throw new Error(`Nie można utworzyć więcej niż ${GAME_CONFIG.world.maxNeighboringEmpires} sąsiednich imperiów.`);
		}
		if (id === empireId || existing.some((empire) => empire.id === id || empire.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
			throw new Error("Identyfikator lub nazwa sąsiedniego imperium są już używane.");
		}
		const availableColors = EMPIRE_COLORS.filter((color) => color !== empireColor && !existing.some((empire) => empire.color === color));
		if (availableColors.length === 0) {
			throw new Error("Nie ma wolnego koloru dla kolejnego sąsiedniego imperium.");
		}
		return {
			id,
			name: normalizedName,
			relationship,
			color: availableColors[this.randomInteger(0, availableColors.length - 1)],
		};
	}

	private randomInteger(minimum: number, maximum: number): number {
		return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
	}

	private validateInitialIndicatorBands(
		bands: typeof GAME_CONFIG.world.initialIndicatorBands,
		statisticCount: number,
	): void {
		const ranges = [...bands.counted, bands.remaining];
		for (const range of ranges) {
			if (
				!Number.isInteger(range.min) ||
				!Number.isInteger(range.max) ||
				range.min < GAME_CONFIG.statistics.min ||
				range.max > GAME_CONFIG.statistics.max ||
				range.min > range.max
			) {
				throw new Error("Przedziały początkowych statystyk muszą być całkowitymi wartościami w dozwolonym zakresie.");
			}
		}
		const countedStatisticTotal = bands.counted.reduce((total, band) => {
			if (!Number.isInteger(band.count) || band.count < 0) {
				throw new Error("Liczba statystyk w każdym skonfigurowanym przedziale musi być nieujemną liczbą całkowitą.");
			}
			return total + band.count;
		}, 0);
		if (countedStatisticTotal > statisticCount) {
			throw new Error(`Skonfigurowano ${countedStatisticTotal} statystyk w przedziałach, ale dostępnych jest tylko ${statisticCount}.`);
		}
	}

	private shuffle<T>(values: T[]): T[] {
		const shuffled = [...values];
		for (let index = shuffled.length - 1; index > 0; index--) {
			const randomIndex = Math.floor(Math.random() * (index + 1));
			const currentValue = shuffled[index];
			shuffled[index] = shuffled[randomIndex];
			shuffled[randomIndex] = currentValue;
		}
		return shuffled;
	}
}
