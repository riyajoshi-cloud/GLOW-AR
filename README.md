# GLOW AR | Virtual Try-On Studio & Screen Diagnostics

GLOW AR is a premium, real-time virtual beauty mirror and skin diagnostic application. Built on top of MediaPipe's Face Landmark detection, the platform features high-fidelity cosmetic render mapping, skin health scans, and a shopping basket flow.

---

## ✨ Features

- **High-Fidelity Virtual Try-On**:
  - **Lips**: Multi-point contour tracing mapping of outer/inner lip boundaries with dynamic plumbness expansion and finishes (matte, glossy, metallic shimmer).
  - **Blush**: Proportioned cheek overlay radius adjustment matching face-to-camera distance.
  - **Eyeshadow**: Contour-aligned upper eyelid shading that tapers naturally at structural corners.
- **AI Face Tracking**:
  - Uses Google MediaPipe FaceMesh to automate coordinate mapping.
  - Allows manual dragging calibration of target points for custom micro-adjustments.
  - Features real-time split-screen compares and webcam streams.
- **AI Skin Diagnostics**:
  - Simulates dermal scans calculating skin hydration, redness, spots, and uniformity.
  - Retains history logs mapped in your profile dashboard.
- **Product Catalog & E-Commerce**:
  - Product catalog linked directly to instant AR render overlays.
  - Real-time shopping basket calculation with transaction invoices.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3, ES6+ JavaScript.
- **Machine Learning**: MediaPipe Face Landmarker API.
- **Backend Service**: Node.js, Express.
- **Database**: SQLite3 (processed with Knex/Queries).


```

Open [http://localhost:3000](http://localhost:3000) in your web browser to test the virtual mirror.
