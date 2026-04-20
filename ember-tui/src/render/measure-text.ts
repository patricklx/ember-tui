import widestLine from 'widest-line';

// LRU cache with size limit to prevent memory leaks
const MAX_CACHE_SIZE = 1000;
const cache = new Map<string, Output>();

type Output = {
	width: number;
	height: number;
};

/**
 * Measure the dimensions of text
 * Returns width (widest line) and height (number of lines)
 */
const measureText = (text: string): Output => {
	if (text.length === 0) {
		return {
			width: 0,
			height: 0,
		};
	}

	const cachedDimensions = cache.get(text);

	if (cachedDimensions) {
		// Move to end (LRU)
		cache.delete(text);
		cache.set(text, cachedDimensions);
		return cachedDimensions;
	}

	const width = widestLine(text);
	const height = text.split('\n').length;
	const dimensions = {width, height};
	
	// Implement LRU eviction
	if (cache.size >= MAX_CACHE_SIZE) {
		// Delete oldest entry (first key)
		const firstKey = cache.keys().next().value;
		if (firstKey !== undefined) {
			cache.delete(firstKey);
		}
	}
	
	cache.set(text, dimensions);

	return dimensions;
};

export default measureText;
