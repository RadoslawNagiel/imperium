# Kroniki Imperium — fantasyczny symulator rycerskiego imperium

Samodzielna aplikacja frontendowa Angular 22.3, TypeScript, Angular Signals, Tailwind CSS 4 i IndexedDB. Nie wymaga własnego backendu. Zapytania narracyjne są wysyłane bezpośrednio do API wybranego dostawcy AI.

## Wymagania

- Node.js 22.22.3 lub nowszy z linii 22 albo Node.js 24.15.0 lub nowszy z linii 24.
- npm.
- Klucz API jednego z dostawców chmurowych (OpenAI, Anthropic, Google Gemini) lub lokalny serwer Ollama z modelem Qwen3.

Angular 22 wymaga TypeScript `>=6.0.0 <6.1.0`. Wersje pakietów Angular i CLI są ustawione na linię 22.3.

## Uruchomienie

```bash
npm install
npm start
```

Aplikacja będzie dostępna pod adresem `http://localhost:4200`.

Build produkcyjny:

```bash
npm run build
```

## Pierwsze uruchomienie

1. Przy pierwszym uruchomieniu okno **Konfiguracji AI** otworzy się automatycznie.
2. Wybierz dostawcę i model.
3. Wprowadź własny klucz API.
4. W przypadku dostawcy chmurowego wprowadź klucz API. Dla Ollamy uruchom lokalny serwer i pobierz wybrany model, np. `ollama pull qwen3.5:9B`.
5. Użyj przycisku **Testuj połączenie**.
6. Zapisz konfigurację i rozpocznij panowanie.

Przy tworzeniu świata wpisujesz tylko nazwę imperium. AI generuje datę rozpoczęcia, władcę, początkowy orszak, statystyki, historię i otwarte wątki; niepoprawne dane są odrzucane i ponawiane przed zapisaniem gry.

Domyślnie klucz API pozostaje tylko w pamięci uruchomionej aplikacji. Zaznaczenie opcji trwałego zapisu umieszcza klucz w `localStorage`; jest to wygoda, a nie bezpieczny magazyn sekretów. Można go odczytać przez kod uruchomiony w tej samej domenie. Dostawcy chmurowi muszą zezwalać na żądania z przeglądarki zgodnie ze swoją polityką CORS.

### Ollama i Qwen3

Zainstaluj Ollamę, a następnie pobierz wybrany model, np.:

```bash
ollama pull qwen3.5:9B
```

Ollama musi działać na tym samym komputerze co przeglądarka, pod domyślnym adresem `http://localhost:11434`. Przeglądarka wymaga zezwolenia CORS na adres aplikacji (dla `ng serve` jest to `http://localhost:4200`). Ustaw `OLLAMA_ORIGINS` w środowisku procesu Ollama przed jego uruchomieniem, np. dodając adres aplikacji do dozwolonych źródeł. W konfiguracji AI wybierz **Ollama (lokalnie)** oraz pobrany model; klucz API nie jest potrzebny.

## Architektura

- `models/` — typy i schematy Zod dla wydarzeń, postaci i konsekwencji.
- `services/game-repository.service.ts` — trwały zapis imperiów w IndexedDB.
- `services/game-state.service.ts` — orchestration, walidacja reguł, atomowe zastosowanie zmian, postacie, śmierć, sukcesja, kronika i konsekwencje odroczone.
- `services/game-factory.service.ts` — budowanie zapisu nowego świata z danych wygenerowanych przez AI.
- `services/ai-prompt.service.ts` — konstruowanie kontekstu świata dla AI.
- `services/ai-provider.service.ts` — adaptery OpenAI Responses API, Anthropic Messages API, Gemini Interactions API i lokalnego API czatu Ollama.
- `services/ai-configuration.service.ts` — konfiguracja dostawcy i klucza API.
- `app.component.*` — responsywny interfejs gry.

Dodanie kolejnego dostawcy wymaga implementacji interfejsu `AiProvider` i rejestracji adaptera w `AiProviderService`. Logika imperium nie zależy od konkretnego API.

## Zasady integralności danych

- Żyjąca lista postaci nie przekracza 20. Zmarłe postacie są przenoszone do archiwum i zachowują wcześniejsze dane.
- Nowy uczestnik audiencji jest zapisywany razem z wydarzeniem. Nie może zostać utworzony po osiągnięciu limitu.
- Władcą imperium może zostać wyłącznie żyjąca postać, która wcześniej wystąpiła w grze. Każde panowanie jest osobnym rekordem rodu.
- Statystyki poza ludnością są ograniczane do zakresu 0–100; ludność nie spada poniżej 1.
- Konsekwencje odroczone są stosowane chronologicznie przed następnym wydarzeniem i usuwane z kolejki po zastosowaniu.
- Jeśli odpowiedź AI nie przejdzie walidacji JSON, schematu lub reguł gry, aplikacja poprosi o poprawioną odpowiedź jeszcze raz; łącznie wykona maksymalnie dwie próby.
- Błędna odpowiedź AI nie jest stosowana częściowo. Bieżące wydarzenie i stan przed rozstrzygnięciem pozostają zapisane.
- Klucze API nie są umieszczane w stanie gry, kronice ani promptach.

## Uwagi dotyczące bezpieczeństwa

Aplikacja frontendowa nie może zapewnić ochrony klucza API równoważnej backendowi. Klucz jest potrzebny w przeglądarce, aby wykonać żądanie bezpośrednio do dostawcy. Nie należy używać tej architektury w środowisku, w którym wymagana jest pełna kontrola serwerowa nad sekretami, limitami i rozliczeniami.

Dane rozgrywki są lokalne dla danej przeglądarki i urządzenia. Usunięcie danych witryny może usunąć zapisy IndexedDB.
