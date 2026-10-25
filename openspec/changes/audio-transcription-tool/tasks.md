## 1. Tool Implementation

- [ ] 1.1 Create `src/tools/audio/index.js` with the `transcribeAudio` LangChain tool and Zod schema (path required, language/prompt optional)
- [ ] 1.2 Implement the OpenAI `audio/transcriptions` API path (multipart/form-data POST to `https://api.openai.com/v1/audio/transcriptions` with `model: "whisper-1"`)
- [ ] 1.3 Implement the local Whisper path via `@xenova/transformers` `automatic-speech-recognition` pipeline with `Xenova/whisper-tiny.en` (quantized), including the `redirectOnnxRuntime` WASM shim
- [ ] 1.4 Add sandbox path validation via `validatePath` and size capping via `checkFileLimit` from `src/tools/common.js`
- [ ] 1.5 Add error handling for missing/invalid path, non-audio file, unsupported extension, and no-backend-available cases

## 2. Registration

- [ ] 2.1 Add `transcribeAudio` to `TOOL_PERMISSIONS` in `src/tools/index.js` (`["filesystem:read", "network:outbound"]`)
- [ ] 2.2 Add `transcribeAudio` to `TOOL_CLASSIFICATIONS` in `src/tools/index.js`
- [ ] 2.3 Add `transcribeAudio` to `TOOLS` in `src/tools/index.js`
- [ ] 2.4 Add a `transcribeAudio` case to the `buildToolConfig` switch in `src/tools/index.js`

## 3. Tests

- [ ] 3.1 Create `tests/unit/tools/audio.test.js` covering Zod schema validation (missing path, invalid path, unsupported extension, empty file, file outside sandbox allowlist, very large file)
- [ ] 3.2 Create `tests/integration/tools/audio.test.js` transcribing a small fixture audio file and verifying text output
