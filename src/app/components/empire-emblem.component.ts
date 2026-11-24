import { Component, Input } from "@angular/core";

@Component({
	selector: "imp-empire-emblem",
	standalone: true,
	template: `
		<div class="emblem" [class.emblem-small]="size === 'small'" [class.emblem-medium]="size === 'medium'" [class.emblem-large]="size === 'large'">
			<svg viewBox="0 0 64 72" role="img" [attr.aria-label]="'Godło imperium: ' + empireName">
				<path d="M8 4h48v34c0 16-11 25-24 32C19 63 8 54 8 38z" fill="#17150f" [attr.stroke]="empireColor" stroke-width="3" />
				<path [attr.d]="partitionPath" [attr.fill]="empireColor" opacity=".28" />
				<path d="M12 8h40M12 38h40M32 8v55" fill="none" stroke="#e7d6b1" stroke-opacity=".38" stroke-width="1" />
				<path d="M13 8h38v3H13zM18 57l14 9 14-9" fill="none" [attr.stroke]="empireColor" stroke-width="1.5" />
				<g fill="#e7d6b1" [attr.stroke]="empireColor" stroke-width="1.3" stroke-linejoin="round">
					@switch (chargeIndex) {
						@case (0) {
							<path d="M32 16l4.3 9.2 10.1 1.4-7.3 7.1 1.8 10-8.9-4.8-8.9 4.8 1.8-10-7.3-7.1 10.1-1.4z" />
						}
						@case (1) {
							<path d="M21 47V26h5v-6h12v6h5v21z" />
							<path d="M28 47V36h8v11z" fill="#17150f" />
						}
						@case (2) {
							<path d="M30 17h4v23l9 8h-9l-2 9-2-9h-9l9-8z" />
							<path d="M24 39h16v3H24z" />
						}
						@case (3) {
							<path d="M32 15l-11 14h6L17 39h11v13h8V39h11L37 29h6z" />
							<path d="M29 52h6v5h-6z" />
						}
						@case (4) {
							<path d="M39 17a16 16 0 1 0 0 32 13 13 0 0 1 0-32z" />
							<path d="M43 22l1.5 3.5 3.5.5-2.5 2.5.6 3.5-3.1-1.7-3.1 1.7.6-3.5-2.5-2.5 3.5-.5z" />
						}
						@default {
							<path d="M16 47l10-18 6 9 6-13 10 22z" />
							<path d="M23 47l9-12 8 12z" fill="#17150f" />
						}
					}
				</g>
			</svg>
		</div>
	`,
	styles: [
		`
			:host {
				display: inline-flex;
				flex: none;
			}
			.emblem {
				display: inline-flex;
				flex: none;
			}
			.emblem-small {
				width: 2.25rem;
				height: 2.5rem;
			}
			.emblem-medium {
				width: 2.75rem;
				height: 3rem;
			}
			.emblem-large {
				width: 3.5rem;
				height: 3.85rem;
			}
			svg {
				display: block;
				width: 100%;
				height: 100%;
			}
		`,
	],
})
export class EmpireEmblemComponent {
	@Input({ required: true }) public empireId!: string;
	@Input({ required: true }) public empireName!: string;
	@Input({ required: true }) public empireColor!: string;
	@Input() public size: "small" | "medium" | "large" = "medium";

	public get chargeIndex(): number {
		return this.seed % 6;
	}

	public get partitionPath(): string {
		const partitions = [
			"M12 7h20v56l-12-7c-5-4-8-10-8-18z",
			"M12 7h40v17H12z",
			"M12 17l40-10v16L12 38z",
			"M12 7h40v12L12 42z",
			"M12 31h40v12H12z",
			"M32 7h20v31c0 12-8 20-20 27z",
		];
		return partitions[Math.floor(this.seed / 6) % partitions.length];
	}

	private get seed(): number {
		let hash = 2166136261;
		for (const character of `${this.empireId}:${this.empireName}`) {
			hash ^= character.charCodeAt(0);
			hash = Math.imul(hash, 16777619);
		}
		return hash >>> 0;
	}
}
