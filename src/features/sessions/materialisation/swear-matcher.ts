import { SWEAR_PHRASES, SWEAR_SINGLE_WORDS } from "~/features/dashboard/services/swear-types";

const segmenter = new Intl.Segmenter(["en", "id"], { granularity: "word" });
const tokenWordMap = new Map<string, string>();
const compoundWordTokens: { word: string; tokens: string[] }[] = [];
const symbolWords: string[] = [];

for (const word of SWEAR_SINGLE_WORDS) {
	const tokens = [...segmenter.segment(normalizeText(word))]
		.filter((segment) => segment.isWordLike)
		.map((segment) => segment.segment);
	if (tokens.length === 1) tokenWordMap.set(tokens[0]!, word);
	else if (tokens.length > 1) compoundWordTokens.push({ word, tokens });
	else symbolWords.push(word);
}

const phraseTokens = [
	...compoundWordTokens,
	...SWEAR_PHRASES.map((phrase) => ({
		word: phrase,
		tokens: [...segmenter.segment(normalizeText(phrase))]
			.filter((segment) => segment.isWordLike)
			.map((segment) => segment.segment),
	})),
];

function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.replaceAll("4", "a")
		.replaceAll("1", "i")
		.replaceAll("0", "o")
		.replaceAll("3", "e")
		.replaceAll("5", "s")
		.replaceAll("7", "t");
}

interface TokenSegment {
	segment: string;
	index: number;
}

export function findSwearMatches(text: string) {
	const normalized = normalizeText(text);
	const tokens: TokenSegment[] = [...segmenter.segment(normalized)]
		.filter((segment) => segment.isWordLike)
		.map((segment) => ({ segment: segment.segment, index: segment.index }));
	const result: { word: string; index: number; length: number }[] = [];

	for (const token of tokens) {
		const word = tokenWordMap.get(token.segment);
		if (!word) continue;
		result.push({ word, index: token.index, length: token.segment.length });
	}

	for (const phrase of phraseTokens) {
		if (phrase.tokens.length === 0) continue;
		for (let index = 0; index <= tokens.length - phrase.tokens.length; index++) {
			let matched = true;
			for (let offset = 0; offset < phrase.tokens.length; offset++) {
				if (tokens[index + offset]?.segment !== phrase.tokens[offset]) {
					matched = false;
					break;
				}
			}
			if (!matched) continue;
			const first = tokens[index]!;
			const last = tokens[index + phrase.tokens.length - 1]!;
			result.push({
				word: phrase.word,
				index: first.index,
				length: last.index + last.segment.length - first.index,
			});
		}
	}

	for (const word of symbolWords) {
		let index = normalized.indexOf(word);
		while (index !== -1) {
			result.push({ word, index, length: word.length });
			index = normalized.indexOf(word, index + word.length);
		}
	}

	return result.sort(
		(left, right) => left.index - right.index || left.word.localeCompare(right.word),
	);
}
