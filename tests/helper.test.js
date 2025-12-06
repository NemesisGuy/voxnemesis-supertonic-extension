const { UnicodeProcessor, TextToSpeech } = require('../lib/helper.js');

// Mock indexer
const mockIndexer = new Array(256).fill(0).map((_, i) => i);

describe('UnicodeProcessor', () => {
    let processor;

    beforeEach(() => {
        processor = new UnicodeProcessor(mockIndexer);
    });

    test('preprocessText normalizes text', () => {
        const input = "Hello   World\n";
        const output = processor.preprocessText(input);
        expect(output).toBe("Hello World.");
    });

    test('preprocessText adds punctuation', () => {
        const input = "Hello";
        const output = processor.preprocessText(input);
        expect(output).toBe("Hello.");
    });

    test('preprocessText removes emojis', () => {
        const input = "Hello 🌍";
        const output = processor.preprocessText(input);
        expect(output).toBe("Hello.");
    });
});

describe('TextToSpeech Chunking', () => {
    // Mock classes for dependencies
    class MockTTS extends TextToSpeech {
        constructor() {
            super({ ae: { sample_rate: 24000 } }, null, null, null, null, null);
        }
    }

    test('chunkText splits long text', () => {
        const tts = new MockTTS();
        const longText = "a".repeat(400); // larger than default 300
        const chunks = tts.chunkText(longText, 300);
        expect(chunks.length).toBeGreaterThan(1);
    });

    test('chunkText keeps short phrases together', () => {
        const tts = new MockTTS();
        const text = "Hello world. This is a test.";
        const chunks = tts.chunkText(text);
        expect(chunks).toEqual(["Hello world. This is a test."]);
    });
});
