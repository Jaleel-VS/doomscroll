// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { serializeMath } from './mathml';

const MATHML = 'http://www.w3.org/1998/Math/MathML';
const math = (inner: string, attrs = '') =>
	new DOMParser().parseFromString(`<math xmlns="${MATHML}" ${attrs}>${inner}</math>`, 'application/xml').documentElement;

describe('serializeMath', () => {
	it('keeps MathML structure and presentation attributes', () => {
		expect(serializeMath(math('<mfrac><mi>a</mi><mi mathvariant="bold">b</mi></mfrac>', 'display="block"'))).toBe(
			'<math display="block"><mfrac><mi>a</mi><mi mathvariant="bold">b</mi></mfrac></math>'
		);
	});

	it('drops event handlers, links, and styles', () => {
		const out = serializeMath(math('<mi onclick="alert(1)" href="javascript:alert(1)" style="color:red">x</mi>'));
		expect(out).toBe('<math><mi>x</mi></math>');
	});

	it('unwraps elements that are not MathML, keeping only their text', () => {
		const out = serializeMath(
			math('<mtext><img xmlns="http://www.w3.org/1999/xhtml" src="x" onerror="alert(1)"/>caption</mtext><script>alert(2)</script>')
		);
		expect(out).toBe('<math><mtext>caption</mtext>alert(2)</math>');
		expect(out).not.toMatch(/<img|<script|onerror/);
	});

	it('escapes markup characters in text', () => {
		expect(serializeMath(math('<mo>&lt;</mo><mtext>&lt;b&gt;"x"</mtext>'))).toBe('<math><mo>&lt;</mo><mtext>&lt;b&gt;&quot;x&quot;</mtext></math>');
	});

	it('renders the presentation half of semantics and drops annotations', () => {
		const out = serializeMath(math('<semantics><mi>x</mi><annotation encoding="application/x-tex">x</annotation></semantics>'));
		expect(out).toBe('<math><mi>x</mi></math>');
	});

	it('ignores indentation between tags', () => {
		expect(serializeMath(math('\n  <mi>x</mi>\n  <mo>=</mo>\n  <mn>1</mn>\n'))).toBe('<math><mi>x</mi><mo>=</mo><mn>1</mn></math>');
	});
});
