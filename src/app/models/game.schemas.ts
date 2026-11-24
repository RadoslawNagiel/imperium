import { z } from "zod";
import type {
	CharacterFaction,
	CharacterGender,
	DecisionAiResponse,
	InitialWorldAiResponse,
	NeighboringEmpire,
	NewEventAiResponse,
} from "./game.models";
import { GAME_CONFIG } from "../config/game.config";

const factionValues: [CharacterFaction, ...CharacterFaction[]] = ["royal-family", "aristocracy", "clergy", "military", "commoners", "merchants", "diplomacy"];
const genderValues: [CharacterGender, ...CharacterGender[]] = ["female", "male"];

const arrayOrEmpty = <T extends z.ZodType>(itemSchema: T, max?: number) => {
	const arraySchema = max === undefined ? z.array(itemSchema) : z.array(itemSchema).max(max);
	return z.preprocess((value: unknown) => (value === undefined || value === null ? [] : value), arraySchema);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function addMissingCharacterId(value: unknown): unknown {
	if (!isRecord(value) || (typeof value["id"] === "string" && value["id"].length > 0)) {
		return value;
	}
	const providedId = [value["characterId"], value["textId"]].find((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
	const id = providedId ?? crypto.randomUUID();
	return { ...value, id };
}

type NeighborRelationshipContext = ReadonlyArray<Pick<NeighboringEmpire, "id" | "name" | "relationship">>;

function normalizeNeighborRelationshipChanges(value: unknown, neighboringEmpires: NeighborRelationshipContext): unknown[] {
	const changes = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
	return changes.map((change) => {
		if (!isRecord(change)) {
			return change;
		}
		const providedId = [change["neighboringEmpireId"], change["empireId"], change["neighborEmpireId"], change["id"]].find(
			(candidate): candidate is string => typeof candidate === "string" && candidate.length > 0,
		);
		const byId = providedId ? neighboringEmpires.find((empire) => empire.id === providedId) : undefined;
		const name = typeof change["name"] === "string" ? change["name"] : undefined;
		const byName = name ? neighboringEmpires.find((empire) => empire.name === name) : undefined;
		const existingEmpire = byId ?? byName;
		const neighboringEmpireId = existingEmpire?.id ?? providedId;
		const delta =
			typeof change["change"] === "number"
				? change["change"]
				: typeof change["relationship"] === "number" && existingEmpire
					? change["relationship"] - existingEmpire.relationship
					: undefined;
		return {
			...change,
			...(neighboringEmpireId ? { neighboringEmpireId } : {}),
			...(delta !== undefined ? { change: delta } : {}),
		};
	});
}

function normalizeConsequenceEffect(value: unknown, neighboringEmpires: NeighborRelationshipContext = []): unknown {
	if (!isRecord(value)) {
		return value;
	}
	const effect = { ...value };
	if (isRecord(effect["statisticChanges"]) && "neighboringEmpireRelationshipChanges" in effect["statisticChanges"]) {
		const statistics = { ...effect["statisticChanges"] };
		const misplacedChanges = statistics["neighboringEmpireRelationshipChanges"];
		delete statistics["neighboringEmpireRelationshipChanges"];
		effect["statisticChanges"] = statistics;
		const existingChanges = effect["neighboringEmpireRelationshipChanges"];
		const asArray = (input: unknown): unknown[] => (Array.isArray(input) ? input : input === undefined || input === null ? [] : [input]);
		effect["neighboringEmpireRelationshipChanges"] = [...asArray(existingChanges), ...asArray(misplacedChanges)];
	}
	if (effect["neighboringEmpireRelationshipChanges"] !== undefined && effect["neighboringEmpireRelationshipChanges"] !== null) {
		effect["neighboringEmpireRelationshipChanges"] = normalizeNeighborRelationshipChanges(effect["neighboringEmpireRelationshipChanges"], neighboringEmpires);
	}
	if (isRecord(effect["statisticChanges"]) && "religiousity" in effect["statisticChanges"]) {
		const statistics = { ...effect["statisticChanges"] };
		if (!("religiosity" in statistics)) {
			statistics["religiosity"] = statistics["religiousity"];
		}
		delete statistics["religiousity"];
		effect["statisticChanges"] = statistics;
	}
	if (Array.isArray(effect["characterUpdates"])) {
		effect["characterUpdates"] = effect["characterUpdates"].map((update) =>
			isRecord(update) && typeof update["characterId"] !== "string" && typeof update["id"] === "string" ? { ...update, characterId: update["id"] } : update,
		);
	}
	if (Array.isArray(effect["newCharacters"])) {
		effect["newCharacters"] = effect["newCharacters"].map(addMissingCharacterId);
	}
	if (Array.isArray(effect["deaths"])) {
		effect["deaths"] = effect["deaths"].map((death) => {
			if (!isRecord(death)) {
				return death;
			}
			const characterId =
				typeof death["characterId"] === "string" && death["characterId"].length > 0
					? death["characterId"]
					: typeof death["id"] === "string" && death["id"].length > 0
						? death["id"]
						: undefined;
			const cause = [death["cause"], death["reason"], death["description"]].find(
				(candidate): candidate is string => typeof candidate === "string" && candidate.trim().length >= GAME_CONFIG.content.minCharacterDeathCauseLength,
			);
			return {
				...death,
				...(characterId ? { characterId } : {}),
				cause: cause ?? "Przyczyna nieznana",
			};
		});
	}
	for (const field of ["newThreads", "resolvedThreads"] as const) {
		if (Array.isArray(effect[field])) {
			effect[field] = effect[field].map((thread) => {
				if (!isRecord(thread)) {
					return thread;
				}
				for (const key of ["description", "text", "title", "summary", "content", "thread"]) {
					if (typeof thread[key] === "string") {
						return thread[key];
					}
				}
				return thread;
			});
		}
	}
	return effect;
}

const traitsSchema = z.object({
	loyalty: z.number().int().min(GAME_CONFIG.characters.traitMin).max(GAME_CONFIG.characters.traitMax),
	ambition: z.number().int().min(GAME_CONFIG.characters.traitMin).max(GAME_CONFIG.characters.traitMax),
	intelligence: z.number().int().min(GAME_CONFIG.characters.traitMin).max(GAME_CONFIG.characters.traitMax),
	charisma: z.number().int().min(GAME_CONFIG.characters.traitMin).max(GAME_CONFIG.characters.traitMax),
	cruelty: z.number().int().min(GAME_CONFIG.characters.traitMin).max(GAME_CONFIG.characters.traitMax),
});

const relationSchema = z.object({
	targetCharacterId: z.string().min(GAME_CONFIG.characters.minIdLength),
	relation: z.string().min(GAME_CONFIG.characters.minRelationTextLength),
	description: z.string().min(GAME_CONFIG.characters.minRelationTextLength),
});

function normalizeRelations(value: unknown): unknown[] {
	const relations = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value];
	return relations.filter(
		(relation) =>
			isRecord(relation) &&
			typeof relation["targetCharacterId"] === "string" &&
			relation["targetCharacterId"].trim().length >= GAME_CONFIG.characters.minIdLength &&
			typeof relation["relation"] === "string" &&
			relation["relation"].trim().length >= GAME_CONFIG.characters.minRelationTextLength &&
			typeof relation["description"] === "string" &&
			relation["description"].trim().length >= GAME_CONFIG.characters.minRelationTextLength,
	);
}

const relationsOrEmpty = (max?: number) => {
	const relationArray = max === undefined ? z.array(relationSchema) : z.array(relationSchema).max(max);
	return z.preprocess(normalizeRelations, relationArray);
};

const neighboringEmpireSchema = z.object({
	id: z.string().min(1),
	name: z.string().trim().min(GAME_CONFIG.world.minNeighboringEmpireNameLength).max(GAME_CONFIG.world.maxNeighboringEmpireNameLength),
	relationship: z.number().int().min(GAME_CONFIG.statistics.min).max(GAME_CONFIG.statistics.max),
});

const biographyArrayOrEmpty = z.preprocess(
	(value: unknown) => {
		const entries = Array.isArray(value) ? value : typeof value === "string" ? [value] : value === undefined || value === null ? [] : value;
		return Array.isArray(entries) ? entries.filter((entry) => typeof entry !== "string" || entry.trim().length > 0) : entries;
	},
	z.array(z.string().min(GAME_CONFIG.characters.minBiographyEntryLength)).max(GAME_CONFIG.characters.maxBiographyEntries),
);

export const characterCreationSchema = z.object({
	id: z.string().min(GAME_CONFIG.characters.minIdLength),
	empireId: z.string().min(1),
	fullName: z.string().min(GAME_CONFIG.characters.minFullNameLength),
	birthDate: z.string().date(),
	faction: z.enum(factionValues),
	gender: z.enum(genderValues),
	occupation: z.string().min(GAME_CONFIG.characters.minOccupationLength),
	biography: biographyArrayOrEmpty,
	relations: relationsOrEmpty(GAME_CONFIG.characters.maxRelations),
	hiddenTraits: traitsSchema,
});

const initialWorldSchema = z
	.object({
		rulerId: z.string().min(GAME_CONFIG.characters.minIdLength),
		characters: z.array(characterCreationSchema).length(1),
		neighboringEmpireName: z.string().trim().min(GAME_CONFIG.world.minNeighboringEmpireNameLength).max(GAME_CONFIG.world.maxNeighboringEmpireNameLength),
	})
	.superRefine((world, context) => {
		const ruler = world.characters.find((character) => character.id === world.rulerId);
		if (!ruler) {
			context.addIssue({ code: "custom", message: "Wskazany władca musi należeć do początkowych postaci.", path: ["rulerId"] });
		} else if (ruler.faction !== "royal-family") {
			context.addIssue({ code: "custom", message: "Początkowy władca musi należeć do frakcji royal-family.", path: ["rulerId"] });
		}
		for (const [characterIndex, character] of world.characters.entries()) {
			if (character.biography.length !== 1) {
				context.addIssue({
					code: "custom",
					message: "Biografia początkowej postaci musi zawierać dokładnie jeden wpis.",
					path: ["characters", characterIndex, "biography"],
				});
			}
			if (character.relations.length > 0) {
				context.addIssue({
					code: "custom",
					message: "Początkowa postać nie może mieć relacji.",
					path: ["characters", characterIndex, "relations"],
				});
			}
		}
	});

const choiceSchema = z.object({
	id: z.string().min(1),
	description: z.string().min(GAME_CONFIG.content.minChoiceDescriptionLength),
});

function normalizeNewEventResponse(value: unknown, defaultEmpireId?: string): unknown {
	if (!isRecord(value) || !isRecord(value["speaker"]) || value["speaker"]["kind"] !== "new") {
		return value;
	}
	const speaker = value["speaker"];
	if (!isRecord(speaker["character"])) {
		return value;
	}
	const character = addMissingCharacterId(speaker["character"]);
	if (!isRecord(character)) {
		return value;
	}
	for (const field of ["biography", "relations"] as const) {
		if ((character[field] === undefined || character[field] === null) && speaker[field] !== undefined && speaker[field] !== null) {
			character[field] = speaker[field];
		}
	}
	if ((typeof character["empireId"] !== "string" || character["empireId"].length === 0) && defaultEmpireId) {
		character["empireId"] = defaultEmpireId;
	}
	return {
		...value,
		speaker: { ...speaker, character },
	};
}

export const newEventSchema = z.preprocess(
	(value) => normalizeNewEventResponse(value),
	z.object({
		id: z.string().min(1),
		date: z.string().date(),
		title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
		situation: z.string().min(GAME_CONFIG.content.minSituationLength),
		speaker: z.discriminatedUnion("kind", [
			z.object({ kind: z.literal("existing"), characterId: z.string().min(1) }),
			z.object({ kind: z.literal("new"), character: characterCreationSchema }),
		]),
		choices: z.array(choiceSchema).min(GAME_CONFIG.content.minChoiceCount).max(GAME_CONFIG.content.maxChoiceCount),
	}),
);

const characterUpdateSchema = z.object({
	characterId: z.string().min(1),
	empireId: z
		.string()
		.min(1)
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
	biographyAddition: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
	newRelations: relationsOrEmpty(),
	occupation: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
});

const characterDeathSchema = z.object({
	characterId: z.string().min(1),
	cause: z.string().min(GAME_CONFIG.content.minCharacterDeathCauseLength),
});

const neighboringEmpireRelationshipChangeSchema = z.object({
	neighboringEmpireId: z.string().min(1),
	change: z.number(),
});

const statisticsSchema = z
	.object({
		population: z.number().int().optional(),
		rulerTrust: z.number().optional(),
		publicSatisfaction: z.number().optional(),
		religiosity: z.number().optional(),
		militaryStrength: z.number().optional(),
		treasury: z.number().optional(),
		foodSupplies: z.number().optional(),
		economicCondition: z.number().optional(),
		administrativeIntegrity: z.number().optional(),
	})
	.strict();

export const consequenceEffectSchema = z.preprocess(
	(value) => normalizeConsequenceEffect(value),
	z.object({
		description: z.string().min(GAME_CONFIG.content.minEffectDescriptionLength),
		statisticChanges: z.preprocess((value: unknown) => (value === undefined || value === null ? {} : value), statisticsSchema),
		neighboringEmpireRelationshipChanges: arrayOrEmpty(neighboringEmpireRelationshipChangeSchema, GAME_CONFIG.world.maxNeighboringEmpires),
		newNeighboringEmpires: arrayOrEmpty(neighboringEmpireSchema, GAME_CONFIG.world.maxNeighboringEmpires),
		fallenNeighboringEmpireIds: arrayOrEmpty(z.string().min(1), GAME_CONFIG.world.maxNeighboringEmpires),
		characterUpdates: arrayOrEmpty(characterUpdateSchema, GAME_CONFIG.characters.maxCharacterUpdates),
		newCharacters: arrayOrEmpty(characterCreationSchema, GAME_CONFIG.characters.maxNewCharactersPerEffect),
		deaths: arrayOrEmpty(characterDeathSchema, GAME_CONFIG.characters.maxDeathsPerEffect),
		newRulerId: z
			.string()
			.nullable()
			.optional()
			.transform((value) => value ?? null),
		summaryAddition: z
			.string()
			.nullable()
			.optional()
			.transform((value) => value ?? ""),
		newThreads: arrayOrEmpty(z.string(), GAME_CONFIG.content.maxNewThreadsPerEffect),
		resolvedThreads: arrayOrEmpty(z.string(), GAME_CONFIG.content.maxResolvedThreadsPerEffect),
	}),
);

function normalizeDecisionResponse(value: unknown, fallbackNextEventDate?: string, neighboringEmpires: NeighborRelationshipContext = []): unknown {
	if (!isRecord(value)) {
		return value;
	}
	const response = { ...value };
	if ("immediateEffect" in response) {
		response["immediateEffect"] = normalizeConsequenceEffect(response["immediateEffect"], neighboringEmpires);
	}
	const providedNextEventDate = response["nextEventDate"];
	const nextEventDate = typeof providedNextEventDate === "string" && providedNextEventDate.length > 0 ? providedNextEventDate : fallbackNextEventDate;
	if (nextEventDate) {
		response["nextEventDate"] = nextEventDate;
	}
	if (!Array.isArray(response["delayedConsequences"])) {
		return response;
	}
	return {
		...response,
		delayedConsequences: response["delayedConsequences"].map((consequence) => {
			if (!isRecord(consequence)) {
				return consequence;
			}
			const normalizedConsequence = { ...consequence };
			const dueDate = consequence["dueDate"];
			if (typeof dueDate !== "string" || dueDate.length === 0) {
				const alternativeDate = consequence["date"];
				if (typeof alternativeDate === "string" && alternativeDate.length > 0) {
					normalizedConsequence["dueDate"] = alternativeDate;
				} else if (typeof nextEventDate === "string") {
					normalizedConsequence["dueDate"] = nextEventDate;
				}
			}
			const effect = isRecord(consequence["effect"]) ? { ...consequence["effect"] } : {};
			if ((typeof effect["description"] !== "string" || effect["description"].length === 0) && typeof consequence["description"] === "string") {
				effect["description"] = consequence["description"];
			}
			normalizedConsequence["effect"] = normalizeConsequenceEffect(effect, neighboringEmpires);
			return normalizedConsequence;
		}),
	};
}

export const decisionResponseSchema = z.preprocess(
	(value) => normalizeDecisionResponse(value),
	z.object({
		id: z.string().min(1),
		title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
		description: z.string().min(GAME_CONFIG.content.minResolutionDescriptionLength),
		immediateEffect: consequenceEffectSchema,
		delayedConsequences: arrayOrEmpty(
			z.object({
				id: z.string().min(1),
				dueDate: z.string().date(),
				title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
				effect: consequenceEffectSchema,
			}),
			GAME_CONFIG.content.maxDelayedConsequences,
		),
		nextEventDate: z.string().date(),
	}),
);

export function parseNewEventAiJson(rawText: string, defaultEmpireId: string): NewEventAiResponse {
	const parsedJson = parseJsonWithDuplicateKeyCheck(rawText);
	return newEventSchema.parse(normalizeNewEventResponse(parsedJson, defaultEmpireId)) as NewEventAiResponse;
}

export function parseDecisionAiJson(rawText: string, fallbackNextEventDate: string, neighboringEmpires: NeighborRelationshipContext = []): DecisionAiResponse {
	const parsedJson = parseJsonWithDuplicateKeyCheck(rawText);
	return decisionResponseSchema.parse(normalizeDecisionResponse(parsedJson, fallbackNextEventDate, neighboringEmpires)) as DecisionAiResponse;
}

export function parseInitialWorldAiJson(
	rawText: string,
	initialDate: string,
	initialEmpireId: string,
	initialRulerGender: CharacterGender,
): InitialWorldAiResponse {
	const schema = initialWorldSchema.superRefine((world, context) => {
		for (const [characterIndex, character] of world.characters.entries()) {
			if (character.birthDate > initialDate) {
				context.addIssue({
					code: "custom",
					message: "Data urodzenia postaci nie może być późniejsza od daty rozpoczęcia świata.",
					path: ["characters", characterIndex, "birthDate"],
				});
			}
			if (character.empireId !== initialEmpireId) {
				context.addIssue({
					code: "custom",
					message: "Władca założycielski musi należeć do nowego imperium.",
					path: ["characters", characterIndex, "empireId"],
				});
			}
			if (character.gender !== initialRulerGender) {
				context.addIssue({
					code: "custom",
					message: `Płeć władcy założycielskiego musi być zgodna z wybraną przez aplikację (${initialRulerGender}).`,
					path: ["characters", characterIndex, "gender"],
				});
			}
		}
	});
	return schema.parse(parseJsonWithDuplicateKeyCheck(rawText)) as InitialWorldAiResponse;
}

function parseJsonWithDuplicateKeyCheck(rawText: string): unknown {
	const trimmedText = rawText.trim();
	const parsedJson: unknown = JSON.parse(trimmedText);
	const duplicateKey = findDuplicateJsonKey(trimmedText);
	if (duplicateKey) {
		throw new SyntaxError(`Odpowiedź JSON zawiera powtarzające się pole "${duplicateKey}".`);
	}
	return parsedJson;
}

function findDuplicateJsonKey(jsonText: string): string | null {
	let index = 0;

	const skipWhitespace = (): void => {
		while (index < jsonText.length && /\s/.test(jsonText[index])) {
			index++;
		}
	};

	const parseString = (): string => {
		const start = index;
		index++;
		let escaped = false;
		while (index < jsonText.length) {
			const character = jsonText[index];
			index++;
			if (character === '"' && !escaped) {
				break;
			}
			if (character === "\\" && !escaped) {
				escaped = true;
			} else {
				escaped = false;
			}
		}
		return JSON.parse(jsonText.slice(start, index)) as string;
	};

	const parsePrimitive = (): void => {
		while (index < jsonText.length && !/[,\]}]/.test(jsonText[index])) {
			index++;
		}
	};

	const parseValue = (): void => {
		skipWhitespace();
		if (jsonText[index] === "{") {
			parseObject();
			return;
		}
		if (jsonText[index] === "[") {
			parseArray();
			return;
		}
		if (jsonText[index] === '"') {
			parseString();
			return;
		}
		parsePrimitive();
	};

	let duplicateKey: string | null = null;

	const parseArray = (): void => {
		index++;
		skipWhitespace();
		if (jsonText[index] === "]") {
			index++;
			return;
		}
		while (index < jsonText.length) {
			parseValue();
			skipWhitespace();
			if (jsonText[index] === ",") {
				index++;
				continue;
			}
			if (jsonText[index] === "]") {
				index++;
				return;
			}
		}
	};

	const parseObject = (): void => {
		index++;
		skipWhitespace();
		const keys = new Set<string>();
		if (jsonText[index] === "}") {
			index++;
			return;
		}
		while (index < jsonText.length) {
			skipWhitespace();
			if (jsonText[index] !== '"') {
				return;
			}
			const key = parseString();
			if (keys.has(key) && duplicateKey === null) {
				duplicateKey = key;
			}
			keys.add(key);
			skipWhitespace();
			if (jsonText[index] === ":") {
				index++;
			}
			parseValue();
			skipWhitespace();
			if (jsonText[index] === ",") {
				index++;
				continue;
			}
			if (jsonText[index] === "}") {
				index++;
				return;
			}
		}
	};

	parseValue();
	return duplicateKey;
}
