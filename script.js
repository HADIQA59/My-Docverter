(function(){
  "use strict";

  if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  }

  /* ---------------- format map ---------------- */
  var TARGETS = {
    png:  ["jpg","webp","bmp","pdf"],
    jpg:  ["png","webp","bmp","pdf"],
    jpeg: ["png","webp","bmp","pdf"],
    webp: ["png","jpg","bmp","pdf"],
    bmp:  ["png","jpg","webp","pdf"],
    txt:  ["md","pdf"],
    md:   ["txt","pdf"],
    csv:  ["json","pdf"],
    json: ["csv","pdf"],
    docx: ["txt","md","html","pdf"],
    pdf:  ["txt","md"]
  };
  var IMAGE_EXT = ["png","jpg","jpeg","webp","bmp"];
  var TEXTY_EXT = ["txt","md","csv","json"];

  function mimeFor(ext){
    return {
      png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", webp:"image/webp", bmp:"image/bmp",
      txt:"text/plain", md:"text/markdown", csv:"text/csv", json:"application/json",
      html:"text/html", pdf:"application/pdf"
    }[ext] || "application/octet-stream";
  }

  function extOf(name){
    var parts = name.split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }
  function baseOf(name){
    var ext = extOf(name);
    return ext ? name.slice(0, name.length - ext.length - 1) : name;
  }
  function humanSize(bytes){
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + " KB";
    return (bytes/(1024*1024)).toFixed(1) + " MB";
  }
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  /* ---------------- image conversions ---------------- */
  function loadImage(file){
    return new Promise(function(resolve, reject){
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function(){ resolve({img: img, url: url}); };
      img.onerror = function(){ URL.revokeObjectURL(url); reject(new Error("Could not read that image.")); };
      img.src = url;
    });
  }

  function encodeBMP(imageData){
    var w = imageData.width, h = imageData.height, data = imageData.data;
    var rowSize = Math.floor((w*3+3)/4)*4;
    var pixelArraySize = rowSize*h;
    var fileSize = 54+pixelArraySize;
    var buffer = new ArrayBuffer(fileSize);
    var view = new DataView(buffer);
    view.setUint8(0,0x42); view.setUint8(1,0x4D);
    view.setUint32(2,fileSize,true);
    view.setUint32(6,0,true);
    view.setUint32(10,54,true);
    view.setUint32(14,40,true);
    view.setInt32(18,w,true);
    view.setInt32(22,h,true);
    view.setUint16(26,1,true);
    view.setUint16(28,24,true);
    view.setUint32(30,0,true);
    view.setUint32(34,pixelArraySize,true);
    view.setInt32(38,2835,true);
    view.setInt32(42,2835,true);
    view.setUint32(46,0,true);
    view.setUint32(50,0,true);
    var offset = 54;
    for (var y=h-1; y>=0; y--){
      for (var x=0; x<w; x++){
        var i = (y*w+x)*4;
        view.setUint8(offset++, data[i+2]);
        view.setUint8(offset++, data[i+1]);
        view.setUint8(offset++, data[i]);
      }
      var pad = rowSize - w*3;
      for (var p=0; p<pad; p++) view.setUint8(offset++, 0);
    }
    return new Blob([buffer], {type:"image/bmp"});
  }

  function imageToImage(file, tgtExt){
    return loadImage(file).then(function(res){
      var img = res.img;
      var canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext("2d");
      if (tgtExt === "jpg"){
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0,0,canvas.width,canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(res.url);
      if (tgtExt === "bmp"){
        return encodeBMP(ctx.getImageData(0,0,canvas.width,canvas.height));
      }
      var mime = mimeFor(tgtExt);
      return new Promise(function(resolve, reject){
        canvas.toBlob(function(blob){
          if (blob) resolve(blob);
          else reject(new Error("Your browser couldn't export that format."));
        }, mime, 0.92);
      });
    });
  }

  function imageToPDF(file, srcExtRaw){
    return file.arrayBuffer().then(function(bytes){
      return PDFLib.PDFDocument.create().then(function(pdfDoc){
        var embedPromise;
        if (srcExtRaw === "png"){
          embedPromise = pdfDoc.embedPng(bytes);
        } else if (srcExtRaw === "jpg" || srcExtRaw === "jpeg"){
          embedPromise = pdfDoc.embedJpg(bytes);
        } else {
          embedPromise = imageToImage(file, "png").then(function(pngBlob){
            return pngBlob.arrayBuffer();
          }).then(function(pngBytes){
            return pdfDoc.embedPng(pngBytes);
          });
        }
        return embedPromise.then(function(image){
          var w = image.width, h = image.height;
          var maxDim = 1600;
          if (w > maxDim || h > maxDim){
            var scale = Math.min(maxDim/w, maxDim/h);
            w *= scale; h *= scale;
          }
          var page = pdfDoc.addPage([w, h]);
          page.drawImage(image, {x:0, y:0, width:w, height:h});
          return pdfDoc.save();
        });
      });
    }).then(function(pdfBytes){
      return new Blob([pdfBytes], {type:"application/pdf"});
    });
  }

  /* ---------------- text conversions ---------------- */
  function mdToTxt(text){
    return text
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/__(.*?)__/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/_(.*?)_/g, "$1")
      .replace(/`(.*?)`/g, "$1")
      .replace(/^>\s?/gm, "")
      .replace(/^[-*]\s+/gm, "• ")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1");
  }
  function txtToMd(text){
    return text.replace(/^([#>\-*]|[0-9]+\.)/gm, "\\$1");
  }

  function csvToJson(text){
    var parsed = Papa.parse(text.trim(), {header:true, skipEmptyLines:true});
    return JSON.stringify(parsed.data, null, 2);
  }
  function jsonToCsv(text){
    var data = JSON.parse(text);
    var arr = Array.isArray(data) ? data : [data];
    return Papa.unparse(arr);
  }

  function wrapTextLine(line, font, fontSize, maxWidth){
    if (line === "") return [""];
    var words = line.split(" ");
    var lines = [], cur = "";
    for (var i=0; i<words.length; i++){
      var w = words[i];
      var test = cur ? cur + " " + w : w;
      var width;
      try { width = font.widthOfTextAtSize(test, fontSize); } catch(e){ width = test.length * fontSize * 0.6; }
      if (width > maxWidth && cur){
        lines.push(cur);
        cur = w;
      } else {
        cur = test;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  function textToPDF(text){
    return PDFLib.PDFDocument.create().then(function(pdfDoc){
      return pdfDoc.embedFont(PDFLib.StandardFonts.Courier).then(function(font){
        var pageWidth = 595.28, pageHeight = 841.89, margin = 54, fontSize = 10;
        var maxWidth = pageWidth - margin*2;
        var lineHeight = fontSize * 1.5;
        var page = pdfDoc.addPage([pageWidth, pageHeight]);
        var y = pageHeight - margin;
        var rawLines = text.split("\n");
        for (var i=0; i<rawLines.length; i++){
          var wrapped = wrapTextLine(rawLines[i], font, fontSize, maxWidth);
          for (var j=0; j<wrapped.length; j++){
            if (y < margin){
              page = pdfDoc.addPage([pageWidth, pageHeight]);
              y = pageHeight - margin;
            }
            page.drawText(wrapped[j].replace(/[^\x00-\x7F]/g, "?"), {
              x: margin, y: y, size: fontSize, font: font, color: PDFLib.rgb(0.1,0.09,0.08)
            });
            y -= lineHeight;
          }
        }
        return pdfDoc.save();
      });
    }).then(function(bytes){
      return new Blob([bytes], {type:"application/pdf"});
    });
  }

  /* ---------------- docx / pdf ---------------- */
  function docxExtractText(file){
    return file.arrayBuffer().then(function(ab){
      return mammoth.extractRawText({arrayBuffer: ab});
    }).then(function(res){ return res.value; });
  }
  function docxToHtmlBody(file){
    return file.arrayBuffer().then(function(ab){
      return mammoth.convertToHtml({arrayBuffer: ab});
    }).then(function(res){ return res.value; });
  }
  function wrapHtmlDoc(body, title){
    return "<!DOCTYPE html>\n<html><head><meta charset=\"utf-8\"><title>" + title +
      "</title><style>body{font-family:Georgia,serif;max-width:680px;margin:48px auto;line-height:1.6;color:#211d18;padding:0 20px;}h1,h2,h3{font-family:Georgia,serif;}</style></head><body>\n" +
      body + "\n</body></html>";
  }

  function pdfToText(file){
    return file.arrayBuffer().then(function(ab){
      return pdfjsLib.getDocument({data: ab}).promise;
    }).then(function(pdf){
      var pageNums = [];
      for (var i=1; i<=pdf.numPages; i++) pageNums.push(i);
      return pageNums.reduce(function(chain, num){
        return chain.then(function(acc){
          return pdf.getPage(num).then(function(page){
            return page.getTextContent();
          }).then(function(content){
            var strings = content.items.map(function(it){ return it.str; });
            return acc + strings.join(" ") + "\n\n";
          });
        });
      }, Promise.resolve(""));
    }).then(function(text){ return text.trim(); });
  }

  /* ---------------- master dispatcher ---------------- */
  function convertFile(file, srcExtRaw, tgtExt){
    var srcExt = srcExtRaw === "jpeg" ? "jpg" : srcExtRaw;

    if (IMAGE_EXT.indexOf(srcExtRaw) !== -1){
      if (tgtExt === "pdf") return imageToPDF(file, srcExtRaw);
      return imageToImage(file, tgtExt);
    }

    if (srcExt === "docx"){
      if (tgtExt === "txt") return docxExtractText(file).then(function(t){ return new Blob([t], {type:"text/plain"}); });
      if (tgtExt === "md") return docxExtractText(file).then(function(t){ return new Blob([txtToMd(t)], {type:"text/markdown"}); });
      if (tgtExt === "html") return docxToHtmlBody(file).then(function(h){ return new Blob([wrapHtmlDoc(h, baseOf(file.name))], {type:"text/html"}); });
      if (tgtExt === "pdf") return docxExtractText(file).then(textToPDF);
    }

    if (srcExt === "pdf"){
      return pdfToText(file).then(function(t){
        if (tgtExt === "txt") return new Blob([t], {type:"text/plain"});
        if (tgtExt === "md") return new Blob([txtToMd(t)], {type:"text/markdown"});
      });
    }

    if (TEXTY_EXT.indexOf(srcExt) !== -1){
      return file.text().then(function(text){
        if (tgtExt === "pdf") return textToPDF(text);
        var out;
        if (srcExt === "txt" && tgtExt === "md") out = txtToMd(text);
        else if (srcExt === "md" && tgtExt === "txt") out = mdToTxt(text);
        else if (srcExt === "csv" && tgtExt === "json") out = csvToJson(text);
        else if (srcExt === "json" && tgtExt === "csv") out = jsonToCsv(text);
        else throw new Error("That pairing isn't set on the press yet.");
        return new Blob([out], {type: mimeFor(tgtExt)});
      });
    }

    return Promise.reject(new Error("That pairing isn't set on the press yet."));
  }

  /* ---------------- UI wiring ---------------- */
  var dropzone = document.getElementById("dropzone");
  var fileInput = document.getElementById("fileInput");
  var browseBtn = document.getElementById("browseBtn");

  var loadedPanel = document.getElementById("loadedPanel");
  var processingPanel = document.getElementById("processingPanel");
  var resultPanel = document.getElementById("resultPanel");
  var errorPanel = document.getElementById("errorPanel");

  var srcBlock = document.getElementById("srcBlock"), srcLbl = document.getElementById("srcLbl");
  var fileNameEl = document.getElementById("fileName"), fileMetaEl = document.getElementById("fileMeta");
  var clearBtn = document.getElementById("clearBtn");
  var loadedClearBtn = document.getElementById("loadedClearBtn");
  var targetChips = document.getElementById("targetChips");
  var noTargets = document.getElementById("noTargets");
  var convertBtn = document.getElementById("convertBtn");

  var pressStage = document.getElementById("pressStage");
  var animBlock = document.getElementById("animBlock"), animLbl = document.getElementById("animLbl");
  var processingLabel = document.getElementById("processingLabel");

  var resultSrcLbl = document.getElementById("resultSrcLbl"), resultTgtLbl = document.getElementById("resultTgtLbl");
  var resultSub = document.getElementById("resultSub");
  var downloadBtn = document.getElementById("downloadBtn");
  var convertAgainBtn = document.getElementById("convertAgainBtn");
  var resultClearBtn = document.getElementById("resultClearBtn");

  var errorSub = document.getElementById("errorSub");
  var errorRetryBtn = document.getElementById("errorRetryBtn");
  var errorClearBtn = document.getElementById("errorClearBtn");

  var logWrap = document.getElementById("log");
  var logRows = document.getElementById("logRows");

  var state = { file: null, srcExt: null, tgtExt: null, blobUrl: null };

  function showPanel(name){
    loadedPanel.style.display = name === "loaded" ? "flex" : "none";
    processingPanel.style.display = name === "processing" ? "flex" : "none";
    resultPanel.style.display = name === "result" ? "flex" : "none";
    errorPanel.style.display = name === "error" ? "flex" : "none";
    dropzone.style.display = name === "empty" ? "flex" : "none";
  }

  function resetAll(){
    if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
    state = { file: null, srcExt: null, tgtExt: null, blobUrl: null };
    fileInput.value = "";
    showPanel("empty");
  }

  function handleFile(file){
    var ext = extOf(file.name);
    var normalized = ext === "jpeg" ? "jpg" : ext;
    if (!TARGETS.hasOwnProperty(ext)){
      state.file = file; state.srcExt = ext;
      showErrorScreen("Unrecognized format", "\u201c." + (ext || "unknown") + "\u201d isn't a plate we carry yet. Try an image, PDF, DOCX, CSV, JSON, TXT or MD file.");
      return;
    }
    state.file = file;
    state.srcExt = ext;
    state.tgtExt = null;

    srcLbl.textContent = normalized;
    fileNameEl.textContent = file.name;
    fileMetaEl.textContent = normalized.toUpperCase() + " · " + humanSize(file.size);

    var targets = TARGETS[ext] || [];
    targetChips.innerHTML = "";
    if (targets.length === 0){
      noTargets.style.display = "block";
    } else {
      noTargets.style.display = "none";
      targets.forEach(function(t){
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = t;
        chip.addEventListener("click", function(){
          Array.prototype.forEach.call(targetChips.children, function(c){ c.classList.remove("active"); });
          chip.classList.add("active");
          state.tgtExt = t;
          convertBtn.disabled = false;
        });
        targetChips.appendChild(chip);
      });
    }
    convertBtn.disabled = true;
    showPanel("loaded");
  }

  function showErrorScreen(title, sub){
    errorSub.textContent = sub;
    document.querySelector(".error-title").textContent = title === "Unrecognized format" ? "Unrecognized format." : "The press jammed.";
    showPanel("error");
  }

  /* drag + drop + browse */
  ["dragenter","dragover"].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.add("drag"); });
  });
  ["dragleave","drop"].forEach(function(evt){
    dropzone.addEventListener(evt, function(e){ e.preventDefault(); dropzone.classList.remove("drag"); });
  });
  dropzone.addEventListener("drop", function(e){
    var f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  dropzone.addEventListener("click", function(){ fileInput.click(); });
  dropzone.addEventListener("keydown", function(e){
    if (e.key === "Enter" || e.key === " "){ e.preventDefault(); fileInput.click(); }
  });
  browseBtn.addEventListener("click", function(e){ e.stopPropagation(); fileInput.click(); });
  fileInput.addEventListener("change", function(){
    if (fileInput.files && fileInput.files[0]) handleFile(fileInput.files[0]);
  });

  clearBtn.addEventListener("click", resetAll);
  loadedClearBtn.addEventListener("click", resetAll);
  resultClearBtn.addEventListener("click", resetAll);
  errorClearBtn.addEventListener("click", resetAll);
  errorRetryBtn.addEventListener("click", function(){
    if (state.file){ handleFile(state.file); } else { resetAll(); }
  });
  convertAgainBtn.addEventListener("click", function(){
    if (state.file) handleFile(state.file);
  });

  function addLogRow(from, to, name){
    logWrap.classList.add("has-items");
    var row = document.createElement("div");
    row.className = "log-row";
    var now = new Date();
    var time = now.toLocaleTimeString([], {hour:"2-digit", minute:"2-digit"});
    row.innerHTML = "<span>" + name + " &nbsp;" + from.toUpperCase() + " \u2192 " + to.toUpperCase() + "</span><span class=\"t\">" + time + "</span>";
    logRows.insertBefore(row, logRows.firstChild);
  }

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  convertBtn.addEventListener("click", function(){
    if (!state.file || !state.tgtExt) return;
    var srcNorm = state.srcExt === "jpeg" ? "jpg" : state.srcExt;
    animLbl.textContent = srcNorm;
    animLbl.className = "lbl";
    pressStage.className = "press-stage";
    processingLabel.textContent = "Pressing plate\u2026";
    showPanel("processing");

    var conversionPromise = convertFile(state.file, state.srcExt, state.tgtExt);
    var swapped = false;

    function doSwap(){
      if (swapped) return;
      swapped = true;
      animLbl.textContent = state.tgtExt;
    }

    var sequence;
    if (reduceMotion){
      sequence = conversionPromise.then(function(blob){ doSwap(); return blob; });
    } else {
      sequence = wait(30).then(function(){
        pressStage.classList.add("down");
        return wait(420);
      }).then(function(){
        pressStage.classList.add("flash");
        return wait(140);
      }).then(function(){
        pressStage.classList.remove("flash");
        return Promise.all([conversionPromise, wait(260)]);
      }).then(function(res){
        doSwap();
        return wait(160);
      }).then(function(){
        pressStage.classList.remove("down");
        return wait(420);
      }).then(function(){
        return conversionPromise;
      });
    }

    sequence.then(function(blob){
      if (!blob) throw new Error("That pairing isn't set on the press yet.");
      if (state.blobUrl) URL.revokeObjectURL(state.blobUrl);
      state.blobUrl = URL.createObjectURL(blob);
      var outName = baseOf(state.file.name) + "." + state.tgtExt;
      resultSrcLbl.textContent = srcNorm;
      resultTgtLbl.textContent = state.tgtExt;
      resultSub.textContent = outName + " \u00b7 " + humanSize(blob.size);
      downloadBtn.href = state.blobUrl;
      downloadBtn.setAttribute("download", outName);
      addLogRow(srcNorm, state.tgtExt, state.file.name.length > 22 ? state.file.name.slice(0,19) + "\u2026" : state.file.name);
      showPanel("result");
    }).catch(function(err){
      showErrorScreen("Jammed", (err && err.message) ? err.message : "That conversion couldn't be completed. Try a different format or file.");
    });
  });

})();