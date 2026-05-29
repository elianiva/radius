export const SWEAR_WORDS = [
  "fuck",
  "fucking",
  "fucked",
  "fucker",
  "shit",
  "shitty",
  "ass",
  "asshole",
  "bitch",
  "bastard",
  "damn",
  "dammit",
  "piss",
  "pissed",
  "crap",
  "crappy",
  "dick",
  "cock",
  "cunt",
  "whore",
  "slut",
  "bullshit",
  "goddamn",
  "goddammit",
  "motherfucker",
  "motherfucking",
  "son of a bitch",
  "wtf",
  "wth",
  "hell",
  "jackass",
  "douche",
  "douchebag",
  "twat",
  "wanker",
  "prick",
  "screw",
  "screwed",
  "screwing",
  "freaking",
  "darn",
  "heck",
] as const;

export type SwearWord = (typeof SWEAR_WORDS)[number];

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
  topSessions: SwearMention[];
  swearTrend: { date: string; count: number }[];
  swearByProject: { project: string; count: number; sessions: number }[];
}
