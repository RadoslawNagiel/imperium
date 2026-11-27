import { z } from "zod";
import type { CharacterFaction, CharacterGender, DecisionAiResponse, InitialWorldAiResponse, NewEventAiResponse } from "./game.models";
import { GAME_CONFIG } from "../config/game.config";

const factionValues: [CharacterFaction, ...CharacterFaction[]] = ["aristocracy", "clergy", "chivalry", "peasantry", "merchants"];
const genderValues: [CharacterGender, ...CharacterGender[]] = ["female", "male"];

const arrayOrEmpty = <T extends z.ZodType>(itemSchema: T, max?: number) => {
	const arraySchema = max === undefined ? z.array(itemSchema) : z.array(itemSchema).max(max);
	return z.preprocess((value: unknown) => (value === undefined || value === null ? [] : value), arraySchema);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function normalizeBirthDate(value: unknown): unknown {
	if (typeof value !== "string") {
		return value;
	}
	const match = /^(\d{1,3})-(\d{2}-\d{2})$/.exec(value);
	return match ? `${match[1].padStart(4, "0")}-${match[2]}` : value;
}

function normalizeConsequenceEffect(value: unknown): unknown {
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
	if (isRecord(effect["statisticChanges"]) && "religiousity" in effect["statisticChanges"]) {
		const statistics = { ...effect["statisticChanges"] };
		if (!("religiosity" in statistics)) {
			statistics["religiosity"] = statistics["religiousity"];
		}
		delete statistics["religiousity"];
		effect["statisticChanges"] = statistics;
	}
	if (Array.isArray(effect["deaths"])) {
		effect["deaths"] = effect["deaths"].map((death) => {
			if (!isRecord(death)) {
				return death;
			}
			const cause = [death["cause"], death["reason"], death["description"]].find(
				(candidate): candidate is string => typeof candidate === "string" && candidate.trim().length >= GAME_CONFIG.content.minCharacterDeathCauseLength,
			);
			return {
				...death,
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

const traitsSchema = z
	.array(z.string().trim().min(3).max(80))
	.length(GAME_CONFIG.characters.maxHiddenTraits)
	.refine((traits) => new Set(traits).size === traits.length, "Cechy postaci muszą być unikalne.");

const newNeighboringEmpireSchema = z.object({
	name: z.string().trim().min(GAME_CONFIG.world.minNeighboringEmpireNameLength).max(GAME_CONFIG.world.maxNeighboringEmpireNameLength),
	relationship: z.number().int().min(GAME_CONFIG.statistics.min).max(GAME_CONFIG.statistics.max),
});

const biographyArrayOrEmpty = z.preprocess(
	(value: unknown) => {
		const entries = Array.isArray(value) ? value : typeof value === "string" ? [value] : value === undefined || value === null ? [] : value;
		return Array.isArray(entries) ? entries.filter((entry) => typeof entry !== "string" || entry.trim().length > 0) : entries;
	},
	z
		.array(z.string().min(GAME_CONFIG.characters.minBiographyEntryLength))
		.min(GAME_CONFIG.characters.minBiographyEntries)
		.max(GAME_CONFIG.characters.maxBiographyEntries),
);

const birthDateSchema = z.preprocess(normalizeBirthDate, z.string().date());

const characterDataSchema = z.object({
	fullName: z.string().min(GAME_CONFIG.characters.minFullNameLength),
	birthDate: birthDateSchema,
	faction: z.enum(factionValues),
	gender: z.enum(genderValues),
	occupation: z.string().min(GAME_CONFIG.characters.minOccupationLength),
	biography: biographyArrayOrEmpty,
	hiddenTraits: traitsSchema,
	empireName: z.string().min(1).optional(),
});

const characterReferenceSchema = z.object({
	fullName: z.string().min(GAME_CONFIG.characters.minFullNameLength),
	birthDate: birthDateSchema,
	faction: z.enum(factionValues),
	gender: z.enum(genderValues).nullable(),
	occupation: z.string().min(GAME_CONFIG.characters.minOccupationLength),
	empireName: z.string().min(1),
});

const initialWorldSchema = z
	.object({
		characters: z.array(characterDataSchema).length(1),
		neighboringEmpireName: z.string().trim().min(GAME_CONFIG.world.minNeighboringEmpireNameLength).max(GAME_CONFIG.world.maxNeighboringEmpireNameLength),
	})
	.superRefine((world, context) => {
		if (world.characters[0]?.faction !== "aristocracy") {
			context.addIssue({ code: "custom", message: "Początkowa postać musi należeć do frakcji aristocracy.", path: ["characters", 0, "faction"] });
		}
		for (const [characterIndex, character] of world.characters.entries()) {
			if (character.biography.length > GAME_CONFIG.characters.maxInitialBiographyEntries) {
				context.addIssue({
					code: "custom",
					message: `Biografia początkowej postaci może zawierać najwyżej ${GAME_CONFIG.characters.maxInitialBiographyEntries} wpisy.`,
					path: ["characters", characterIndex, "biography"],
				});
			}
		}
	});

const aiChoiceSchema = z.object({
	description: z.string().min(GAME_CONFIG.content.minChoiceDescriptionLength),
});

export const newEventSchema = z.preprocess(
	(value) => value,
	z.object({
		date: z.string().date(),
		title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
		situation: z.string().min(GAME_CONFIG.content.minSituationLength),
		speaker: z.discriminatedUnion("kind", [
			z.object({ kind: z.literal("existing"), character: characterReferenceSchema }),
			z.object({ kind: z.literal("new"), character: characterDataSchema }),
		]),
		choices: z.array(aiChoiceSchema).min(GAME_CONFIG.content.minChoiceCount).max(GAME_CONFIG.content.maxChoiceCount),
	}),
);

const characterUpdateSchema = z.object({
	character: characterReferenceSchema,
	empireName: z.string().min(1).optional(),
	biographyAddition: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
	occupation: z
		.string()
		.nullable()
		.optional()
		.transform((value) => value ?? undefined),
});

const characterDeathSchema = z.object({
	character: characterReferenceSchema,
	cause: z.string().min(GAME_CONFIG.content.minCharacterDeathCauseLength),
});

const neighboringEmpireRelationshipChangeSchema = z.object({
	neighboringEmpireName: z.string().min(1),
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
	z
		.object({
			description: z.string().min(GAME_CONFIG.content.minEffectDescriptionLength),
			statisticChanges: z.preprocess((value: unknown) => (value === undefined || value === null ? {} : value), statisticsSchema),
			neighboringEmpireRelationshipChanges: arrayOrEmpty(neighboringEmpireRelationshipChangeSchema, GAME_CONFIG.world.maxNeighboringEmpires),
			newNeighboringEmpires: arrayOrEmpty(newNeighboringEmpireSchema, GAME_CONFIG.world.maxNeighboringEmpires),
			fallenNeighboringEmpireNames: arrayOrEmpty(z.string().min(1), GAME_CONFIG.world.maxNeighboringEmpires),
			characterUpdates: arrayOrEmpty(characterUpdateSchema, GAME_CONFIG.characters.maxCharacterUpdates),
			deaths: arrayOrEmpty(characterDeathSchema, GAME_CONFIG.characters.maxDeathsPerEffect),
			newRuler: characterReferenceSchema
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
		})
		.strict(),
);

function normalizeDecisionResponse(value: unknown, fallbackNextEventDate?: string): unknown {
	if (!isRecord(value)) {
		return value;
	}
	const response = { ...value };
	if ("immediateEffect" in response) {
		response["immediateEffect"] = normalizeConsequenceEffect(response["immediateEffect"]);
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
			normalizedConsequence["effect"] = normalizeConsequenceEffect(effect);
			return normalizedConsequence;
		}),
	};
}

export const decisionResponseSchema = z.preprocess(
	(value) => normalizeDecisionResponse(value),
	z.object({
		title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
		description: z.string().min(GAME_CONFIG.content.minResolutionDescriptionLength),
		immediateEffect: consequenceEffectSchema,
		delayedConsequences: arrayOrEmpty(
			z.object({
				dueDate: z.string().date(),
				title: z.string().min(GAME_CONFIG.content.minEventTitleLength),
				effect: consequenceEffectSchema,
			}),
			GAME_CONFIG.content.maxDelayedConsequences,
		),
		nextEventDate: z.string().date(),
	}),
);

export function parseNewEventAiJson(rawText: string): NewEventAiResponse {
	const parsedJson = parseJsonWithDuplicateKeyCheck(rawText);
	return newEventSchema.parse(parsedJson) as NewEventAiResponse;
}

export function parseDecisionAiJson(rawText: string, fallbackNextEventDate: string): DecisionAiResponse {
	const parsedJson = parseJsonWithDuplicateKeyCheck(rawText);
	return decisionResponseSchema.parse(normalizeDecisionResponse(parsedJson, fallbackNextEventDate)) as DecisionAiResponse;
}

export function parseInitialWorldAiJson(rawText: string, initialDate: string, initialRulerGender: CharacterGender): InitialWorldAiResponse {
	const schema = initialWorldSchema.superRefine((world, context) => {
		for (const [characterIndex, character] of world.characters.entries()) {
			if (birthDateSchema.safeParse(character.birthDate).success && character.birthDate > initialDate) {
				context.addIssue({
					code: "custom",
					message: "Data urodzenia postaci nie może być późniejsza od daty rozpoczęcia świata.",
					path: ["characters", characterIndex, "birthDate"],
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
