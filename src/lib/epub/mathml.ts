/**
 * Copy MathML out of a book as safe markup the browser can render natively (MathML Core). Only MathML elements and
 * presentation attributes survive; anything else is unwrapped to its children, and `semantics` keeps just its first
 * child, dropping annotations. The output is built from scratch, so no attribute or text reaches the page unescaped.
 */

const ELEMENTS = new Set(
	'math maction menclose merror mfrac mi mmultiscripts mn mo mover mpadded mphantom mprescripts mroot mrow ms mspace msqrt mstyle msub msubsup msup mtable mtd mtext mtr munder munderover none'.split(
		' '
	)
);

const ATTRIBUTES = new Set(
	'accent accentunder columnspan depth dir display displaystyle fence form height largeop linethickness lspace mathvariant maxsize minsize movablelimits notation rowspan rspace scriptlevel separator stretchy symmetric voffset width'.split(
		' '
	)
);

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function serializeMath(node: Node): string {
	if (node.nodeType === 3) {
		// Whitespace between tags is source indentation; inside a token it collapses to one space.
		const text = node.textContent ?? '';
		return text.trim() ? escape(text.replace(/\s+/g, ' ')) : '';
	}
	if (node.nodeType !== 1) return '';
	const el = node as Element;
	const tag = el.localName.toLowerCase();
	if (tag === 'semantics') return el.firstElementChild ? serializeMath(el.firstElementChild) : '';
	if (tag === 'annotation' || tag === 'annotation-xml') return '';
	const children = Array.from(el.childNodes, serializeMath).join('');
	if (!ELEMENTS.has(tag)) return children;
	const attrs = Array.from(el.attributes)
		.filter((a) => ATTRIBUTES.has(a.localName.toLowerCase()))
		.map((a) => ` ${a.localName.toLowerCase()}="${escape(a.value)}"`)
		.join('');
	return `<${tag}${attrs}>${children}</${tag}>`;
}
