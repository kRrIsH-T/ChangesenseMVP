# ChangeSense MVP - Team Contribution Report

This document outlines the individual contributions of the team members for the ChangeSense MVP. Tasks were divided to ensure equal distribution of workload across frontend, backend, and core verification algorithms.

## Team Members
* Krrish
* Jai
* Soham

---

### Krrish
**Role: Frontend Architecture & AI Integration**

* **Frontend Development & UX/UI:** Designed and built the complete frontend application using React and Vite. Developed the interactive dashboard, including the dual document drop-zones for uploads and the visual diff explorer.
* **AI Engine Integration:** Implemented the Gemini AI API integration on the backend (`/ai/insights`), creating prompt schemas to deliver intelligent interpretation of structural and risk changes.
* **API Client Integration:** Developed the client-side services to manage state and asynchronously poll the FastAPI backend for the `/compare`, `/scan-integrity`, and `/report` endpoints.

### Jai
**Role: Backend Infrastructure & Document Processing**

* **API Architecture & Routing:** Setup the core FastAPI backend framework and Uvicorn server, engineered request routing, Pydantic data validation models, and CORS configurations.
* **Document Ingestion System:** Wrote the file parsers using `python-docx` to extract plaintext from DOCX format, alongside native handling for standard TXT files, normalizing inputs for algorithm analysis.
* **PDF Verification Reports:** Built the verification report generator utilizing `ReportLab` to produce downloadable, tamper-verifiable PDF reports summarizing deterministic diffs and tracked changes.

### Soham
**Role: Core Verification & Deterministic Diff Algorithms**

* **Structural Diff Engine:** Engineered the clause segmentation algorithms and the deterministic content matching logic. Utilized Shingling and Jaccard similarity metrics to effectively track clauses even when heavily reordered or retitled.
* **Risk Tag Engine:** Developed the deterministic rules engine responsible for detecting critical structural adjustments, such as modal obligation shifts (e.g., `may → shall`), numeric discrepancies, and date modifications.
* **Ghost Change Detection:** Implemented the heuristic verification logic to reliably simulate and flag "ghost" modifications (i.e. changes lacking tracked markers) and protect document integrity.

