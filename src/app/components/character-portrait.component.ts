import { Component, Input } from "@angular/core";
import type { CharacterFaction, CharacterGender, GameCharacter } from "../models/game.models";

interface PortraitPalette {
	background: string;
	clothing: string;
	accent: string;
}

@Component({
	selector: "imp-character-portrait",
	standalone: true,
	template: `
		<div
			class="portrait"
			[class.portrait-small]="size === 'small'"
			[class.portrait-medium]="size === 'medium'"
			[class.portrait-large]="size === 'large'"
			role="img"
			[attr.aria-label]="'Portret: ' + character.fullName">
			<svg viewBox="0 0 64 64" aria-hidden="true">
				<rect x="1" y="1" width="62" height="62" rx="9" [attr.fill]="palette.background" [attr.stroke]="empireColor ?? '#b79a65'" stroke-opacity=".8" />
				<path d="M7 62c2-13 11-20 25-20s23 7 25 20" [attr.fill]="palette.clothing" />
				<path d="M23 45l9 8 9-8-4-7H27z" [attr.fill]="palette.accent" />
				<rect x="27" y="34" width="10" height="12" rx="4" [attr.fill]="skinTone" />
				<path [attr.d]="backHairPath" [attr.fill]="hairTone" />
				<ellipse cx="32" cy="25" rx="11" ry="14" [attr.fill]="skinTone" />
				<path [attr.d]="frontHairPath" [attr.fill]="hairTone" />
				@if (hasFacialHair) {
					<path d="M23 29c2 9 5 13 9 13s7-4 9-13c-2 2-4 2-6 1-2 3-4 3-6 0-2 1-4 1-6-1z" [attr.fill]="hairTone" />
				}
				<path d="M25 25h3m8 0h3" stroke="#32271d" stroke-width="1.5" stroke-linecap="round" />
				<path d="M31 26v4m-2 3c2 1 4 1 6 0" fill="none" stroke="#754c3c" stroke-width="1.2" stroke-linecap="round" />
				<path d="M25 21c1-1 2-1 4 0m7 0c2-1 3-1 4 0" fill="none" stroke="#32271d" stroke-width="1" stroke-linecap="round" />
				@if (hasHeadwear) {
					<path d="M19 17h26l-3-5H22z" [attr.fill]="palette.accent" stroke="#e2c98c" stroke-width=".8" />
					@if (character.faction === "royal-family") {
						<path d="M22 12l2-6 8 5 8-5 2 6" fill="none" stroke="#e2c98c" stroke-width="2" stroke-linejoin="round" />
					}
				}
				<circle cx="49" cy="49" r="9" [attr.fill]="palette.background" stroke="#d6b875" stroke-width="1" />
				<text x="49" y="52" text-anchor="middle" font-size="9" fill="#ead9b6">{{ factionIcon }}</text>
			</svg>
		</div>
	`,
	styles: [
		`
			.portrait {
				display: inline-flex;
				flex: none;
				overflow: hidden;
				border-radius: 0.55rem;
			}
			.portrait-small {
				width: 3rem;
				height: 3rem;
			}
			.portrait-medium {
				width: 3.5rem;
				height: 3.5rem;
			}
			.portrait-large {
				width: 4.5rem;
				height: 4.5rem;
			}
			svg {
				display: block;
				width: 100%;
				height: 100%;
			}
		`,
	],
})
export class CharacterPortraitComponent {
	@Input({ required: true }) public character!: GameCharacter;
	@Input() public size: "small" | "medium" | "large" = "medium";
	@Input() public empireColor: string | null = null;

	private readonly palettes: Record<CharacterFaction, PortraitPalette> = {
		"royal-family": { background: "#493b2c", clothing: "#392b3f", accent: "#c4a66a" },
		aristocracy: { background: "#50332f", clothing: "#40272d", accent: "#c19c72" },
		clergy: { background: "#40394b", clothing: "#302b3e", accent: "#d3c59a" },
		military: { background: "#3e493b", clothing: "#2c392f", accent: "#b8a36e" },
		commoners: { background: "#4c4434", clothing: "#39362c", accent: "#bd9a65" },
		merchants: { background: "#4c3b32", clothing: "#39302c", accent: "#d1ae69" },
		diplomacy: { background: "#39454b", clothing: "#2c373e", accent: "#c8b783" },
	};

	private readonly factionIcons: Record<CharacterFaction, string> = {
		"royal-family": "♛",
		aristocracy: "♜",
		clergy: "✠",
		military: "⚔",
		commoners: "♟",
		merchants: "⚖",
		diplomacy: "✉",
	};

	private readonly hairStyles: Record<CharacterGender, { back: string; front: string }> = {
		female: {
			back: "M20 31C15 13 22 5 33 6c12 1 17 10 11 31l-4 10-5-4 4-25-14 1 2 28-5 2-3-10z",
			front: "M20 23C17 12 23 7 33 7c9 0 14 7 11 18l-5-7-5-6c-4 5-8 7-14 8z",
		},
		male: {
			back: "M20 26C17 13 23 6 32 6c10 0 15 8 12 20l-5-4-2-9c-4 4-9 6-16 7z",
			front: "M20 22C18 12 24 7 32 7c8 0 13 5 12 14l-6-7c-5 4-10 6-18 6z",
		},
	};

	public get palette(): PortraitPalette {
		return this.palettes[this.character.faction];
	}

	public get visualGender(): CharacterGender {
		return this.character.gender ?? "male";
	}

	public get factionIcon(): string {
		return this.factionIcons[this.character.faction];
	}

	public get backHairPath(): string {
		return this.hairStyles[this.visualGender].back;
	}

	public get frontHairPath(): string {
		return this.hairStyles[this.visualGender].front;
	}

	public get hasFacialHair(): boolean {
		return this.visualGender === "male" ? this.nameSeed % 2 === 0 : false && this.nameSeed % 4 === 0;
	}

	public get hasHeadwear(): boolean {
		return (
			this.character.faction === "royal-family" ||
			this.character.faction === "aristocracy" ||
			(this.character.faction === "military" && this.nameSeed % 2 === 0)
		);
	}

	public get skinTone(): string {
		const tones = ["#e5bd96", "#c99570", "#a96f50", "#79513e"];
		return tones[this.nameSeed % tones.length];
	}

	public get hairTone(): string {
		const tones = ["#32271f", "#5a3b2b", "#a18355", "#77716a"];
		return tones[Math.floor(this.nameSeed / 3) % tones.length];
	}

	private get nameSeed(): number {
		return Array.from(this.character.fullName).reduce((sum, character) => sum + character.charCodeAt(0), 0);
	}
}
