import englishWords from "./swear-data/en.json";
import indonesianWords from "./swear-data/id.json";
import phrases from "./swear-data/phrases.json";

export const SWEAR_SINGLE_WORDS = [...englishWords, ...indonesianWords];
export const SWEAR_PHRASES = phrases;
export const SWEAR_WORDS = [...SWEAR_SINGLE_WORDS, ...SWEAR_PHRASES];
export const SWEAR_WORD_SET = new Set<string>(SWEAR_SINGLE_WORDS);

export type SwearWord = string;

export interface SwearMention {
	word: SwearWord;
	context: string;
	projectName: string;
	sessionTitle: string | null;
	sessionId: string;
	createdAt: number;
}

export interface SwearSummary {
	totalMentions: number;
	totalSessions: number;
	uniqueProjects: number;
	topWords: { word: string; count: number }[];
	allWordFrequencies: { word: string; count: number }[];
	topSessions: SwearMention[];
	swearTrend: { date: string; count: number }[];
	swearByProject: { project: string; count: number; sessions: number }[];
}
