/**
 * Curated quote list for the status bar.
 * v1 ships with real Mads Mikkelsen interview quotes. A second list of
 * character quotes can be merged in later by concatenating into the source
 * passed to `getRandomQuoteIndex` — the rotation logic does not need to change.
 * @module src/tui/quotes
 */

/**
 * Finite v1 list of curated real Mads Mikkelsen interview quotes.
 * @type {readonly string[]}
 */
export const QUOTES = Object.freeze([
	"I'd rather be the sexiest man in Denmark than the ugliest.",
	"I'm a beer man.",
	"Compromises are from hell.",
	"I ask a million questions, and I insist on having answers.",
	"He's a happy duckling and life is beautiful.",
	"We're the villains right now.",
	"He's probably the happiest man I've ever played.",
	"I always try to find something I like about the bad guys.",
	"I'm not ambitious about my career, but I am ambitious with each job.",
	"You can only be famous to a certain degree in Denmark.",
	"I became an actor out of coincidence.",
	"These are giant shoes to step into.",
	"We are all angry. We were pissed. It's madness.",
	"I don't need to wear funny hats or put on sunglasses.",
	"As long as I get to work regularly I'm a pretty happy guy.",
	"It is like something Steve McQueen would ride.",
	"There's something wonderful about flying around on a wire with a sword.",
	"If you can go back and forth, you're a very lucky person.",
	"He loves fine art. He is a three-piece suit man.",
	"When I do something it has to feel right.",
	"Predominantly I'm an Adidas guy.",
	"The big blockbusters, you wake up and say hello to 500 people.",
	"I never see that myself, but I hear it once in a while.",
	"I do a lot of racing bikes, tennis, handball, boxing — whatever pops up.",
	"I can be fairly annoying to work with.",
]);

/**
 * Return a random index into the quote list, avoiding the previous index.
 * @param {number} previousIndex - The index of the previously displayed quote, or -1 if none.
 * @param {() => number} [random] - Injectable random function returning [0, 1). Defaults to Math.random.
 * @param {readonly string[]} [list] - The quote list to select from. Defaults to QUOTES.
 * @returns {number} A valid index into the quote list, or -1 if the list is empty.
 */
export function getRandomQuoteIndex(previousIndex, random = Math.random, list = QUOTES) {
	const length = list.length;

	if (length === 0) {
		return -1;
	}

	if (length === 1) {
		return 0;
	}

	let index = Math.floor(random() * length);

	if (index === previousIndex) {
		index = (index + 1) % length;
	}

	return index;
}
