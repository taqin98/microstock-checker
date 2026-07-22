// checkVector.jsx — Illustrator ExtendScript
// Executed via AppleScript. Arguments are injected as variables before this script runs.
// Expected injected vars: var inputFilePath, var outputFilePath, var previewFilePath;

#target illustrator

function main() {
  app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

  var result = {
    success: false,
    error: null,
    textFrameCount: 0,
    rasterItemCount: 0,
    placedItemCount: 0,
    artboardWidth: 0,
    artboardHeight: 0,
    colorMode: '',
    pathItemCount: 0,
    compoundPathCount: 0,
    groupCount: 0,
    layerCount: 0,
    strayObjectCount: 0,
    fileSize: 0
  };

  try {
    var file = new File(inputFilePath);
    if (!file.exists) {
      result.error = 'File not found: ' + inputFilePath;
      writeResult(result);
      return;
    }

    result.fileSize = file.length;

    var doc = app.open(file);

    // Basic counts
    result.textFrameCount = doc.textFrames.length;
    result.rasterItemCount = doc.rasterItems.length;
    result.placedItemCount = doc.placedItems.length;
    result.pathItemCount = doc.pathItems.length;
    result.compoundPathCount = doc.compoundPathItems.length;
    result.groupCount = doc.groupItems.length;
    result.layerCount = doc.layers.length;

    // Artboard dimensions (first artboard)
    if (doc.artboards.length > 0) {
      var rect = doc.artboards[0].artboardRect;
      // rect = [left, top, right, bottom] in points
      result.artboardWidth = Math.round(rect[2] - rect[0]);
      result.artboardHeight = Math.round(rect[1] - rect[3]);
    }

    // Color mode
    if (doc.documentColorSpace == DocumentColorSpace.RGB) {
      result.colorMode = 'RGB';
    } else if (doc.documentColorSpace == DocumentColorSpace.CMYK) {
      result.colorMode = 'CMYK';
    } else {
      result.colorMode = 'Unknown';
    }

    // Check stray objects (outside artboard bounds)
    result.strayObjectCount = countStrayObjects(doc);

    // Export preview if requested
    if (typeof previewFilePath !== 'undefined' && previewFilePath) {
      try {
        var exportOptions = new ExportOptionsJPEG();
        exportOptions.qualitySetting = 80;
        exportOptions.artBoardClipping = true;
        var destFile = new File(previewFilePath);
        doc.exportFile(destFile, ExportType.JPEG, exportOptions);
        result.previewExported = true;
      } catch (expErr) {
        result.previewError = expErr.message;
      }
    }

    result.success = true;
    doc.close(SaveOptions.DONOTSAVECHANGES);
  } catch (e) {
    result.error = e.message || String(e);
    // Try to close any open doc
    try {
      if (app.documents.length > 0) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (closeErr) {
      // Ignore close errors
    }
  }

  writeResult(result);
}

function countStrayObjects(doc) {
  var count = 0;
  if (doc.artboards.length === 0) return 0;

  var abRect = doc.artboards[0].artboardRect;
  var abLeft = abRect[0];
  var abTop = abRect[1];
  var abRight = abRect[2];
  var abBottom = abRect[3];

  for (var i = 0; i < doc.pageItems.length; i++) {
    var item = doc.pageItems[i];
    try {
      var bounds = item.geometricBounds; // [left, top, right, bottom]
      if (bounds[0] < abLeft - 1 || bounds[1] > abTop + 1 ||
          bounds[2] > abRight + 1 || bounds[3] < abBottom - 1) {
        count++;
      }
    } catch (e) {
      // Some items may not have bounds
    }
  }
  return count;
}

function writeResult(data) {
  var file = new File(outputFilePath);
  file.open('w');
  file.encoding = 'UTF-8';
  file.write(jsonStringify(data));
  file.close();
}

// Minimal JSON.stringify for ExtendScript (which lacks native JSON)
function jsonStringify(obj) {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj === 'string') return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  if (typeof obj === 'number' || typeof obj === 'boolean') return String(obj);
  if (obj instanceof Array) {
    var arr = [];
    for (var i = 0; i < obj.length; i++) {
      arr.push(jsonStringify(obj[i]));
    }
    return '[' + arr.join(',') + ']';
  }
  if (typeof obj === 'object') {
    var parts = [];
    for (var key in obj) {
      if (obj.hasOwnProperty(key)) {
        parts.push('"' + key + '":' + jsonStringify(obj[key]));
      }
    }
    return '{' + parts.join(',') + '}';
  }
  return String(obj);
}

main();
