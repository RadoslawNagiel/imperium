import { Injectable } from "@angular/core";
import { DBSchema, IDBPDatabase, openDB } from "idb";
import type { KingdomState } from "../models/game.models";

interface ImperiumDatabase extends DBSchema {
	kingdoms: {
		key: string;
		value: KingdomState;
	};
}

@Injectable({ providedIn: "root" })
export class GameRepositoryService {
	private databasePromise: Promise<IDBPDatabase<ImperiumDatabase>> | null = null;

	public async save(state: KingdomState): Promise<void> {
		const database = await this.getDatabase();
		await database.put("kingdoms", state);
	}

	public async load(gameId: string): Promise<KingdomState | undefined> {
		const database = await this.getDatabase();
		return database.get("kingdoms", gameId);
	}

	public async list(): Promise<KingdomState[]> {
		const database = await this.getDatabase();
		return database.getAll("kingdoms");
	}

	public async delete(gameId: string): Promise<void> {
		const database = await this.getDatabase();
		await database.delete("kingdoms", gameId);
	}

	private getDatabase(): Promise<IDBPDatabase<ImperiumDatabase>> {
		this.databasePromise ??= openDB<ImperiumDatabase>("imperium-medieval", 1, {
			upgrade(database) {
				if (!database.objectStoreNames.contains("kingdoms")) {
					database.createObjectStore("kingdoms", { keyPath: "id" });
				}
			},
		});
		return this.databasePromise;
	}
}
