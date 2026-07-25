import fs from 'fs';
import sax from 'sax';

const READ_CHUNK_SIZE = 64 * 1024;
const MAX_XMP_SIZE = 5 * 1024 * 1024;
const MARKER_OVERLAP_SIZE = 128;

function extractXmpPacket(filePath) {
  const fileDescriptor = fs.openSync(filePath, 'r');
  const chunk = Buffer.alloc(READ_CHUNK_SIZE);
  let overlap = '';
  let packet = '';
  let collecting = false;

  try {
    while (true) {
      const bytesRead = fs.readSync(fileDescriptor, chunk, 0, chunk.length, null);
      if (bytesRead === 0) return null;

      const text = collecting
        ? chunk.subarray(0, bytesRead).toString('utf8')
        : overlap + chunk.subarray(0, bytesRead).toString('utf8');

      if (!collecting) {
        const startMatch = text.match(/<(?:[\w-]+:)?xmpmeta\b/i);
        if (!startMatch) {
          overlap = text.slice(-MARKER_OVERLAP_SIZE);
          continue;
        }

        collecting = true;
        packet = text.slice(startMatch.index);
      } else {
        packet += text;
      }

      const endMatch = packet.match(/<\/(?:[\w-]+:)?xmpmeta>/i);
      if (endMatch) {
        return packet.slice(0, endMatch.index + endMatch[0].length);
      }

      if (packet.length > MAX_XMP_SIZE) return null;
    }
  } finally {
    fs.closeSync(fileDescriptor);
  }
}

function normalizeValue(value) {
  return value.replace(/\s+/g, ' ').trim();
}

export function parseEpsXmp(packet) {
  const values = {
    title: [],
    description: [],
    subject: [],
  };
  let activeField = null;
  let activeItem = null;

  const parser = sax.parser(true, { trim: false, normalize: false });

  parser.onopentag = (node) => {
    const localName = node.name.toLowerCase().replace(/^.*:/, '');
    if (Object.hasOwn(values, localName)) {
      activeField = localName;
      return;
    }

    if (localName === 'li' && activeField) {
      activeItem = {
        language: node.attributes['xml:lang'] || '',
        value: '',
      };
    }
  };

  parser.ontext = (text) => {
    if (activeItem) activeItem.value += text;
  };

  parser.oncdata = (text) => {
    if (activeItem) activeItem.value += text;
  };

  parser.onclosetag = (name) => {
    const localName = name.toLowerCase().replace(/^.*:/, '');

    if (localName === 'li' && activeItem && activeField) {
      const value = normalizeValue(activeItem.value);
      if (value) values[activeField].push({ ...activeItem, value });
      activeItem = null;
      return;
    }

    if (localName === activeField) {
      activeField = null;
    }
  };

  parser.write(packet).close();

  const selectLocalizedValue = (items) =>
    items.find((item) => item.language === 'x-default')?.value
    || items[0]?.value
    || '';
  const seenKeywords = new Set();
  const keywords = values.subject
    .map((item) => item.value)
    .filter((keyword) => {
      const key = keyword.toLowerCase();
      if (seenKeywords.has(key)) return false;
      seenKeywords.add(key);
      return true;
    });

  return {
    title: selectLocalizedValue(values.title),
    description: selectLocalizedValue(values.description),
    keywords,
  };
}

export function readEpsMetadata(filePath) {
  try {
    const packet = extractXmpPacket(filePath);
    return packet
      ? parseEpsXmp(packet)
      : { title: '', description: '', keywords: [] };
  } catch {
    return { title: '', description: '', keywords: [] };
  }
}
