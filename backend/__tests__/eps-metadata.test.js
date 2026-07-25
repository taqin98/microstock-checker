import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseEpsXmp, readEpsMetadata } from '../utils/eps-metadata.js';

const xmp = `<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
           xmlns:dc="http://purl.org/dc/elements/1.1/">
    <rdf:Description>
      <dc:title><rdf:Alt><rdf:li xml:lang="x-default">Harvest Basket</rdf:li></rdf:Alt></dc:title>
      <dc:description><rdf:Alt><rdf:li xml:lang="x-default">Autumn vector border</rdf:li></rdf:Alt></dc:description>
      <dc:subject><rdf:Bag>
        <rdf:li>autumn</rdf:li>
        <rdf:li>basket</rdf:li>
        <rdf:li>Autumn</rdf:li>
      </rdf:Bag></dc:subject>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>`;

describe('EPS XMP metadata', () => {
  it('parses title, description, and unique keywords', () => {
    assert.deepEqual(parseEpsXmp(xmp), {
      title: 'Harvest Basket',
      description: 'Autumn vector border',
      keywords: ['autumn', 'basket'],
    });
  });

  it('finds an XMP packet embedded in an EPS file', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-metadata-test-'));
    const filePath = path.join(directory, 'asset.eps');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(filePath, `%!PS-Adobe-3.0 EPSF-3.0\n${xmp}\n%%EOF`);

    assert.equal(readEpsMetadata(filePath).title, 'Harvest Basket');
  });

  it('returns empty metadata when the EPS has no XMP packet', (t) => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'eps-metadata-test-'));
    const filePath = path.join(directory, 'asset.eps');
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    fs.writeFileSync(filePath, '%!PS-Adobe-3.0 EPSF-3.0\n%%EOF');

    assert.deepEqual(readEpsMetadata(filePath), {
      title: '',
      description: '',
      keywords: [],
    });
  });
});
