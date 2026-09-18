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
	"I'd rather be voted the sexiest man in Denmark than the ugliest man in Denmark.",
	"I'm a beer man. I tried to drink whiskey and Scotch but I don't get it. It smells like a girl who didn't shower and just splashed a lot of perfume on.",
	"I take my work enormously seriously. When I do something it has to feel right. Everything has to be right.",
	"I'm not ambitious about my career, but I am ambitious with each job. No compromises. Compromises are from hell.",
	"I ask a million questions, and I insist on having answers.",
	"He loves fine art. He is a three-piece suit man. He loves classical music. He hates everything that is banal.",
	"He's a happy duckling and life is beautiful.",
	"I always try to find something I like about the bad guys and then try to find the mistakes and the flaws in the good guys.",
	"I do a lot of racing bikes, a lot of tennis; I play handball, some boxing, whatever pops up.",
	"Predominantly I'm an Adidas guy who walks around in sports gear all the time because there's always a ball right next to me somewhere.",
	"You can only be famous to a certain degree in Denmark. We say our ceiling is very low, meaning that you're not supposed to stick out in any way.",
	"The big blockbusters, you wake up and say hello to 500 people whereas with small productions you're talking to 20 or so.",
	"I've been crazy lucky to be part of some wonderful projects, like Casino Royale and Hannibal, where it's very difficult to call it a one-to-one villain.",
	"Well, I was a dancer out of coincidence, a little like I became an actor out of coincidence.",
	"I never see that myself, but I hear it once in a while. Hopefully people figure out that I'm doing it all for the film.",
	"I was extremely reluctant to do it. I read it, I liked it, but as you say, these are giant shoes to step into.",
	"We are all angry. We were pissed. It's madness.",
	"I don't need to wear funny hats or put on sunglasses or anything like that.",
	"As long as I get to work regularly I'm a pretty happy guy.",
	"It is like something Steve McQueen would ride. I love the freedom and it doesn't go quite as fast as a modern bike, which pleases my wife.",
	"There's something wonderful about flying around on a wire with a sword, and doing the exact opposite.",
	"If you can go back and forth, you're a very lucky person.",
	"We're the villains right now.",
	"He's probably the happiest man I've ever played, even though he's doing horrendous things.",
	"I always thought Scandinavians had a lot in common with the English. We grew up with the English sense of humor, particularly Monty Python.",
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
