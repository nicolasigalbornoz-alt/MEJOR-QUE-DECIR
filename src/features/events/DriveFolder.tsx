"use client";

import { useState } from "react";

const FOLDER_ID = "14bR_BlwfETHDbmXFsRMd1pRvPmzDnNFI";

export function DriveFolder() {
  const [open, setOpen] = useState(false);
  return (
    <div className="card drive-item">
      <div className="drive-item__head">
        <span className="drive-item__title">
          <span className="drive-item__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg></span>
          Insumo para la militancia
        </span>
        <button type="button" className="drive-item__toggle" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Ocultar" : "Ver contenido"}</button>
      </div>
      <div className="drive-item__panel" hidden={!open}>
        {open && <iframe className="drive-item__frame" loading="lazy" title="Carpeta de insumos para la militancia" src={`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#grid`} referrerPolicy="no-referrer" />}
      </div>
    </div>
  );
}
