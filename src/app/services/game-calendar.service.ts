import { Injectable } from "@angular/core";

export interface MoonPhase {
	label: string;
	symbol: string;
}

@Injectable({ providedIn: "root" })
export class GameCalendarService {
	private readonly dayInMilliseconds = 24 * 60 * 60 * 1000;
	private readonly lunarCycleInDays = 29.530588853;
	private readonly referenceNewMoon = Date.parse("2000-01-06T18:14:00.000Z");
	private readonly moonPhases: readonly MoonPhase[] = [
		{ label: "Nów", symbol: "🌑" },
		{ label: "Sierp przybywający", symbol: "🌒" },
		{ label: "Pierwsza kwadra", symbol: "🌓" },
		{ label: "Garbaty przybywający", symbol: "🌔" },
		{ label: "Pełnia", symbol: "🌕" },
		{ label: "Garbaty ubywający", symbol: "🌖" },
		{ label: "Ostatnia kwadra", symbol: "🌗" },
		{ label: "Sierp ubywający", symbol: "🌘" },
	];

	public getSeason(date: string): string {
		this.getTimestamp(date);
		const month = Number(date.slice(5, 7));
		if (month >= 3 && month <= 5) {
			return "Wiosna";
		}
		if (month >= 6 && month <= 8) {
			return "Lato";
		}
		if (month >= 9 && month <= 11) {
			return "Jesień";
		}
		return "Zima";
	}

	public getMoonPhase(date: string): MoonPhase {
		const timestamp = this.getTimestamp(date);
		const elapsedDays = (timestamp - this.referenceNewMoon) / this.dayInMilliseconds;
		const cyclePosition = ((elapsedDays % this.lunarCycleInDays) + this.lunarCycleInDays) % this.lunarCycleInDays;
		const phaseIndex = Math.round((cyclePosition / this.lunarCycleInDays) * this.moonPhases.length) % this.moonPhases.length;
		return this.moonPhases[phaseIndex];
	}

	private getTimestamp(date: string): number {
		const timestamp = Date.parse(`${date}T00:00:00.000Z`);
		if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== date) {
			throw new Error(`Nieprawidłowa data kalendarza: ${date}.`);
		}
		return timestamp;
	}
}
