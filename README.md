# Customs Freight Escalation Engine

A full-stack web application for a customs brokerage firm to automate freight quote requests via a tiered email escalation system.

---

## Architecture

```
Customs Freight Engine/
├── backend/          Node.js + Express + TypeScript + MongoDB
└── frontend/         React + TypeScript + Tailwind CSS + Vite
```

---

## Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| MongoDB | Running locally on port 27017 |
| Gmail account | With an **App Password** (not the regular password) |

---

## 1 — Gmail App Password Setup

1. Go to **Google Account → Security → 2-Step Verification** and enable it.
2. Go to **Security → App Passwords**.
3. Create a new app password (App: Mail, Device: Other → name it "Customs Engine").
4. Copy the 16-character password.

---

## 2 — Backend Setup

```bash
cd backend

# Copy example and fill in your values
copy .env.example .env
```

Edit `backend/.env`:
```
MONGO_URI=mongodb://localhost:27017/customs-freight
GMAIL_USER=maorfl14@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   ← your 16-char App Password
PORT=5000
FRONTEND_URL=http://localhost:3000
```

```bash
# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

The backend will start on **http://localhost:5000**.

---

## 3 — Frontend Setup

```bash
cd frontend

# Install dependencies (already done)
npm install

# Start development server
npm run dev
```

The frontend will open on **http://localhost:3000**.

---

## Carrier Selection Logic

### Haifa Ports (ILHFA, ILHBT, ILOVR, ILHDC)
| Carrier | Email(s) |
|---|---|
| SME | Yelena@sme.co.il |
| TLS | tls.quote1@gmail.com |
| Conterm (FCL) | hgc@goldbond.co.il, gbh@goldbond.co.il |
| Conterm (LCL) | hlcl@goldbond.co.il |

### Ashdod Ports (ILASH, ILAST, ILOVO, ILMTS, ILCXQ, ILBXQ)
| Carrier | Email(s) | Condition |
|---|---|---|
| SME | ashdod@sme.co.il | Always |
| TLS | tls.quote1@gmail.com | Always |
| Conterm | lcl@goldbond.co.il | Only when terminal = **ILCXQ** |

**CC on all emails:** cus1@h-caspi.co.il

---

## Escalation Engine

- Emails are sent **one at a time**, to carriers in the order listed above.
- After the first email is sent, a **30-minute timer** starts.
- The `node-cron` job checks every minute and sends the next email when the timer expires.
- Shipment `status` progresses: `Pending` → `Processing` → `Completed`.

---

## API Reference

### Carriers
| Method | Path | Description |
|---|---|---|
| GET | `/api/carriers` | List all carriers |
| POST | `/api/carriers` | Create carrier |
| PUT | `/api/carriers/:id` | Update carrier |
| DELETE | `/api/carriers/:id` | Delete carrier |
| POST | `/api/carriers/:id/price-list` | Upload / replace price list (multipart) |

### Shipments
| Method | Path | Description |
|---|---|---|
| GET | `/api/shipments` | List all shipments (optional `?status=`) |
| POST | `/api/shipments` | Create shipment + send first email (multipart) |
| GET | `/api/shipments/:id` | Get single shipment |
| DELETE | `/api/shipments/:id` | Delete shipment |

---

## Production Build

```bash
# Backend
cd backend && npm run build
node dist/index.js

# Frontend
cd frontend && npm run build
# Serve the dist/ folder with nginx or any static host
```
