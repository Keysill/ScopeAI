import React, { useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

let currentRenderTask = null;

export default function App() {
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [zoom, setZoom] = useState(1.5);
  const [tags, setTags] = useState([]);
  const [start, setStart] = useState(null);
  const [selectedTagIndex, setSelectedTagIndex] = useState(null);
  const loadPDF = async (file) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const typedArray = new Uint8Array(reader.result);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      renderPage(pdf, 1, zoom);
    };
    reader.readAsArrayBuffer(file);
  };

  const renderPage = async (pdf, num, scale = zoom) => {
    const page = await pdf.getPage(num);
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const viewport = page.getViewport({ scale });
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    overlayRef.current.style.width = viewport.width + 'px';
    overlayRef.current.style.height = viewport.height + 'px';

    if (currentRenderTask) currentRenderTask.cancel();

    const renderContext = { canvasContext: context, viewport };
    currentRenderTask = page.render(renderContext);
    try {
      await currentRenderTask.promise;
    } catch (err) {
      if (err.name !== 'RenderingCancelledException') console.error(err);
    }

    setPageNum(num);
  };

  const handleMouseDown = (e) => {
    const rect = overlayRef.current.getBoundingClientRect();
    setStart({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseUp = (e) => {
    if (!start) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const end = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);
    if (width < 10 || height < 10) return;

    const newTag = {
      page: pageNum,
      left: Math.min(start.x, end.x),
      top: Math.min(start.y, end.y),
      width,
      height,
      label: `P${tags.length + 1}`
    };

    setTags(prev => [...prev, newTag]);
    setStart(null);
  };

  const changeZoom = (delta) => {
    const newZoom = Math.max(0.5, zoom + delta);
    setZoom(newZoom);
    if (pdfDoc) renderPage(pdfDoc, pageNum, newZoom);
  };

  return (
    <div>
      <h2>ScopeAI PDF Viewer + Tagging</h2>
      <input type="file" accept="application/pdf" onChange={(e) => loadPDF(e.target.files[0])} />
      <div style={{ margin: '10px 0' }}>
        <button onClick={() => changeZoom(-0.25)}>- Zoom</button>
        <button onClick={() => changeZoom(0.25)}>+ Zoom</button>
        <button onClick={() => renderPage(pdfDoc, Math.max(1, pageNum - 1), zoom)} disabled={pageNum <= 1}>Prev</button>
        <span style={{ margin: '0 10px' }}>Page {pageNum} of {numPages}</span>
        <button onClick={() => renderPage(pdfDoc, Math.min(numPages, pageNum + 1), zoom)} disabled={pageNum >= numPages}>Next</button>
      </div>
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <canvas ref={canvasRef}></canvas>
        <div
          ref={overlayRef}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          className="overlay"
        >
          {tags.filter(tag => tag.page === pageNum).map((tag, i) => (
            <div
              key={i}
              className="tag-box"
              style={{
                left: tag.left,
                top: tag.top,
                width: tag.width,
                height: tag.height,
                border: selectedTagIndex === i ? '2px solid red' : '2px solid blue'
              }}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTagIndex(i);
              }}
            >
              {tag.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}