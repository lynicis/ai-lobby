# ai-lobby

Tek bir promptu **Gemini, Grok, ChatGPT ve Claude**'a paralel olarak gönderen, cevapları toplayan ve **Claude Opus 4.5 (supervisor)** ile sentezleyip özetleyen terminal aracı.

```
           ┌─ Gemini
           ├─ Grok
user prompt ┼─ ChatGPT ──┐
           └─ Claude    │
                       ▼
                Supervisor (Opus 4.5)
                       │
                       ▼
                  Final özet
```

**Stack:** [Vercel AI SDK](https://ai-sdk.dev/) (tek `generateText` / `streamText` API'si, 4 provider) · [Piscina](https://github.com/piscisaureus/piscina) (worker thread pool) · [commander.js](https://github.com/tj/commander.js) · [dotenv](https://github.com/motdotla/dotenv) · Bun runtime.

## Kurulum

```bash
bun install
cp .env.example .env
# .env içine en az bir API key gir
```

### API key alma linkleri

| Provider | Key |
|----------|-----|
| Gemini   | https://aistudio.google.com/apikey |
| Grok     | https://console.x.ai |
| ChatGPT  | https://platform.openai.com/api-keys |
| Claude   | https://console.anthropic.com |

Eksik key'li provider'lar otomatik skip edilir; diğerleri bloklanmaz.

## Kullanım

```bash
# Normal akış: 4 model + supervisor sentezi
bun run start "Explain quantum entanglement in 3 paragraphs"

# Stdin'den prompt
echo "Best language for CLIs in 2026?" | bun run start

# Sadece ham cevaplar
bun run start --no-supervisor "Compare React vs Vue"

# JSON çıktı (CI/script için)
bun run start --raw "What is the capital of France?"

# Özel supervisor modeli
bun run start --supervisor-model anthropic:claude-sonnet-4-5 "..."

# Yardım / versiyon
bun run start --help
bun run start --version
```

## Ortam değişkenleri (.env)

| Değişken | Varsayılan | Açıklama |
|----------|------------|----------|
| `GEMINI_API_KEY` | — | Gemini panel |
| `GROK_API_KEY` | — | Grok panel (`openai-compatible` provider, xAI base URL) |
| `OPENAI_API_KEY` | — | ChatGPT panel |
| `ANTHROPIC_API_KEY` | — | Claude panel + supervisor |
| `SUPERVISOR_MODEL` | `anthropic:claude-opus-4-5` | Sentez modeli |
| `CLAUDE_PANEL_MODEL` | `anthropic:claude-sonnet-4-5` | Panelist Claude |
| `GEMINI_MODEL` | `google:gemini-2.5-pro` | |
| `GROK_MODEL` | `openai-compatible:grok-4-latest` | |
| `OPENAI_MODEL` | `openai:gpt-4o` | |
| `DEFAULT_TIMEOUT_MS` | `60000` | Panelist başına timeout |

> **Vercel AI SDK** model ID formatı: `<provider>:<model>`. Registry'de her provider bir namespace; `registry.languageModel("google:gemini-2.5-pro")` gibi.

## Mimari

- `src/index.ts` — **commander.js** CLI giriş noktası, arg parse + stdin fallback
- `src/config.ts` — **dotenv/config** ile env yükleme, key okuma
- `src/registry.ts` — Vercel AI SDK `createProviderRegistry`: Google, OpenAI, Anthropic, OpenAI-compatible (xAI)
- `src/pool.ts` — **Piscina** worker thread pool (panelist başına izole V8 isolate)
- `src/panel-worker.ts` — Piscina task default export; tek bir panelist `generateText` çağrısı, per-worker `AbortController` timeout
- `src/panel-shared.ts` — Panelist sistem promptu + `extractStructured` (worker + main ortak)
- `src/orchestrator.ts` — Pool üzerinden 4 paralel `pool.run` → deterministik çıktı için merge
- `src/supervisor.ts` — Opus 4.5 ile `streamText` sentezi (anlık yazdırma)
- `src/tui.ts` — Renkli terminal çıktı (ANSI, TTY-aware)
- `src/types.ts` — `ModelResponse` / `PanelEntry` / `StructuredAnswer` tipleri

> **Piscina + worker dosyaları TS source olarak referans veriliyor** (`filename: panel-worker.ts`). Bu, **sadece Bun runtime** altında çalışır; Node kullanılacaksa worker dosyası build step ile `.js`'e dönüştürülmeli.

## Paket değişiklikleri (v0.2.0)

| Çıkarıldı | Eklendi |
|-----------|---------|
| `@google/genai` | `ai` |
| `openai` | `@ai-sdk/google` |
| `@anthropic-ai/sdk` | `@ai-sdk/openai` |
| (custom parser) | `@ai-sdk/anthropic` |
| (custom dotenv) | `@ai-sdk/openai-compatible` |
| | `commander` |
| | `dotenv` |

4 ayrı SDK → **tek SDK**, 4 provider. Custom arg parser → **commander.js**. Custom env loader → **dotenv**.

## Kapsam dışı

- Konuşma geçmişi (her çağrı stateless)
- Maliyet / token takibi
- Çoklu tur debate
- Web UI

## Lisans

MIT